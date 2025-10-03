"use client"

import { useState } from "react"
import { FileText, FolderOpen, Save, Download, Undo, Redo, Grid3x3, Ruler, ChevronDown, Maximize2, Square, Move, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExportMenu } from "@/components/export-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAppStore } from "@/lib/store"
import { savePlan, loadPlan, exportPlanAsJSON, importPlanFromJSON } from "@/lib/persist"
import { exportCompleteBOM, exportPlanPDF, getCanvasDataURL } from "@/lib/export"
import { fmtInches } from "@/lib/units"

export function TopToolbar() {
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null)
  
  const { 
    ui, 
    instances, 
    templates, 
    room, 
    toggleSnap, 
    toggleRulers, 
    setMode,
    setDimensioningMode,
    updateRoom, 
    undo, 
    redo 
  } = useAppStore()

  const handleNewProject = () => {
    if (confirm("Are you sure you want to start a new project? All unsaved changes will be lost.")) {
      // Reset store to initial state
      useAppStore.setState({
        instances: [],
        walls: [],
        selectedIds: [],
        undoStack: [],
        redoStack: []
      })
    }
  }

  const handleSaveProject = () => {
    const state = useAppStore.getState()
    savePlan(state)
    // TODO: Show toast notification
  }

  const handleLoadProject = () => {
    const loadedPlan = loadPlan()
    if (loadedPlan) {
      useAppStore.setState(loadedPlan)
      // TODO: Show toast notification
    }
  }

  const handleExportBOM = () => {
    exportCompleteBOM(instances, templates)
  }

  const handleExportPDF = async () => {
    // Get canvas data URL from Konva stage
    const stage = document.querySelector('canvas')
    if (stage) {
      const dataURL = stage.toDataURL('image/png')
      await exportPlanPDF(dataURL, {
        projectName: 'CabSketch Plan',
        date: new Date().toLocaleDateString(),
        scale: '1" = 1"'
      })
    }
  }

  const handleExportJSON = () => {
    const state = useAppStore.getState()
    exportPlanAsJSON(state)
  }

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      importPlanFromJSON(file)
        .then(importedState => {
          useAppStore.setState(importedState)
          // TODO: Show toast notification
        })
        .catch(error => {
          console.error('Import failed:', error)
          // TODO: Show error toast
        })
    }
  }

  const handleCeilingHeightChange = (value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      updateRoom({ ceilingHeightIn: numValue })
    }
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold mr-4">Cabinet Designer</h1>

          <Button variant="ghost" size="sm" onClick={handleNewProject} className="gap-2">
            <FileText className="h-4 w-4" />
            New
          </Button>

          <Button variant="ghost" size="sm" onClick={handleLoadProject} className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Open
          </Button>

          <Button variant="ghost" size="sm" onClick={handleSaveProject} className="gap-2">
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
                  switch (type) {
                    case 'bom':
                      handleExportBOM()
                      break
                    case 'pdf':
                      handleExportPDF()
                      break
                    case 'json':
                      handleExportJSON()
                      break
                  }
                  setExportMenuOpen(false)
                }}
              />
            )}
          </div>

          <div className="w-px h-6 bg-border mx-2" />

          <Button variant="ghost" size="sm" onClick={undo} className="gap-2">
            <Undo className="h-4 w-4" />
            Undo
          </Button>

          <Button variant="ghost" size="sm" onClick={redo} className="gap-2">
            <Redo className="h-4 w-4" />
            Redo
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Maximize2 className="h-4 w-4" />
                Ceiling: {fmtInches(room.ceilingHeightIn)}"
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ceiling-height">Ceiling Height (inches)</Label>
                  <Input
                    id="ceiling-height"
                    type="number"
                    value={room.ceilingHeightIn}
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
            variant={ui.mode === 'select' ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode('select')}
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Select
          </Button>

          <Button
            variant={ui.mode === 'dimension' ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setMode('dimension')
              setDimensioningMode('linear')
            }}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            Dimension
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button
            variant={ui.snap ? "default" : "ghost"}
            size="sm"
            onClick={toggleSnap}
            className="gap-2"
          >
            <Grid3x3 className="h-4 w-4" />
            Snap
          </Button>

          <Button
            variant={ui.rulers ? "default" : "ghost"}
            size="sm"
            onClick={toggleRulers}
            className="gap-2"
          >
            <Ruler className="h-4 w-4" />
            Rulers
          </Button>
        </div>
      </div>
      
      {/* Hidden file input for JSON import */}
      <input
        ref={setFileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportJSON}
        style={{ display: 'none' }}
      />
    </header>
  )
}
