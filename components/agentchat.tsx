import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bot, Send, X, Minimize2, Loader2 } from "lucide-react"

export default function AgentChat() {
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<{ role: string, text: string }[]>([
        { role: "agent", text: "Hi! I'm your Bengaluru Climate Agent. Ask me about heat hotspots, ward baselines, or simulate interventions." }
    ])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const sessionId = useRef(crypto.randomUUID())
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const send = async () => {
        if (!input.trim() || loading) return
        const userMsg = input.trim()
        setInput("")
        setMessages(prev => [...prev, { role: "user", text: userMsg }])
        setLoading(true)

        try {
            const res = await fetch("http://localhost:8000/api/agent/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId.current, message: userMsg })
            })
            const data = await res.json()
            setMessages(prev => [...prev, { role: "agent", text: data.response }])
        } catch {
            setMessages(prev => [...prev, { role: "agent", text: "Connection error. Is the backend running?" }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            {/* Floating button */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:scale-105 transition-transform"
                >
                    <Bot className="h-6 w-6" />
                </button>
            )}

            {/* Chat panel */}
            {open && (
                <Card className="fixed bottom-6 right-6 z-50 w-96 h-[560px] flex flex-col shadow-2xl border-primary/20">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b">
                        <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-primary" />
                            <div>
                                <p className="font-semibold text-sm">Climate Agent</p>
                                <p className="text-xs text-muted-foreground">Bengaluru Digital Twin</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                                <Minimize2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                                        : "bg-muted rounded-tl-sm"
                                    }`}>
                                    {msg.text}
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

                    {/* Input */}
                    <div className="p-4 border-t flex gap-2">
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && send()}
                            placeholder="Ask about wards, hotspots..."
                            className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary"
                        />
                        <Button size="icon" onClick={send} disabled={loading}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </Card>
            )}
        </>
    )
}