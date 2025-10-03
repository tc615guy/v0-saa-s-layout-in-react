"use client"

import { useState, useEffect } from "react"
import { AlertCircle, RotateCcw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"
import { getTemplateById } from "@/lib/catalog"
import { evalWarnings } from "@/lib/rules"
import { fmtInches, parseInches, clampToAllowed } from "@/lib/units"
import { Instance, Template } from "@/lib/types"

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<"properties" | "warnings" | "dimensions">("properties")
  
  const { 
    instances, 
    templates, 
    selectedIds, 
    updateInstance, 
    room 
  } = useAppStore()
  
  const selectedInstance = selectedIds.length === 1 
    ? instances.find(i => i.id === selectedIds[0])
    : null
  
  const template = selectedInstance 
    ? getTemplateById(templates, selectedInstance.templateId)
    : null
  
  const warnings = evalWarnings(useAppStore.getState())

  const tabs = [
    { id: "properties", label: "Properties" },
    { id: "warnings", label: "Warnings" },
    { id: "dimensions", label: "Dimensions" },
  ]

  const handleDimensionChange = (property: string, value: string) => {
    if (!selectedInstance) return
    
    const numValue = parseInches(value)
    if (isNaN(numValue)) return
    
    // Clamp to allowed values if template has restrictions
    let clampedValue = numValue
    if (template?.allowedWidthsIn && property === 'widthIn') {
      clampedValue = clampToAllowed(numValue, template.allowedWidthsIn)
    }
    
    updateInstance(selectedInstance.id, { [property]: clampedValue })
  }

  const cycleWidth = (direction: number) => {
    if (!selectedInstance || !template?.allowedWidthsIn) return

    const currentWidth = selectedInstance.widthIn || 0
    const allowedWidths = template.allowedWidthsIn
    const currentIndex = allowedWidths.indexOf(currentWidth)
    
    if (currentIndex === -1) return // Current width not in allowed list

    const newIndex = currentIndex + direction
    if (newIndex >= 0 && newIndex < allowedWidths.length) {
      updateInstance(selectedInstance.id, { widthIn: allowedWidths[newIndex] })
    }
  }

  const canDecreaseWidth = template?.allowedWidthsIn && selectedInstance && 
    template.allowedWidthsIn.indexOf(selectedInstance.widthIn || 0) > 0

  const canIncreaseWidth = template?.allowedWidthsIn && selectedInstance && 
    template.allowedWidthsIn.indexOf(selectedInstance.widthIn || 0) < template.allowedWidthsIn.length - 1

  const handleOptionChange = (option: string, value: string) => {
    if (!selectedInstance) return
    
    const updates: any = {
      options: {
        ...selectedInstance.options,
        [option]: value
      }
    }
    
    // If top alignment changed, recalculate Y position
    if (option === 'topAlignment' && template?.category === 'wall') {
      const topAlignment = parseFloat(value)
      const newY = topAlignment - (selectedInstance.heightIn || 0)
      updates.y = newY
    }
    
    updateInstance(selectedInstance.id, updates)
  }

  const handleRotationChange = (value: string) => {
    if (!selectedInstance) return
    
    updateInstance(selectedInstance.id, {
      rot: parseInt(value) as 0 | 90 | 180 | 270
    })
  }

  const handleNotesChange = (value: string) => {
    if (!selectedInstance) return
    
    updateInstance(selectedInstance.id, {
      options: {
        ...selectedInstance.options,
        notes: value
      }
    })
  }

  const instanceWarnings = warnings.filter(w => w.instanceId === selectedInstance?.id)

  return (
    <aside className="w-80 border-l border-border bg-card flex flex-col">
      <div className="border-b border-border">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.id === "warnings" && instanceWarnings.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-4 h-4 text-xs bg-red-500 text-white rounded-full">
                  {instanceWarnings.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!selectedInstance ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-sm">No item selected</p>
            <p className="text-xs mt-2">Select an element from the canvas to edit its properties</p>
          </div>
        ) : (
          <>
            {activeTab === "properties" && (
              <div className="space-y-4">
                <div className="rounded-lg bg-secondary border border-border p-3">
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    {selectedInstance.derived.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {template?.category} • SKU: {selectedInstance.derived.sku}
                  </p>
                </div>

                {/* Width/Length */}
                <div className="space-y-2">
                  <Label htmlFor="width">
                    {template?.category === 'room' && template?.id.startsWith('WALL') ? 'Length' : 'Width'} (inches)
                  </Label>
                  {template?.allowedWidthsIn ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cycleWidth(-1)}
                        disabled={!canDecreaseWidth}
                        className="h-8 w-8 p-0"
                      >
                        -
                      </Button>
                      <Input
                        id="width"
                        type="text"
                        value={fmtInches(selectedInstance.widthIn || 0)}
                        onChange={(e) => handleDimensionChange("widthIn", e.target.value)}
                        className="bg-background border-border text-center"
                        placeholder="Enter width"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cycleWidth(1)}
                        disabled={!canIncreaseWidth}
                        className="h-8 w-8 p-0"
                      >
                        +
                      </Button>
                    </div>
                  ) : (
                    <Input
                      id="width"
                      type="text"
                      value={fmtInches(selectedInstance.widthIn || 0)}
                      onChange={(e) => handleDimensionChange("widthIn", e.target.value)}
                      className="bg-background border-border"
                      placeholder={`Enter ${template?.category === 'room' && template?.id.startsWith('WALL') ? 'length' : 'width'}`}
                    />
                  )}
                  {template?.allowedWidthsIn && (
                    <p className="text-xs text-muted-foreground">
                      Allowed: {template.allowedWidthsIn.join('", "')}"
                    </p>
                  )}
                </div>

                {/* Height */}
                <div className="space-y-2">
                  <Label htmlFor="height">Height (inches)</Label>
                  <Input
                    id="height"
                    type="text"
                    value={fmtInches(selectedInstance.heightIn || 0)}
                    onChange={(e) => handleDimensionChange("heightIn", e.target.value)}
                    className="bg-background border-border"
                    placeholder="Enter height"
                  />
                  {template?.allowedHeightsIn && (
                    <p className="text-xs text-muted-foreground">
                      Allowed: {template.allowedHeightsIn.join('", "')}"
                    </p>
                  )}
                </div>

                {/* Depth */}
                <div className="space-y-2">
                  <Label htmlFor="depth">Depth (inches)</Label>
                  <Input
                    id="depth"
                    type="text"
                    value={fmtInches(selectedInstance.depthIn || 0)}
                    onChange={(e) => handleDimensionChange("depthIn", e.target.value)}
                    className="bg-background border-border"
                    placeholder="Enter depth"
                  />
                  {template?.allowedDepthsIn && (
                    <p className="text-xs text-muted-foreground">
                      Allowed: {template.allowedDepthsIn.join('", "')}"
                    </p>
                  )}
                </div>

                {/* Rotation */}
                <div className="space-y-2">
                  <Label htmlFor="rotation">Rotation</Label>
                  <Select 
                    value={selectedInstance.rot.toString()} 
                    onValueChange={handleRotationChange}
                  >
                    <SelectTrigger id="rotation" className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0°</SelectItem>
                      <SelectItem value="90">90°</SelectItem>
                      <SelectItem value="180">180°</SelectItem>
                      <SelectItem value="270">270°</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Hinge (if template has hinge options) */}
                {template?.options?.hinge && (
                  <div className="space-y-2">
                    <Label htmlFor="hinge">Hinge Side</Label>
                    <Select 
                      value={selectedInstance.options.hinge || template.options.hinge[0]} 
                      onValueChange={(value) => handleOptionChange("hinge", value)}
                    >
                      <SelectTrigger id="hinge" className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {template.options.hinge.map(option => (
                          <SelectItem key={option} value={option}>
                            {option === 'L' ? 'Left' : 'Right'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Top Alignment (for wall cabinets) */}
                {template?.options?.topAlignment && (
                  <div className="space-y-2">
                    <Label htmlFor="topAlignment">Top Alignment</Label>
                    <Select 
                      value={selectedInstance.options.topAlignment || template.options.topAlignment[1]} 
                      onValueChange={(value) => handleOptionChange("topAlignment", value)}
                    >
                      <SelectTrigger id="topAlignment" className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {template.options.topAlignment.map(option => (
                          <SelectItem key={option} value={option}>
                            {option}"
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Height from floor to top of cabinet
                    </p>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add notes about this item..."
                    value={selectedInstance.options.notes || ''}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    className="bg-background border-border min-h-[80px]"
                  />
                </div>

                {/* Template info */}
                {template && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                    <div className="flex gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-500">
                        <p className="font-medium mb-1">{template.category} Cabinet Standards</p>
                        <p>
                          {template.heightIn}" H • {template.depthIn}" D
                          {template.allowedWidthsIn && ` • ${template.allowedWidthsIn.join('", "')}" W`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "warnings" && (
              <div className="space-y-3">
                {instanceWarnings.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">No warnings</p>
                    <p className="text-xs mt-1">This item meets all design standards</p>
                  </div>
                ) : (
                  instanceWarnings.map((warning, index) => (
                    <div 
                      key={index}
                      className={`rounded-lg border p-3 ${
                        warning.code.includes('CONFLICT') || warning.code.includes('DISTANCE')
                          ? 'bg-red-500/10 border-red-500/20'
                          : 'bg-yellow-500/10 border-yellow-500/20'
                      }`}
                    >
                      <div className="flex gap-2">
                        <AlertCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                          warning.code.includes('CONFLICT') || warning.code.includes('DISTANCE')
                            ? 'text-red-500'
                            : 'text-yellow-500'
                        }`} />
                        <div className="text-xs">
                          <p className={`font-medium mb-1 ${
                            warning.code.includes('CONFLICT') || warning.code.includes('DISTANCE')
                              ? 'text-red-500'
                              : 'text-yellow-500'
                          }`}>
                            {warning.code.replace(/_/g, ' ')}
                          </p>
                          <p className="text-muted-foreground">{warning.message}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "dimensions" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Width</Label>
                    <p className="text-sm font-medium">{fmtInches(selectedInstance.widthIn || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Height</Label>
                    <p className="text-sm font-medium">{fmtInches(selectedInstance.heightIn || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Depth</Label>
                    <p className="text-sm font-medium">{fmtInches(selectedInstance.depthIn || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Area</Label>
                    <p className="text-sm font-medium">
                      {Math.round((selectedInstance.widthIn || 0) * (selectedInstance.heightIn || 0))} in²
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <h3 className="text-sm font-medium">Position</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">X</Label>
                      <p className="text-sm font-medium">{fmtInches(selectedInstance.x)}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Y</Label>
                      <p className="text-sm font-medium">{fmtInches(selectedInstance.y)}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <h3 className="text-sm font-medium">Room Info</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Ceiling Height</Label>
                      <p className="text-sm font-medium">{fmtInches(room.ceilingHeightIn)}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Plumbing</Label>
                      <p className="text-sm font-medium">
                        {fmtInches(room.plumbing.x)}, {fmtInches(room.plumbing.y)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}