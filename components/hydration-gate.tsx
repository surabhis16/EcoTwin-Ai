"use client"

import { useEffect } from "react"

export default function HydrationGate({
    children,
}: {
    children: React.ReactNode
}) {
    useEffect(() => {
        document.body.classList.add("hydrated")
    }, [])

    return <>{children}</>
}
