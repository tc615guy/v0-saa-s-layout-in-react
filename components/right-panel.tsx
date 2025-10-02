"use client"

import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface RightPanelProps {
  selectedItem: any
  onChangeProperty: (property: string, value: any) => void
}

const validateEighthInch = (value: number): boolean => {
  const remainder = (value * 8) % 1
  return Math.abs(remainder) < 0.001 // Account for floating point precision
}

const roundToEighthInch = (value: number): number => {
  return Math.round(value * 8) / 8
}

export function RightPanel({ selectedItem, onChangeProperty }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<"properties" | "warnings" | "dimensions">("properties")

  const tabs = [
    { id: "properties", label: "Properties" },
    { id: "warnings", label: "Warnings" },
    { id: "dimensions", label: "Dimensions" },
  ]

  const elementType = selectedItem?.type || "cabinet"
  const cabinetSubtype = selectedItem?.subtype || "base"
  const isBaseCabinet = cabinetSubtype === "base"
  const isWallCabinet = cabinetSubtype === "wall"
  const isTallCabinet = cabinetSubtype === "tall"

  const handleDimensionChange = (property: string, value: string) => {
    const numValue = Number.parseFloat(value)
    if (!isNaN(numValue)) {
      const rounded = roundToEighthInch(numValue)
      onChangeProperty(property, rounded)
    }
  }

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
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!selectedItem ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-sm">No item selected</p>
            <p className="text-xs mt-2">Select an element from the canvas to edit its properties</p>
          </div>
        ) : (
          <>
            {activeTab === "properties" && (
              <div className="space-y-4">
                <div className="rounded-lg bg-secondary border border-border p-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Type: <span className="text-foreground capitalize">{elementType}</span>
                    {elementType === "cabinet" && (
                      <span className="ml-2">
                        • <span className="capitalize">{cabinetSubtype}</span>
                      </span>
                    )}
                  </p>
                </div>

                {elementType === "wall" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="wall-length">Length (inches)</Label>
                      <Input
                        id="wall-length"
                        type="number"
                        defaultValue={96}
                        step={0.125}
                        onChange={(e) => handleDimensionChange("length", e.target.value)}
                        className="bg-background border-border"
                      />
                      <p className="text-xs text-muted-foreground">Custom length in 1/8" increments</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wall-thickness">Thickness (inches)</Label>
                      <Input
                        id="wall-thickness"
                        type="number"
                        defaultValue={6}
                        step={0.125}
                        onChange={(e) => handleDimensionChange("thickness", e.target.value)}
                        className="bg-background border-border"
                      />
                      <p className="text-xs text-muted-foreground">Standard: 4.5" (interior), 6" (exterior)</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wall-type">Wall Type</Label>
                      <Select defaultValue="interior" onValueChange={(value) => onChangeProperty("wallType", value)}>
                        <SelectTrigger id="wall-type" className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interior">Interior</SelectItem>
                          <SelectItem value="exterior">Exterior</SelectItem>
                          <SelectItem value="load-bearing">Load Bearing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {elementType === "door" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="door-width">Width (inches)</Label>
                      <Input
                        id="door-width"
                        type="number"
                        defaultValue={36}
                        step={0.125}
                        onChange={(e) => handleDimensionChange("width", e.target.value)}
                        className="bg-background border-border"
                      />
                      <p className="text-xs text-muted-foreground">Custom width in 1/8" increments</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="door-height">Height (inches)</Label>
                      <Input
                        id="door-height"
                        type="number"
                        defaultValue={80}
                        step={0.125}
                        onChange={(e) => handleDimensionChange("height", e.target.value)}
                        className="bg-background border-border"
                      />
                      <p className="text-xs text-muted-foreground">Custom height in 1/8" increments</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="door-swing">Swing Direction</Label>
                      <Select defaultValue="inward-left" onValueChange={(value) => onChangeProperty("swing", value)}>
                        <SelectTrigger id="door-swing" className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inward-left">Inward Left</SelectItem>
                          <SelectItem value="inward-right">Inward Right</SelectItem>
                          <SelectItem value="outward-left">Outward Left</SelectItem>
                          <SelectItem value="outward-right">Outward Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="door-type">Door Type</Label>
                      <Select defaultValue="single" onValueChange={(value) => onChangeProperty("doorType", value)}>
                        <SelectTrigger id="door-type" className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="double">Double</SelectItem>
                          <SelectItem value="sliding">Sliding</SelectItem>
                          <SelectItem value="pocket">Pocket</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {elementType === "window" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="window-width">Width (inches)</Label>
                      <Input
                        id="window-width"
                        type="number"
                        defaultValue={36}
                        step={0.125}
                        onChange={(e) => handleDimensionChange("width", e.target.value)}
                        className="bg-background border-border"
                      />
                      <p className="text-xs text-muted-foreground">Custom width in 1/8" increments</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="window-height">Height (inches)</Label>
                      <Input
                        id="window-height"
                        type="number"
                        defaultValue={48}
                        step={0.125}
                        onChange={(e) => handleDimensionChange("height", e.target.value)}
                        className="bg-background border-border"
                      />
                      <p className="text-xs text-muted-foreground">Custom height in 1/8" increments</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sill-height">Sill Height (inches)</Label>
                      <Input
                        id="sill-height"
                        type="number"
                        defaultValue={36}
                        step={0.125}
                        onChange={(e) => handleDimensionChange("sillHeight", e.target.value)}
                        className="bg-background border-border"
                      />
                      <p className="text-xs text-muted-foreground">Height from floor to bottom of window</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="window-type">Window Type</Label>
                      <Select
                        defaultValue="single-hung"
                        onValueChange={(value) => onChangeProperty("windowType", value)}
                      >
                        <SelectTrigger id="window-type" className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single-hung">Single Hung</SelectItem>
                          <SelectItem value="double-hung">Double Hung</SelectItem>
                          <SelectItem value="casement">Casement</SelectItem>
                          <SelectItem value="sliding">Sliding</SelectItem>
                          <SelectItem value="bay">Bay</SelectItem>
                          <SelectItem value="picture">Picture</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {elementType === "cabinet" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="width">Width (inches)</Label>
                      <Input
                        id="width"
                        type="number"
                        defaultValue={30}
                        step={3}
                        onChange={(e) => handleDimensionChange("width", e.target.value)}
                        className="bg-background border-border"
                      />
                      <p className="text-xs text-muted-foreground">
                        {isBaseCabinet && '9"-42" in 3" increments'}
                        {isWallCabinet && '12"-36" in 3" increments'}
                        {isTallCabinet && '18"-36" in 3" increments'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="depth">Depth (inches)</Label>
                      {isBaseCabinet ? (
                        <>
                          <Input
                            id="depth"
                            type="number"
                            defaultValue={24}
                            step={0.125}
                            onChange={(e) => handleDimensionChange("depth", e.target.value)}
                            className="bg-background border-border"
                          />
                          <p className="text-xs text-muted-foreground">Standard base cabinet depth: 24"</p>
                        </>
                      ) : (
                        <>
                          <Select
                            defaultValue={isWallCabinet ? "12" : "24"}
                            onValueChange={(value) => onChangeProperty("depth", Number.parseFloat(value))}
                          >
                            <SelectTrigger id="depth" className="bg-background border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {isWallCabinet && (
                                <>
                                  <SelectItem value="12">12" (Standard)</SelectItem>
                                  <SelectItem value="24">24" (Deep)</SelectItem>
                                </>
                              )}
                              {isTallCabinet && (
                                <>
                                  <SelectItem value="24">24" (Standard)</SelectItem>
                                  <SelectItem value="12">12" (Tight Spaces)</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {isWallCabinet && 'Standard: 12", Deep: 24"'}
                            {isTallCabinet && 'Standard: 24", Tight spaces: 12"'}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="height">Height (inches)</Label>
                      {isBaseCabinet ? (
                        <>
                          <Input
                            id="height"
                            type="number"
                            defaultValue={34.5}
                            step={0.125}
                            onChange={(e) => handleDimensionChange("height", e.target.value)}
                            className="bg-background border-border"
                          />
                          <p className="text-xs text-muted-foreground">Standard base cabinet height: 34.5"</p>
                        </>
                      ) : isWallCabinet ? (
                        <>
                          <Select
                            defaultValue="36"
                            onValueChange={(value) => onChangeProperty("height", Number.parseFloat(value))}
                          >
                            <SelectTrigger id="height" className="bg-background border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">30"</SelectItem>
                              <SelectItem value="36">36"</SelectItem>
                              <SelectItem value="42">42"</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Standard wall cabinet heights</p>
                        </>
                      ) : isTallCabinet ? (
                        <>
                          <Select
                            defaultValue="90"
                            onValueChange={(value) => onChangeProperty("height", Number.parseFloat(value))}
                          >
                            <SelectTrigger id="height" className="bg-background border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="84">84" (with 30" wall cabinets)</SelectItem>
                              <SelectItem value="90">90" (with 36" wall cabinets)</SelectItem>
                              <SelectItem value="96">96" (with 42" wall cabinets)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Standard tall cabinet heights</p>
                        </>
                      ) : (
                        <>
                          <Input
                            id="height"
                            type="number"
                            defaultValue={30}
                            step={0.125}
                            onChange={(e) => handleDimensionChange("height", e.target.value)}
                            className="bg-background border-border"
                          />
                          <p className="text-xs text-muted-foreground">Custom height in 1/8" increments</p>
                        </>
                      )}
                    </div>

                    {isBaseCabinet && (
                      <div className="space-y-2">
                        <Label htmlFor="toe-kick">Toe Kick Height (inches)</Label>
                        <Input
                          id="toe-kick"
                          type="number"
                          defaultValue={4.5}
                          step={0.125}
                          onChange={(e) => handleDimensionChange("toeKick", e.target.value)}
                          className="bg-background border-border"
                        />
                        <p className="text-xs text-muted-foreground">Standard toe kick: 4.5"</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="hinge">Hinge Side</Label>
                      <Select defaultValue="left" onValueChange={(value) => onChangeProperty("hinge", value)}>
                        <SelectTrigger id="hinge" className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="rotation">Rotation</Label>
                  <Select defaultValue="0" onValueChange={(value) => onChangeProperty("rotation", value)}>
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

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder={`Add notes about this ${elementType}...`}
                    onChange={(e) => onChangeProperty("notes", e.target.value)}
                    className="bg-background border-border min-h-[80px]"
                  />
                </div>

                {elementType === "cabinet" && isBaseCabinet && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                    <div className="flex gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-500">
                        <p className="font-medium mb-1">Base Cabinet Standards</p>
                        <p>34.5" H • 24" D • 4.5" toe kick • 9"-42" W (3" increments)</p>
                      </div>
                    </div>
                  </div>
                )}

                {elementType === "cabinet" && isWallCabinet && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                    <div className="flex gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-500">
                        <p className="font-medium mb-1">Wall Cabinet Standards</p>
                        <p>30"/36"/42" H • 12"/24" D • 12"-36" W (3" increments)</p>
                      </div>
                    </div>
                  </div>
                )}

                {elementType === "cabinet" && isTallCabinet && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                    <div className="flex gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-500">
                        <p className="font-medium mb-1">Tall Cabinet Standards</p>
                        <p>84"/90"/96" H • 24"/12" D • 18"-36" W (3" increments)</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "warnings" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-medium text-yellow-500 mb-1">Non-standard width</p>
                      <p className="text-muted-foreground">Current width (31") doesn't match allowed values</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-medium text-red-500 mb-1">Collision detected</p>
                      <p className="text-muted-foreground">This element overlaps with adjacent item</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "dimensions" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Width</Label>
                    <p className="text-sm font-medium">30"</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {elementType === "wall" ? "Length" : "Depth"}
                    </Label>
                    <p className="text-sm font-medium">24"</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Height</Label>
                    <p className="text-sm font-medium">34.5"</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Area</Label>
                    <p className="text-sm font-medium">720 in²</p>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <h3 className="text-sm font-medium">Position</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">X</Label>
                      <p className="text-sm font-medium">120"</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Y</Label>
                      <p className="text-sm font-medium">0"</p>
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
