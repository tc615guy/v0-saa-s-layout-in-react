"use client"

import { useState } from "react"
import { FileText, FolderOpen, Save, Download, Undo, Redo, Grid3x3, Ruler, ChevronDown, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExportMenu } from "@/components/export-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface TopToolbarProps {
  onAction: (action: string) => void
  ceilingHeight?: number
  onCeilingHeightChange?: (height: number) => void
}

export function TopToolbar({ onAction, ceilingHeight = 96, onCeilingHeightChange }: TopToolbarProps) {
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [rulersEnabled, setRulersEnabled] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  const handleCeilingHeightChange = (value: string) => {
    const numValue = Number.parseFloat(value)
    if (!isNaN(numValue)) {
      const rounded = Math.round(numValue * 8) / 8
      onCeilingHeightChange?.(rounded)
    }
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold mr-4">Cabinet Designer</h1>

          <Button variant="ghost" size="sm" onClick={() => onAction("New project")} className="gap-2">
            <FileText className="h-4 w-4" />
            New
          </Button>

          <Button variant="ghost" size="sm" onClick={() => onAction("Opened project")} className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Open
          </Button>

          <Button variant="ghost" size="sm" onClick={() => onAction("Saved project")} className="gap-2">
            <Save className="h-4 w-4" />
            Save
          </Button>

          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setExportMenuOpen(!exportMenuOpen)} className="gap-2">
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-3 w-3" />
            </Button>

            {exportMenuOpen && (
              <ExportMenu
                onClose={() => setExportMenuOpen(false)}
                onExport={(type) => {
                  onAction(`Exported ${type}`)
                  setExportMenuOpen(false)
                }}
              />
            )}
          </div>

          <div className="w-px h-6 bg-border mx-2" />

          <Button variant="ghost" size="sm" onClick={() => onAction("Undo")} className="gap-2">
            <Undo className="h-4 w-4" />
            Undo
          </Button>

          <Button variant="ghost" size="sm" onClick={() => onAction("Redo")} className="gap-2">
            <Redo className="h-4 w-4" />
            Redo
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Maximize2 className="h-4 w-4" />
                Ceiling: {ceilingHeight}"
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ceiling-height">Ceiling Height (inches)</Label>
                  <Input
                    id="ceiling-height"
                    type="number"
                    value={ceilingHeight}
                    onChange={(e) => handleCeilingHeightChange(e.target.value)}
                    className="bg-background border-border"
                    min={84}
                    max={144}
                    step={0.125}
                  />
                  <p className="text-xs text-muted-foreground">Custom height in 1/8" increments</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-6 bg-border mx-1" />

          <Button
            variant={snapEnabled ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setSnapEnabled(!snapEnabled)
              onAction(snapEnabled ? "Snap disabled" : "Snap enabled")
            }}
            className="gap-2"
          >
            <Grid3x3 className="h-4 w-4" />
            Snap
          </Button>

          <Button
            variant={rulersEnabled ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setRulersEnabled(!rulersEnabled)
              onAction(rulersEnabled ? "Rulers hidden" : "Rulers shown")
            }}
            className="gap-2"
          >
            <Ruler className="h-4 w-4" />
            Rulers
          </Button>
        </div>
      </div>
    </header>
  )
}
