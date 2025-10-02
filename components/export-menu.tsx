"use client"

import { FileText, Table, Share2 } from "lucide-react"
import { useEffect, useRef } from "react"

interface ExportMenuProps {
  onClose: () => void
  onExport: (type: string) => void
}

export function ExportMenu({ onClose, onExport }: ExportMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  const exportOptions = [
    {
      id: "pdf",
      label: "Plan PDF",
      description: "Export layout as PDF document",
      icon: FileText,
    },
    {
      id: "csv",
      label: "BOM CSV",
      description: "Bill of materials spreadsheet",
      icon: Table,
    },
    {
      id: "link",
      label: "Share Link",
      description: "Generate shareable link",
      icon: Share2,
    },
  ]

  return (
    <div
      ref={menuRef}
      className="absolute top-full left-0 mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50"
    >
      {exportOptions.map((option) => {
        const Icon = option.icon
        return (
          <button
            key={option.id}
            onClick={() => onExport(option.label)}
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
          >
            <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{option.label}</p>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
