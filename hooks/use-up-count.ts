"use client"

import { useEffect, useState, useRef } from "react"

export function useCountUp(end: number, duration = 2000) {
    const [count, setCount] = useState(0)
    const [hasAnimated, setHasAnimated] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                // start only if element is in view and hasn't animated yet
                if (entry.isIntersecting && !hasAnimated) {
                    setHasAnimated(true)
                    let startTimestamp: number | null = null

                    const step = (timestamp: number) => {
                        if (!startTimestamp) startTimestamp = timestamp
                        const progress = Math.min((timestamp - startTimestamp) / duration, 1)

                        // ease-out function for a smoother finish
                        const easeOutQuad = (t: number) => t * (2 - t)
                        const currentCount = Math.floor(easeOutQuad(progress) * end)

                        setCount(currentCount)

                        if (progress < 1) {
                            window.requestAnimationFrame(step)
                        }
                    }

                    window.requestAnimationFrame(step)
                }
            },
            { threshold: 0.3 }
        )

        if (ref.current) {
            observer.observe(ref.current)
        }

        return () => observer.disconnect()
    }, [end, duration, hasAnimated])

    return { count, ref }
}