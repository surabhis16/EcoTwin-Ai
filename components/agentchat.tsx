import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { mapBus } from "@/lib/mapEventBus"
import ReactMarkdown from "react-markdown"
import { Bot, Send, Minimize2, Loader2 } from "lucide-react"

export default function AgentChat() {
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<{ role: string, text: string }[]>([
        { role: "agent", text: "Hi! I'm your Bengaluru Climate Agent. Ask me about heat hotspots, ward baselines, or simulate interventions." }
    ])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const sessionId = useRef(crypto.randomUUID())
    const bottomRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Listen for ward clicks from the map
    useEffect(() => {
        const unsubscribe = mapBus.subscribe((event) => {
            if (event.type === "WARD_CLICKED") {
                const suggestion = `Tell me about ward ${event.wardId} (${event.wardName}). Current LST: ${event.lst}°C, NDVI: ${event.ndvi}`
                setInput(suggestion)
                setOpen(true)
            }
        })
        return () => unsubscribe()
    }, [])

    useEffect(() => {
        const el = inputRef.current
        if (!el) return
        el.style.height = "auto"
        el.style.height = Math.min(el.scrollHeight, 120) + "px"
    }, [input])

    const extractAllCoolingValues = (text: string): number[] => {
        const patterns = [
            /cool(?:ing)?\s+(?:the\s+\w+\s+)?by\s+(\d+\.?\d*)°C/gi,  // "cool the ward by 1.82°C"
            /cooling\s+effect[:\s*]+(\d+\.?\d*)/gi,
            /(\d+\.?\d*)°C\s+reduction/gi,
            /cooling effect:\s*(\d+\.?\d*)°C/gi,  // "Cooling effect: 0.07°C"
            /cooling effect:\s*(\d+\.?\d*)°C/gi,
            /reduction\s+of\s+(\d+\.?\d*)°C/gi,
            /represents\s+a\s+(\d+\.?\d*)°C/gi,
            /decreases\s+by\s+(\d+\.?\d*)°C/gi,
            /(?:projected\s+)?decrease\s+in\s+(?:land\s+surface\s+temperature\s+)?(?:\(lst\)\s+)?by\s+(\d+\.?\d*)°C/gi,
            /a\s+cooling\s+effect\s+of\s+(\d+\.?\d*)°C/gi,  // "a cooling effect of 0.16°C"
        ]
        const fromToMatches = [...text.matchAll(/from\s+(\d+\.?\d*)°C\s+to\s+(\d+\.?\d*)°C/gi)]
        if (fromToMatches.length > 0) {
            return fromToMatches.map(m => parseFloat(m[1]) - parseFloat(m[2]))
        }
        for (const pattern of patterns) {
            const matches = [...text.matchAll(pattern)]
            if (matches.length >= 1) {
                const values = matches.map(m => parseFloat(m[1]))
                console.log(`Cooling pattern matched:`, values)
                return values
            }
        }
        return []
    }

    const parseAgentResponseForMapEvents = async (text: string) => {
        console.log("Agent response text:", text)
        const wardMatches = [
            ...text.matchAll(/(?:Ward\s+)?(\d+)-([A-Za-z][A-Za-z\s]*[A-Za-z])/g),  // "104-Varthuru"
            ...text.matchAll(/Ward\s+(\d+)\s+\(([A-Za-z][A-Za-z\s]*[A-Za-z])\)/g),  // "Ward 31 (Bande Mutt)"
        ]
        const wardSlugs = [...new Set(wardMatches.map(m => `${m[1]}-${m[2].trim()}`))]
        const wardIds = [...new Set(wardSlugs.map(s => parseInt(s.split("-")[0])))]
        console.log("Ward IDs found:", wardIds)
        console.log("Has simulation:", text.toLowerCase().includes("cooling effect") ||
            text.toLowerCase().includes("cool the ward by"))

        const hasSimulation =
            text.toLowerCase().includes("cooling effect") ||
            text.toLowerCase().includes("lst before") ||
            text.toLowerCase().includes("simulated lst") ||
            text.toLowerCase().includes("lst after") ||
            text.toLowerCase().includes("reduction in surface temperature") ||
            text.toLowerCase().includes("cool the ward by") ||
            text.toLowerCase().includes("reduction in predicted surface temperature") ||
            text.toLowerCase().includes("lst decreases by") ||
            text.toLowerCase().includes("projected decrease") ||
            text.toLowerCase().includes("decrease in lst") ||
            text.toLowerCase().includes("decreases by") ||
            text.toLowerCase().includes("decrease in land surface temperature")

        if (wardIds.length === 0) return

        if (!hasSimulation) {
            try {
                const res = await fetch(`http://localhost:8000/api/uhi/ward-baseline/${wardIds[0]}`)
                const data = await res.json()
                mapBus.emit({
                    type: "FLY_TO_WARD",
                    wardId: wardIds[0],
                    lon: data.coordinates.lon,
                    lat: data.coordinates.lat
                })
            } catch { }
            return
        }

        const allCoolingValues = extractAllCoolingValues(text)
        console.log("All cooling values extracted:", allCoolingValues)

        const simulationDataList = []
        for (let i = 0; i < Math.min(wardIds.length, 3); i++) {
            try {
                const res = await fetch(`http://localhost:8000/api/uhi/ward-baseline/${wardIds[i]}`)
                const data = await res.json()
                const cooling = allCoolingValues[i] ?? 0
                console.log(`Ward ${wardIds[i]}: cooling=${cooling}`)

                simulationDataList.push({
                    wardName: data.ward_name,
                    coordinates: data.coordinates,
                    lstBefore: data.lst_before,
                    lstAfter: data.lst_before - cooling,
                    temperatureReduction: cooling,
                    co2Offset: 0,
                })
            } catch (e) {
                console.error(`Failed for ward ${wardIds[i]}:`, e)
            }
        }

        console.log("Emitting SHOW_MULTI_SIMULATION:", simulationDataList.map(s => `${s.wardName}: -${s.temperatureReduction}°C`))

        if (simulationDataList.length > 0) {
            mapBus.emit({
                type: "SHOW_MULTI_SIMULATION",
                simulations: simulationDataList
            })
        }
    }

    const send = async () => {
        if (!input.trim() || loading) return
        const userMsg = input.trim()
        setInput("")
        setMessages(prev => [...prev, { role: "user", text: userMsg }])
        setLoading(true)

        let responseText = ""
        try {
            const res = await fetch("http://localhost:8000/api/agent/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId.current, message: userMsg })
            })
            const data = await res.json()
            console.log("Raw API response:", data)
            responseText = data.response
            setMessages(prev => [...prev, { role: "agent", text: responseText }])
        } catch {
            setMessages(prev => [...prev, { role: "agent", text: "Connection error. Is the backend running?" }])
        } finally {
            setLoading(false)
        }

        if (responseText) {
            const isSimulation =
                responseText.toLowerCase().includes("predicted to result in") ||
                responseText.toLowerCase().includes("is predicted to cool") ||
                responseText.toLowerCase().includes("reducing the lst") ||
                responseText.toLowerCase().includes("lst decreases by") ||
                responseText.toLowerCase().includes("decreases by") ||
                responseText.toLowerCase().includes("cooling effect:")

            if (isSimulation) {
                parseAgentResponseForMapEvents(responseText)
            }
        }
    }

    return (
        <>
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:scale-105 transition-transform"
                >
                    <Bot className="h-6 w-6" />
                </button>
            )}

            {open && (
                <div
                    style={{ width: 500, height: 600, resize: "both", overflow: "auto", minWidth: 300, minHeight: 400 }}
                    className="fixed bottom-6 right-6 z-50"
                >
                    <Card className="w-full h-full flex flex-col shadow-2xl border-primary/20">
                        <div className="flex items-center justify-between p-4 border-b">
                            <div className="flex items-center gap-2">
                                <Bot className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="font-semibold text-sm">Climate Agent</p>
                                    <p className="text-xs text-muted-foreground">Bengaluru Digital Twin</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                                <Minimize2 className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                                        : "bg-muted rounded-tl-sm"
                                        }`}>
                                        {msg.role === "agent" ? (
                                            <ReactMarkdown components={{
                                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                                li: ({ children }) => <li className="text-sm">{children}</li>,
                                                h1: ({ children }) => <h1 className="text-base font-bold mb-2">{children}</h1>,
                                                h2: ({ children }) => <h2 className="text-sm font-bold mb-1">{children}</h2>,
                                                h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                                                code: ({ children }) => (
                                                    <code className="bg-background/50 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                                                ),
                                            }}>
                                                {msg.text}
                                            </ReactMarkdown>
                                        ) : (
                                            msg.text
                                        )}
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </div>
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </div>

                        <div className="p-4 border-t flex gap-2">
                            <textarea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
                                placeholder="Ask about wards, hotspots..."
                                rows={1}
                                className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary resize-none overflow-hidden"
                                style={{ lineHeight: "1.5", maxHeight: 120 }}
                                ref={inputRef}
                            />
                            <Button size="icon" onClick={send} disabled={loading}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </>
    )
}