"use client"

import { useState } from "react"
import { Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CanvasSurface() {
  const [zoom, setZoom] = useState(100)

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 200))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 50))
  }

  return (
    <main className="flex-1 relative bg-background overflow-hidden">
      {/* Checker grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(45deg, rgb(var(--color-muted)) 25%, transparent 25%),
            linear-gradient(-45deg, rgb(var(--color-muted)) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgb(var(--color-muted)) 75%),
            linear-gradient(-45deg, transparent 75%, rgb(var(--color-muted)) 75%)
          `,
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          opacity: 0.03,
        }}
      />

      {/* Empty state */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Drop cabinets here</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Select a cabinet from the palette on the left and add it to your design
          </p>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-card border border-border rounded-lg p-2 shadow-lg">
        <Button variant="ghost" size="sm" onClick={handleZoomOut} disabled={zoom <= 50} className="h-8 w-8 p-0">
          <Minus className="h-4 w-4" />
        </Button>

        <span className="text-sm font-medium min-w-[3rem] text-center">{zoom}%</span>

        <Button variant="ghost" size="sm" onClick={handleZoomIn} disabled={zoom >= 200} className="h-8 w-8 p-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </main>
  )
}
