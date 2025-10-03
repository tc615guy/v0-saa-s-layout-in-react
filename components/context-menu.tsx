"use client"

import { useState, useEffect, useRef } from "react"
import { RotateCw, RotateCcw, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ContextMenuProps {
  x: number
  y: number
  visible: boolean
  onClose: () => void
  onRotate: (degrees: number) => void
  onMove: (direction: 'left' | 'right' | 'up' | 'down', distance: number) => void
  onDelete?: () => void
  onZoomExtent: () => void
  onZoomDefault: () => void
  currentRotation: number
  instanceId: string
}

export function ContextMenu({ x, y, visible, onClose, onRotate, onMove, onDelete, onZoomExtent, onZoomDefault, currentRotation, instanceId }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [customDistance, setCustomDistance] = useState("1")

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [visible, onClose])

  if (!visible) return null

  const rotationOptions = [
    { degrees: 0, label: "0°" },
    { degrees: 15, label: "15°" },
    { degrees: 30, label: "30°" },
    { degrees: 45, label: "45°" },
    { degrees: 60, label: "60°" },
    { degrees: 90, label: "90°" },
    { degrees: 120, label: "120°" },
    { degrees: 135, label: "135°" },
    { degrees: 150, label: "150°" },
    { degrees: 180, label: "180°" },
    { degrees: 210, label: "210°" },
    { degrees: 225, label: "225°" },
    { degrees: 270, label: "270°" },
    { degrees: 315, label: "315°" },
    { degrees: 330, label: "330°" },
    { degrees: 345, label: "345°" },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-popover border border-border rounded-md shadow-lg p-2 min-w-[120px]"
      style={{
        left: x,
        top: y,
      }}
    >
      {/* Close button */}
      <div className="flex justify-end mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 hover:bg-muted"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      {instanceId ? (
        // Instance context menu (rotation and movement)
        <>
          {/* Delete button - prominently placed at top */}
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="w-full justify-start text-xs h-8 mb-2"
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Delete Object
            </Button>
          )}
          
          <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
            Rotate ({currentRotation}°)
          </div>
          
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRotate(currentRotation - 15)}
              className="w-full justify-start text-xs h-7"
            >
              <RotateCcw className="h-3 w-3 mr-2" />
              -15°
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRotate(currentRotation + 15)}
              className="w-full justify-start text-xs h-7"
            >
              <RotateCw className="h-3 w-3 mr-2" />
              +15°
            </Button>
          </div>

          <div className="border-t border-border my-2" />

          <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
            Preset Angles
          </div>
          
          <div className="grid grid-cols-3 gap-1">
            {rotationOptions.map((option) => (
              <Button
                key={option.degrees}
                variant={currentRotation === option.degrees ? "default" : "ghost"}
                size="sm"
                onClick={() => onRotate(option.degrees)}
                className="text-xs h-7"
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="border-t border-border my-2" />

          <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
            Move (inches)
          </div>
          
          <div className="grid grid-cols-2 gap-1 mb-2">
            <Button variant="outline" size="sm" onClick={() => onMove('left', 1)} className="h-7 text-xs">← 1"</Button>
            <Button variant="outline" size="sm" onClick={() => onMove('right', 1)} className="h-7 text-xs">1" →</Button>
            <Button variant="outline" size="sm" onClick={() => onMove('up', 1)} className="h-7 text-xs">↑ 1"</Button>
            <Button variant="outline" size="sm" onClick={() => onMove('down', 1)} className="h-7 text-xs">1" ↓</Button>
          </div>
          
          <div className="grid grid-cols-2 gap-1 mb-2">
            <Button variant="outline" size="sm" onClick={() => onMove('left', 6)} className="h-7 text-xs">← 6"</Button>
            <Button variant="outline" size="sm" onClick={() => onMove('right', 6)} className="h-7 text-xs">6" →</Button>
            <Button variant="outline" size="sm" onClick={() => onMove('up', 6)} className="h-7 text-xs">↑ 6"</Button>
            <Button variant="outline" size="sm" onClick={() => onMove('down', 6)} className="h-7 text-xs">6" ↓</Button>
          </div>
          
          <div className="border-t border-border my-1" />
          
          <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
            Custom Move
          </div>
          
          <div className="px-2 mb-2">
            <Input
              type="number"
              step="0.125"
              min="0"
              max="100"
              value={customDistance}
              onChange={(e) => setCustomDistance(e.target.value)}
              placeholder="Distance"
              className="h-7 text-xs"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-1 mb-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onMove('left', parseFloat(customDistance) || 0)} 
              className="h-7 text-xs"
            >
              ← {customDistance}"
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onMove('right', parseFloat(customDistance) || 0)} 
              className="h-7 text-xs"
            >
              {customDistance}" →
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onMove('up', parseFloat(customDistance) || 0)} 
              className="h-7 text-xs"
            >
              ↑ {customDistance}"
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onMove('down', parseFloat(customDistance) || 0)} 
              className="h-7 text-xs"
            >
              {customDistance}" ↓
            </Button>
          </div>
        </>
      ) : (
        // Empty space context menu (zoom options)
        <>
          <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
            Zoom
          </div>
          
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomExtent}
              className="w-full justify-start text-xs h-7"
            >
              Zoom Extent
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomDefault}
              className="w-full justify-start text-xs h-7"
            >
              Zoom Default
            </Button>
          </div>
        </>
      )}
    </div>
  )
}