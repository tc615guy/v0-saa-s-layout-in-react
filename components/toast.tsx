"use client"

import { CheckCircle2 } from "lucide-react"

interface ToastProps {
  message: string
}

export function Toast({ message }: ToastProps) {
  return (
    <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className="bg-card border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 min-w-[280px]">
        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>
  )
}
