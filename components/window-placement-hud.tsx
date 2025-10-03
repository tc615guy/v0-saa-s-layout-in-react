"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Check } from "lucide-react"

interface WindowPlacementHUDProps {
  visible: boolean
  wallId: string
  wallLength: number
  currentWindowWidth?: number // Add current window width prop
  onPlace: (options: WindowPlacementOptions) => void
  onCancel: () => void
  onPreviewChange?: (options: WindowPlacementOptions) => void
}

interface WindowPlacementOptions {
  width: number
  positionType: 'from-left' | 'from-right' | 'center'
  distance: number
}

export function WindowPlacementHUD({ visible, wallId, wallLength, currentWindowWidth, onPlace, onCancel, onPreviewChange }: WindowPlacementHUDProps) {
  const [width, setWidth] = useState(36)
  const [positionType, setPositionType] = useState<'from-left' | 'from-right' | 'center'>('center')
  const [distance, setDistance] = useState(0)

  // Reset form when wall changes
  useEffect(() => {
    if (visible) {
      // Use current window width if provided, otherwise default to 36
      setWidth(currentWindowWidth || 36)
      setPositionType('center')
      setDistance(0)
    }
  }, [visible, wallId, currentWindowWidth])

  // Memoize the preview options to prevent unnecessary re-renders
  const previewOptions = useCallback(() => ({
    width,
    positionType,
    distance
  }), [width, positionType, distance])

  // Notify parent of preview changes with debouncing
  useEffect(() => {
    if (visible && onPreviewChange) {
      const timeoutId = setTimeout(() => {
        onPreviewChange(previewOptions())
      }, 100) // Debounce by 100ms
      
      return () => clearTimeout(timeoutId)
    }
  }, [visible, previewOptions, onPreviewChange])

  const handlePlace = () => {
    console.log('Place Window button clicked with values:', {
      width,
      positionType,
      distance,
      wallLength,
      maxDistance: getMaxDistance()
    })
    
    // Validate the distance is within bounds
    if (distance > getMaxDistance()) {
      console.error('Distance exceeds maximum allowed:', distance, '>', getMaxDistance())
      return
    }
    
    onPlace({
      width,
      positionType,
      distance
    })
  }
  
  // Check if the current settings are valid
  const isValidPlacement = () => {
    return distance >= 0 && distance <= getMaxDistance() && width > 0
  }

  const getMaxDistance = () => {
    switch (positionType) {
      case 'from-left':
        // Maximum distance is wall length minus window width
        return Math.max(0, wallLength - width)
      case 'from-right':
        // Maximum distance is wall length minus window width
        return Math.max(0, wallLength - width)
      case 'center':
        // For center positioning, allow offset in both directions
        // Maximum offset is half the remaining space after window width
        return Math.max(0, (wallLength - width) / 2)
      default:
        return 0
    }
  }

  const getDistanceLabel = () => {
    switch (positionType) {
      case 'from-left':
        return 'Distance from left end (inches)'
      case 'from-right':
        return 'Distance from right end (inches)'
      case 'center':
        return 'Distance from wall center (inches)'
      default:
        return 'Distance (inches)'
    }
  }

  const getDistanceHelp = () => {
    switch (positionType) {
      case 'from-left':
        return `Max: ${getMaxDistance()}"`
      case 'from-right':
        return `Max: ${getMaxDistance()}"`
      case 'center':
        return `Max: ${Math.floor(getMaxDistance() / 2)}" each direction`
      default:
        return ''
    }
  }

  if (!visible) return null

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-popover border border-border rounded-lg shadow-lg p-4 min-w-[320px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Window Placement</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Wall Info */}
        <div className="bg-muted p-3 rounded-md">
          <div className="text-sm text-muted-foreground">Wall Length: {wallLength}"</div>
        </div>

        {/* Window Width */}
        <div className="space-y-2">
          <Label htmlFor="width">Window Width (inches)</Label>
          <div className="flex gap-2">
            <Input
              id="width"
              type="number"
              step="0.125"
              min="12"
              max="120"
              value={width}
              onChange={(e) => setWidth(Math.max(12, Math.min(120, parseFloat(e.target.value) || 12)))}
              className="flex-1"
              placeholder="Enter width..."
            />
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWidth(Math.max(12, width - 6))}
                className="px-2"
              >
                -6"
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWidth(Math.min(120, width + 6))}
                className="px-2"
              >
                +6"
              </Button>
            </div>
          </div>
          {/* Common width presets */}
          <div className="flex gap-1 flex-wrap">
            <Button
              variant={width === 24 ? "default" : "outline"}
              size="sm"
              onClick={() => setWidth(24)}
              className="text-xs px-2"
            >
              24"
            </Button>
            <Button
              variant={width === 30 ? "default" : "outline"}
              size="sm"
              onClick={() => setWidth(30)}
              className="text-xs px-2"
            >
              30"
            </Button>
            <Button
              variant={width === 36 ? "default" : "outline"}
              size="sm"
              onClick={() => setWidth(36)}
              className="text-xs px-2"
            >
              36"
            </Button>
            <Button
              variant={width === 42 ? "default" : "outline"}
              size="sm"
              onClick={() => setWidth(42)}
              className="text-xs px-2"
            >
              42"
            </Button>
            <Button
              variant={width === 48 ? "default" : "outline"}
              size="sm"
              onClick={() => setWidth(48)}
              className="text-xs px-2"
            >
              48"
            </Button>
            <Button
              variant={width === 60 ? "default" : "outline"}
              size="sm"
              onClick={() => setWidth(60)}
              className="text-xs px-2"
            >
              60"
            </Button>
          </div>
        </div>

        {/* Position Type */}
        <div className="space-y-2">
          <Label htmlFor="position">Position Reference</Label>
          <Select value={positionType} onValueChange={(value: any) => setPositionType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="from-left">From Left End</SelectItem>
              <SelectItem value="from-right">From Right End</SelectItem>
              <SelectItem value="center">From Wall Center</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Distance */}
        <div className="space-y-2">
          <Label htmlFor="distance">{getDistanceLabel()}</Label>
          <div className="flex gap-2">
            <Input
              id="distance"
              type="number"
              step="0.125"
              min="0"
              max={getMaxDistance()}
              value={distance}
              onChange={(e) => setDistance(Math.max(0, Math.min(getMaxDistance(), parseFloat(e.target.value) || 0)))}
              className="flex-1"
            />
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDistance(Math.max(0, distance - 1))}
                className="px-2"
              >
                -1"
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDistance(Math.min(getMaxDistance(), distance + 1))}
                className="px-2"
              >
                +1"
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{getDistanceHelp()}</div>
        </div>

        {/* Preview */}
        <div className={`p-3 rounded-md ${isValidPlacement() ? 'bg-muted' : 'bg-red-50 border border-red-200'}`}>
          <div className="text-sm font-medium mb-2">Preview:</div>
          <div className="text-xs text-muted-foreground">
            {positionType === 'from-left' && `Window starts ${distance}" from left end`}
            {positionType === 'from-right' && `Window starts ${distance}" from right end`}
            {positionType === 'center' && `Window center is ${distance}" from wall center`}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Window width: {width}" | Wall length: {wallLength}"
          </div>
          {!isValidPlacement() && (
            <div className="text-xs text-red-600 mt-2">
              ⚠️ Invalid placement: Distance exceeds wall bounds
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handlePlace} 
            disabled={!isValidPlacement()}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            Place Window
          </Button>
        </div>
      </div>
    </div>
  )
}
