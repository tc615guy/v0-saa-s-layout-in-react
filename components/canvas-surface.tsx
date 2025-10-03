"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { useAppStore } from "@/lib/store"
import { getTemplateById } from "@/lib/catalog"
import { inchesToPixels, pixelsToInches } from "@/lib/units"
import { Instance, Wall, DimensionLine } from "@/lib/types"
import { WindowPlacementHUD } from "@/components/window-placement-hud"
import { ContextMenu } from "@/components/context-menu"
import { checkWallCollision, snapToWall, checkInstanceCollisions, isInWallSnapZone } from "@/lib/wall-collision"
import { pointToSegmentDistance, formatInches, type Point } from "@/lib/utils"

const PX_PER_IN = 3 // Scale: 3 pixels per inch
const GRID_IN = 12 // Grid spacing in inches
const RULER_SIZE = 20 // Size of rulers in pixels

// Fixed world size - large enough for house drawings (about 100' x 80' at 3px/inch)
const WORLD_WIDTH = 3600 // 100 feet * 12 inches * 3 pixels
const WORLD_HEIGHT = 2880 // 80 feet * 12 inches * 3 pixels

// Canvas display size - this stays constant
const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 800

export function CanvasSurface() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT })
  const [isDragging, setIsDragging] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragStartTime, setDragStartTime] = useState(0)
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    instanceId: string
  }>({ visible: false, x: 0, y: 0, instanceId: "" })
  
  const [windowPlacement, setWindowPlacement] = useState<{
    visible: boolean
    wallId: string
    wallLength: number
    templateId: string
  }>({ visible: false, wallId: "", wallLength: 0, templateId: "" })
  
  const [windowPlacementPreview, setWindowPlacementPreview] = useState({
    width: 36,
    positionType: 'center' as 'from-left' | 'from-right' | 'center',
    distance: 0
  })
  
  // Dimensioning state
  const [dimensioningStart, setDimensioningStart] = useState<{ x: number; y: number } | null>(null)
  const [dimensioningEnd, setDimensioningEnd] = useState<{ x: number; y: number } | null>(null)
  const [dimensioningState, setDimensioningState] = useState<{
    phase: 'none' | 'edge-selected' | 'placing-end'
    selectedEdge: {
      id: string
      type: 'wall' | 'cabinet' | 'window'
      instanceId: string
      edge: 'top' | 'bottom' | 'left' | 'right'
      start: { x: number; y: number }
      end: { x: number; y: number }
      description: string
    } | null
    endPoint: { x: number; y: number } | null
  }>({
    phase: 'none',
    selectedEdge: null,
    endPoint: null
  })
  
  // Hover state for dimensioning
  const [hoveredEdge, setHoveredEdge] = useState<{
    id: string
    type: 'wall' | 'cabinet' | 'window'
    instanceId: string
    edge: 'top' | 'bottom' | 'left' | 'right'
    start: { x: number; y: number }
    end: { x: number; y: number }
    description: string
  } | null>(null)
  
  const { 
    instances, 
    templates, 
    walls, 
    dimensionLines,
    ui, 
    selectedIds, 
    select, 
    moveInstance, 
    updateInstance,
    deleteInstance,
    addWall,
    addDimensionLine,
    deleteDimensionLine,
    setZoom, 
    setPan 
  } = useAppStore()

  // Convert wall instances to wall objects for collision detection
  const getWallsFromInstances = (): Wall[] => {
    const wallInstances = instances.filter(instance => {
      const template = getTemplateById(templates, instance.templateId)
      return template && template.id.startsWith('WALL_SEGMENT')
    })
    
    return wallInstances.map(instance => {
      const template = getTemplateById(templates, instance.templateId)
      if (!template) return null
      
      const x = inchesToPixels(instance.x)
      const y = inchesToPixels(instance.y)
      const width = inchesToPixels(instance.widthIn || 0)
      const height = inchesToPixels(instance.depthIn || 0)
      
      // Create wall endpoints based on rotation
      const rot = instance.rot || 0
      const radians = (rot * Math.PI) / 180
      
      // Default to horizontal wall (0 degrees)
      let x1 = x
      let y1 = y
      let x2 = x + width
      let y2 = y
      
      // Apply rotation
      if (rot !== 0) {
        const centerX = x + width / 2
        const centerY = y + height / 2
        
        // Rotate endpoints around center
        x1 = centerX + (x - centerX) * Math.cos(radians) - (y - centerY) * Math.sin(radians)
        y1 = centerY + (x - centerX) * Math.sin(radians) + (y - centerY) * Math.cos(radians)
        x2 = centerX + (x + width - centerX) * Math.cos(radians) - (y - centerY) * Math.sin(radians)
        y2 = centerY + (x + width - centerX) * Math.sin(radians) + (y - centerY) * Math.cos(radians)
      }
      
      return {
        id: instance.id,
        x1,
        y1,
        x2,
        y2
      }
    }).filter((wall): wall is Wall => wall !== null)
  }

  // Combine stored walls with converted wall instances
  const allWalls = [...walls, ...getWallsFromInstances()]

  // Function to detect component edges near a click point using proper hit-testing
  const detectComponentEdge = (x: number, y: number, tolerance: number = inchesToPixels(6)) => {
    const clickPoint: Point = { x, y }
    let bestMatch: { edge: any, distance: number } | null = null

    // Check walls first
    for (const wall of allWalls) {
      const wallLeft = Math.min(wall.x1, wall.x2)
      const wallRight = Math.max(wall.x1, wall.x2)
      const wallTop = Math.min(wall.y1, wall.y2)
      const wallBottom = Math.max(wall.y1, wall.y2)
      
      const isHorizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1)
      
      if (isHorizontal) {
        // Horizontal wall - check top and bottom edges
        const topEdge = { x: wallLeft, y: wallTop }
        const topEdgeEnd = { x: wallRight, y: wallTop }
        const bottomEdge = { x: wallLeft, y: wallBottom }
        const bottomEdgeEnd = { x: wallRight, y: wallBottom }

        const topDist = pointToSegmentDistance(clickPoint, topEdge, topEdgeEnd)
        const bottomDist = pointToSegmentDistance(clickPoint, bottomEdge, bottomEdgeEnd)

        if (topDist <= tolerance && (!bestMatch || topDist < bestMatch.distance)) {
          bestMatch = {
            edge: {
              id: `wall_${wall.id}_top`,
              type: 'wall' as const,
              instanceId: wall.id,
              edge: 'top' as const,
              start: topEdge,
              end: topEdgeEnd,
              description: `Wall Top Edge`
            },
            distance: topDist
          }
        }
        if (bottomDist <= tolerance && (!bestMatch || bottomDist < bestMatch.distance)) {
          bestMatch = {
            edge: {
              id: `wall_${wall.id}_bottom`,
              type: 'wall' as const,
              instanceId: wall.id,
              edge: 'bottom' as const,
              start: bottomEdge,
              end: bottomEdgeEnd,
              description: `Wall Bottom Edge`
            },
            distance: bottomDist
          }
        }
      } else {
        // Vertical wall - check left and right edges
        const leftEdge = { x: wallLeft, y: wallTop }
        const leftEdgeEnd = { x: wallLeft, y: wallBottom }
        const rightEdge = { x: wallRight, y: wallTop }
        const rightEdgeEnd = { x: wallRight, y: wallBottom }

        const leftDist = pointToSegmentDistance(clickPoint, leftEdge, leftEdgeEnd)
        const rightDist = pointToSegmentDistance(clickPoint, rightEdge, rightEdgeEnd)

        if (leftDist <= tolerance && (!bestMatch || leftDist < bestMatch.distance)) {
          bestMatch = {
            edge: {
              id: `wall_${wall.id}_left`,
              type: 'wall' as const,
              instanceId: wall.id,
              edge: 'left' as const,
              start: leftEdge,
              end: leftEdgeEnd,
              description: `Wall Left Edge`
            },
            distance: leftDist
          }
        }
        if (rightDist <= tolerance && (!bestMatch || rightDist < bestMatch.distance)) {
          bestMatch = {
            edge: {
              id: `wall_${wall.id}_right`,
              type: 'wall' as const,
              instanceId: wall.id,
              edge: 'right' as const,
              start: rightEdge,
              end: rightEdgeEnd,
              description: `Wall Right Edge`
            },
            distance: rightDist
          }
        }
      }
    }

    // Check instances (cabinets, windows, etc.)
    for (const instance of instances) {
      const template = getTemplateById(templates, instance.templateId)
      if (!template) continue

      const instanceX = inchesToPixels(instance.x)
      const instanceY = inchesToPixels(instance.y)
      const instanceWidth = inchesToPixels(instance.widthIn || 0)
      const instanceHeight = inchesToPixels(instance.depthIn || 0)

      const componentType = template.id.startsWith('WINDOW') ? 'Window' : 'Cabinet'

      // Define edges with proper start/end points
      const edges = [
        { 
          edge: 'top' as const, 
          start: { x: instanceX, y: instanceY }, 
          end: { x: instanceX + instanceWidth, y: instanceY },
          description: `${componentType} Top Edge`
        },
        { 
          edge: 'bottom' as const, 
          start: { x: instanceX, y: instanceY + instanceHeight }, 
          end: { x: instanceX + instanceWidth, y: instanceY + instanceHeight },
          description: `${componentType} Bottom Edge`
        },
        { 
          edge: 'left' as const, 
          start: { x: instanceX, y: instanceY }, 
          end: { x: instanceX, y: instanceY + instanceHeight },
          description: `${componentType} Left Edge`
        },
        { 
          edge: 'right' as const, 
          start: { x: instanceX + instanceWidth, y: instanceY }, 
          end: { x: instanceX + instanceWidth, y: instanceY + instanceHeight },
          description: `${componentType} Right Edge`
        }
      ]

      for (const { edge, start, end, description } of edges) {
        const distance = pointToSegmentDistance(clickPoint, start, end)
        if (distance <= tolerance && (!bestMatch || distance < bestMatch.distance)) {
          bestMatch = {
            edge: {
              id: `${instance.id}_${edge}`,
              type: template.id.startsWith('WINDOW') ? 'window' as const : 'cabinet' as const,
              instanceId: instance.id,
              edge,
              start,
              end,
              description
            },
            distance
          }
        }
      }
    }

    return bestMatch?.edge || null
  }
  

  // Helper function to convert screen coordinates to world coordinates
  const screenToWorld = (screenX: number, screenY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    
    // Convert screen coordinates to canvas coordinates
    const canvasX = (screenX - rect.left) * (canvas.width / rect.width)
    const canvasY = (screenY - rect.top) * (canvas.height / rect.height)
    
    // Apply inverse zoom and pan to get world coordinates
    const worldX = (canvasX / ui.zoom) - ui.pan.x
    const worldY = (canvasY / ui.zoom) - ui.pan.y
    
    return { x: worldX, y: worldY }
  }

  // Set up responsive canvas size
  useEffect(() => {
    const updateCanvasSize = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const container = canvas.parentElement
        if (container) {
          // Set canvas to fill the container
          canvas.style.width = '100%'
          canvas.style.height = '100%'
          
          // Set internal resolution to match display size for crisp rendering
          const rect = container.getBoundingClientRect()
          canvas.width = rect.width
          canvas.height = rect.height
        }
      }
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [])

  // Draw function
  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Apply zoom and pan
    ctx.save()
    ctx.scale(ui.zoom, ui.zoom)
    ctx.translate(ui.pan.x, ui.pan.y)

    // Draw grid
    drawGrid(ctx)

    // Draw coordinate system
    drawCoordinateSystem(ctx)

    // Draw walls
    drawWalls(ctx)

    // Draw instances
    drawInstances(ctx)

    // Draw dimension lines
    drawDimensionLines(ctx)

    // Draw selected edge (highlighted in red)
    drawSelectedEdge(ctx)

    // Draw hovered edge (highlighted in orange)
    drawHoveredEdge(ctx)

    // Draw dimensioning preview line
    drawDimensioningPreview(ctx)

    ctx.restore()

    // Draw position indicators (not affected by zoom/pan)
    if (selectedIds.length === 1) {
      const selectedInstance = instances.find(i => i.id === selectedIds[0])
      if (selectedInstance) {
        const template = getTemplateById(templates, selectedInstance.templateId)
        console.log(`Drawing indicators for selected instance: ${selectedInstance.id}, template: ${template?.id}`)
        if (template && template.id.startsWith('WINDOW')) {
          console.log('Calling drawWindowPositionIndicators')
          drawWindowPositionIndicators(ctx, selectedInstance)
        } else {
          console.log('Calling drawCabinetPositionIndicators')
          drawCabinetPositionIndicators(ctx, selectedInstance)
        }
      }
    }

    // Draw Window Placement HUD preview dimensions
    if (windowPlacement.visible) {
      drawWindowPlacementPreview(ctx)
    }

    // Draw coordinate display (not affected by zoom/pan)
    drawCoordinateDisplay(ctx)
  }

  // Draw grid
  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const gridSize = PX_PER_IN * GRID_IN
    
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1
    
    // Vertical lines
    for (let x = 0; x <= WORLD_WIDTH; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, WORLD_HEIGHT)
      ctx.stroke()
    }
    
    // Horizontal lines
    for (let y = 0; y <= WORLD_HEIGHT; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(WORLD_WIDTH, y)
      ctx.stroke()
    }
    
    // Every 6 inches, darker lines
    ctx.strokeStyle = '#d0d0d0'
    const majorGridSize = PX_PER_IN * 6
    
    for (let x = 0; x <= WORLD_WIDTH; x += majorGridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, WORLD_HEIGHT)
      ctx.stroke()
    }
    
    for (let y = 0; y <= WORLD_HEIGHT; y += majorGridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(WORLD_WIDTH, y)
      ctx.stroke()
    }
  }

  // Draw coordinate system and rulers
  const drawCoordinateSystem = (ctx: CanvasRenderingContext2D) => {
    if (!ui.rulers) return

    ctx.save()
    ctx.translate(ui.pan.x, ui.pan.y)
    ctx.scale(ui.zoom, ui.zoom)

    // Draw X-axis ruler (top)
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, -RULER_SIZE, WORLD_WIDTH, RULER_SIZE)
    ctx.strokeStyle = '#dee2e6'
    ctx.lineWidth = 1
    ctx.strokeRect(0, -RULER_SIZE, WORLD_WIDTH, RULER_SIZE)

    // Draw Y-axis ruler (left)
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(-RULER_SIZE, 0, RULER_SIZE, WORLD_HEIGHT)
    ctx.strokeStyle = '#dee2e6'
    ctx.strokeRect(-RULER_SIZE, 0, RULER_SIZE, WORLD_HEIGHT)

    // Draw X-axis tick marks and labels
    ctx.fillStyle = '#6c757d'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'
    
    const startX = Math.floor(-ui.pan.x / ui.zoom / PX_PER_IN) * PX_PER_IN
    const endX = Math.ceil((WORLD_WIDTH - ui.pan.x) / ui.zoom / PX_PER_IN) * PX_PER_IN
    
    for (let x = startX; x <= endX; x += PX_PER_IN * 6) { // Every 6 inches
      const pixelX = x
      ctx.beginPath()
      ctx.moveTo(pixelX, -RULER_SIZE)
      ctx.lineTo(pixelX, 0)
      ctx.stroke()
      
      const inches = Math.round(x / PX_PER_IN)
      ctx.fillText(`${inches}"`, pixelX, -5)
    }

    // Draw Y-axis tick marks and labels
    ctx.textAlign = 'right'
    
    const startY = Math.floor(-ui.pan.y / ui.zoom / PX_PER_IN) * PX_PER_IN
    const endY = Math.ceil((WORLD_HEIGHT - ui.pan.y) / ui.zoom / PX_PER_IN) * PX_PER_IN
    
    for (let y = startY; y <= endY; y += PX_PER_IN * 6) { // Every 6 inches
      const pixelY = y
      ctx.beginPath()
      ctx.moveTo(-RULER_SIZE, pixelY)
      ctx.lineTo(0, pixelY)
      ctx.stroke()
      
      const inches = Math.round(y / PX_PER_IN)
      ctx.fillText(`${inches}"`, -5, pixelY + 3)
    }

    ctx.restore()
  }

  // Draw Window Placement HUD preview dimensions
  const drawWindowPlacementPreview = (ctx: CanvasRenderingContext2D) => {
    if (!windowPlacement.visible || !windowPlacement.wallId) return

    // Find the wall
    const wall = allWalls.find(w => w.id === windowPlacement.wallId)
    if (!wall) return

    // Find the selected window instance
    const selectedInstance = instances.find(i => i.id === selectedIds[0] && i.templateId === windowPlacement.templateId)
    if (!selectedInstance) return

    const wallLeft = Math.min(wall.x1, wall.x2)
    const wallRight = Math.max(wall.x1, wall.x2)
    const wallTop = Math.min(wall.y1, wall.y2)
    const wallBottom = Math.max(wall.y1, wall.y2)
    
    const isHorizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1)
    
    // Calculate preview window position based on HUD settings
    const distancePixels = inchesToPixels(windowPlacementPreview.distance)
    const widthPixels = inchesToPixels(windowPlacementPreview.width)
    
    let previewWindowX: number, previewWindowY: number
    let previewWindowLeft: number, previewWindowRight: number, previewWindowCenterX: number
    
    if (isHorizontal) {
      // Calculate preview position for horizontal wall
      switch (windowPlacementPreview.positionType) {
        case 'from-left':
          previewWindowX = wallLeft + distancePixels
          break
        case 'from-right':
          previewWindowX = wallRight - distancePixels - widthPixels
          break
        case 'center':
          const wallCenter = (wallLeft + wallRight) / 2
          previewWindowX = wallCenter - widthPixels / 2 + distancePixels
          break
      }
      previewWindowY = (wall.y1 + wall.y2) / 2
      previewWindowLeft = previewWindowX
      previewWindowRight = previewWindowX + widthPixels
      previewWindowCenterX = previewWindowX + widthPixels / 2
    } else {
      // Calculate preview position for vertical wall
      previewWindowX = (wall.x1 + wall.x2) / 2
      switch (windowPlacementPreview.positionType) {
        case 'from-left':
          previewWindowY = wallTop + distancePixels
          break
        case 'from-right':
          previewWindowY = wallBottom - distancePixels - widthPixels
          break
        case 'center':
          const wallCenter = (wallTop + wallBottom) / 2
          previewWindowY = wallCenter - widthPixels / 2 + distancePixels
          break
      }
      previewWindowLeft = previewWindowY // For vertical walls, these become top/bottom
      previewWindowRight = previewWindowY + widthPixels
      previewWindowCenterX = previewWindowY + widthPixels / 2
    }
    
    // Draw preview dimension lines with different styling
    ctx.strokeStyle = '#3b82f6' // Blue for preview
    ctx.lineWidth = 2
    ctx.font = '12px Arial'
    ctx.fillStyle = '#3b82f6'
    ctx.textAlign = 'center'
    ctx.setLineDash([5, 5]) // Dashed lines for preview
    
    if (isHorizontal) {
      // Horizontal wall - show wall length and current window position
      const wallLength = Math.abs(wallRight - wallLeft)
      const wallLengthInches = Math.round(wallLength / PX_PER_IN * 8) / 8
      
      // Wall length dimension
      const wallMidY = (wallTop + wallBottom) / 2
      const dimensionY = wallMidY - 30
      
      ctx.beginPath()
      ctx.moveTo(wallLeft, dimensionY)
      ctx.lineTo(wallRight, dimensionY)
      ctx.stroke()
      
      ctx.fillText(`Wall: ${wallLengthInches}"`, (wallLeft + wallRight) / 2, dimensionY - 5)
      
      // Preview window position indicators
      // Left distance
      const distFromLeft = previewWindowLeft - wallLeft
      if (distFromLeft > 0) {
        ctx.beginPath()
        ctx.moveTo(wallLeft, dimensionY + 20)
        ctx.lineTo(previewWindowLeft, dimensionY + 20)
        ctx.stroke()
        
        const inches = Math.round(distFromLeft / PX_PER_IN * 8) / 8
        ctx.fillText(`${inches}"`, (wallLeft + previewWindowLeft) / 2, dimensionY + 15)
      }
      
      // Window width
      if (widthPixels > 0) {
        ctx.beginPath()
        ctx.moveTo(previewWindowLeft, dimensionY + 40)
        ctx.lineTo(previewWindowRight, dimensionY + 40)
        ctx.stroke()
        
        const inches = Math.round(widthPixels / PX_PER_IN * 8) / 8
        ctx.fillText(`${inches}" W`, previewWindowCenterX, dimensionY + 35)
      }
      
      // Right distance
      const distFromRight = wallRight - previewWindowRight
      if (distFromRight > 0) {
        ctx.beginPath()
        ctx.moveTo(previewWindowRight, dimensionY + 20)
        ctx.lineTo(wallRight, dimensionY + 20)
        ctx.stroke()
        
        const inches = Math.round(distFromRight / PX_PER_IN * 8) / 8
        ctx.fillText(`${inches}"`, (previewWindowRight + wallRight) / 2, dimensionY + 15)
      }
    } else {
      // Vertical wall - show wall height and current window position
      const wallHeight = Math.abs(wallBottom - wallTop)
      const wallHeightInches = Math.round(wallHeight / PX_PER_IN * 8) / 8
      
      // Wall height dimension
      const wallMidX = (wallLeft + wallRight) / 2
      const dimensionX = wallMidX - 30
      
      ctx.beginPath()
      ctx.moveTo(dimensionX, wallTop)
      ctx.lineTo(dimensionX, wallBottom)
      ctx.stroke()
      
      ctx.save()
      ctx.translate(dimensionX - 5, (wallTop + wallBottom) / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(`Wall: ${wallHeightInches}"`, 0, 0)
      ctx.restore()
      
      // Preview window position indicators
      const previewWindowTop = previewWindowY
      const previewWindowBottom = previewWindowY + widthPixels // Window width becomes height in vertical orientation
      const previewWindowCenterY = previewWindowY + widthPixels / 2
      
      // Top distance
      const distFromTop = previewWindowTop - wallTop
      if (distFromTop > 0) {
        ctx.beginPath()
        ctx.moveTo(dimensionX + 20, wallTop)
        ctx.lineTo(dimensionX + 20, previewWindowTop)
        ctx.stroke()
        
        const inches = Math.round(distFromTop / PX_PER_IN * 8) / 8
        ctx.fillText(`${inches}"`, dimensionX + 15, (wallTop + previewWindowTop) / 2)
      }
      
      // Window height
      if (widthPixels > 0) {
        ctx.beginPath()
        ctx.moveTo(dimensionX + 40, previewWindowTop)
        ctx.lineTo(dimensionX + 40, previewWindowBottom)
        ctx.stroke()
        
        const inches = Math.round(widthPixels / PX_PER_IN * 8) / 8
        ctx.save()
        ctx.translate(dimensionX + 35, previewWindowCenterY)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(`${inches}" H`, 0, 0)
        ctx.restore()
      }
      
      // Bottom distance
      const distFromBottom = wallBottom - previewWindowBottom
      if (distFromBottom > 0) {
        ctx.beginPath()
        ctx.moveTo(dimensionX + 20, previewWindowBottom)
        ctx.lineTo(dimensionX + 20, wallBottom)
        ctx.stroke()
        
        const inches = Math.round(distFromBottom / PX_PER_IN * 8) / 8
        ctx.fillText(`${inches}"`, dimensionX + 15, (previewWindowBottom + wallBottom) / 2)
      }
    }
    
    ctx.setLineDash([]) // Reset line dash
  }

  // Draw dimension lines with proper extension lines and labels
  const drawDimensionLines = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#2563eb' // Blue color for dimension lines
    ctx.fillStyle = '#1e40af' // Darker blue for text
    ctx.lineWidth = 1
    ctx.font = '12px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    dimensionLines.forEach(dimensionLine => {
      const x1 = inchesToPixels(dimensionLine.x1)
      const y1 = inchesToPixels(dimensionLine.y1)
      const x2 = inchesToPixels(dimensionLine.x2)
      const y2 = inchesToPixels(dimensionLine.y2)

      // Calculate extension line offset (perpendicular to dimension line)
      const dimensionLength = Math.hypot(x2 - x1, y2 - y1)
      const extensionOffset = 18 // pixels
      
      // Calculate perpendicular direction
      const dx = x2 - x1
      const dy = y2 - y1
      const perpX = -dy / dimensionLength
      const perpY = dx / dimensionLength
      
      // Extension line endpoints
      const ext1X = x1 + perpX * extensionOffset
      const ext1Y = y1 + perpY * extensionOffset
      const ext2X = x2 + perpX * extensionOffset
      const ext2Y = y2 + perpY * extensionOffset

      // Draw extension lines (dashed)
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(ext1X, ext1Y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(ext2X, ext2Y)
      ctx.stroke()
      ctx.setLineDash([])

      // Draw dimension line (solid)
      ctx.beginPath()
      ctx.moveTo(ext1X, ext1Y)
      ctx.lineTo(ext2X, ext2Y)
      ctx.stroke()

      // Draw dimension line endpoints (ticks)
      const tickLength = 6
      const tickX1 = ext1X + perpX * tickLength
      const tickY1 = ext1Y + perpY * tickLength
      const tickX2 = ext1X - perpX * tickLength
      const tickY2 = ext1Y - perpY * tickLength
      
      ctx.beginPath()
      ctx.moveTo(tickX1, tickY1)
      ctx.lineTo(tickX2, tickY2)
      ctx.stroke()
      
      const tickX3 = ext2X + perpX * tickLength
      const tickY3 = ext2Y + perpY * tickLength
      const tickX4 = ext2X - perpX * tickLength
      const tickY4 = ext2Y - perpY * tickLength
      
      ctx.beginPath()
      ctx.moveTo(tickX3, tickY3)
      ctx.lineTo(tickX4, tickY4)
      ctx.stroke()

      // Draw dimension text (use label if available, otherwise calculate)
      const label = dimensionLine.label || formatInches(pixelsToInches(dimensionLength), "feet-inches", 16)
      const midX = (ext1X + ext2X) / 2
      const midY = (ext1Y + ext2Y) / 2
      
      // Add background for text readability
      const textMetrics = ctx.measureText(label)
      const textPadding = 4
      const textWidth = textMetrics.width + textPadding * 2
      const textHeight = 16 + textPadding * 2
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.fillRect(midX - textWidth/2, midY - textHeight/2, textWidth, textHeight)
      
      ctx.fillStyle = '#1e40af'
      ctx.fillText(label, midX, midY)
    })
  }

  // Draw selected edge (highlighted in red)
  const drawSelectedEdge = (ctx: CanvasRenderingContext2D) => {
    if (!dimensioningState.selectedEdge) return

    ctx.strokeStyle = '#dc2626' // Red color for selected edge
    ctx.lineWidth = 4
    ctx.setLineDash([])

    const edge = dimensioningState.selectedEdge
    ctx.beginPath()
    ctx.moveTo(edge.start.x, edge.start.y)
    ctx.lineTo(edge.end.x, edge.end.y)
    ctx.stroke()
  }

  // Draw hovered edge (highlighted in orange)
  const drawHoveredEdge = (ctx: CanvasRenderingContext2D) => {
    if (!hoveredEdge) return
    
    console.log('Drawing hovered edge:', hoveredEdge.description)

    ctx.strokeStyle = '#f97316' // Orange color for hovered edges
    ctx.lineWidth = 3
    ctx.setLineDash([5, 5]) // Dashed line for hover effect

    ctx.beginPath()
    ctx.moveTo(hoveredEdge.start.x, hoveredEdge.start.y)
    ctx.lineTo(hoveredEdge.end.x, hoveredEdge.end.y)
    ctx.stroke()

    ctx.setLineDash([]) // Reset line dash
  }

  // Draw dimensioning preview line (from selected edge to mouse cursor)
  const drawDimensioningPreview = (ctx: CanvasRenderingContext2D) => {
    if (dimensioningState.phase !== 'edge-selected' || !dimensioningState.selectedEdge || !dimensioningState.endPoint) return

    ctx.strokeStyle = '#3b82f6' // Blue color for preview line
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5]) // Dashed line for preview

    const startX = inchesToPixels(dimensioningState.selectedEdge.start.x)
    const startY = inchesToPixels(dimensioningState.selectedEdge.start.y)
    const endX = inchesToPixels(dimensioningState.endPoint.x)
    const endY = inchesToPixels(dimensioningState.endPoint.y)

    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    // Draw preview text
    const distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2)
    const inches = Math.round(distance / PX_PER_IN * 8) / 8
    const midX = (startX + endX) / 2
    const midY = (startY + endY) / 2

    ctx.fillStyle = '#3b82f6'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${inches}"`, midX, midY - 8)

    ctx.setLineDash([]) // Reset line dash
  }

  // Draw window position indicators relative to walls
  const drawWindowPositionIndicators = (ctx: CanvasRenderingContext2D, instance: Instance) => {
    // Show dimensions when window is selected, not just when dragging
    if (selectedIds.length !== 1 || selectedIds[0] !== instance.id) {
      console.log(`Dimensions not shown: selectedIds=${selectedIds.length}, instanceId=${instance.id}, selectedId=${selectedIds[0]}`)
      return
    }
    
    const template = getTemplateById(templates, instance.templateId)
    if (!template || !template.id.startsWith('WINDOW')) {
      console.log(`Dimensions not shown: template not found or not a window: ${template?.id}`)
      return
    }
    
    console.log(`Drawing dimensions for window ${instance.id}`)
    
    const windowX = inchesToPixels(instance.x)
    const windowY = inchesToPixels(instance.y)
    const windowWidth = inchesToPixels(instance.widthIn || 0)
    const windowDepth = inchesToPixels(instance.depthIn || 0)
    
    // Find nearby walls
    allWalls.forEach(wall => {
      const wallLeft = Math.min(wall.x1, wall.x2)
      const wallRight = Math.max(wall.x1, wall.x2)
      const wallTop = Math.min(wall.y1, wall.y2)
      const wallBottom = Math.max(wall.y1, wall.y2)
      
      // Determine wall orientation
      const isHorizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1)
      
      if (isHorizontal) {
        // Horizontal wall - check if window is close to this wall
        const wallCenterY = (wallTop + wallBottom) / 2
        const windowCenterY = windowY + windowDepth / 2
        
        if (Math.abs(windowCenterY - wallCenterY) < inchesToPixels(6)) {
          // Window is near this horizontal wall
          const windowLeft = windowX
          const windowRight = windowX + windowWidth
          const windowCenterX = windowX + windowWidth / 2
          
          // Calculate stable dimension line positions (fixed offsets from wall)
          const baseDimensionY = wallTop - inchesToPixels(3) // 3" above wall
          const dimensionLineY = baseDimensionY
          const dimensionLineY2 = baseDimensionY - inchesToPixels(2) // 2" spacing
          const dimensionLineY3 = baseDimensionY - inchesToPixels(4) // 4" spacing
          
          // Draw dimension lines with consistent styling
          ctx.strokeStyle = '#dc2626' // Dark red for visibility
          ctx.lineWidth = 2
          ctx.font = 'bold 12px Arial'
          ctx.fillStyle = '#dc2626'
          ctx.textAlign = 'center'
          
          // Left distance indicator (from wall left to window left)
          const distFromLeft = windowLeft - wallLeft
          if (distFromLeft > inchesToPixels(0.5)) { // Only show if > 0.5"
            ctx.beginPath()
            ctx.moveTo(wallLeft, dimensionLineY)
            ctx.lineTo(windowLeft, dimensionLineY)
            // Add dimension line endpoints
            ctx.moveTo(wallLeft, dimensionLineY - 4)
            ctx.lineTo(wallLeft, dimensionLineY + 4)
            ctx.moveTo(windowLeft, dimensionLineY - 4)
            ctx.lineTo(windowLeft, dimensionLineY + 4)
            ctx.stroke()
            
            const inches = Math.round(distFromLeft / PX_PER_IN * 8) / 8
            ctx.fillText(`${inches}"`, (wallLeft + windowLeft) / 2, dimensionLineY - 8)
          }
          
          // Window width indicator
          if (windowWidth > inchesToPixels(0.5)) { // Only show if > 0.5"
            ctx.beginPath()
            ctx.moveTo(windowLeft, dimensionLineY2)
            ctx.lineTo(windowRight, dimensionLineY2)
            // Add dimension line endpoints
            ctx.moveTo(windowLeft, dimensionLineY2 - 4)
            ctx.lineTo(windowLeft, dimensionLineY2 + 4)
            ctx.moveTo(windowRight, dimensionLineY2 - 4)
            ctx.lineTo(windowRight, dimensionLineY2 + 4)
            ctx.stroke()
            
            const inches = Math.round(windowWidth / PX_PER_IN * 8) / 8
            ctx.fillText(`${inches}" W`, windowCenterX, dimensionLineY2 - 8)
          }
          
          // Right distance indicator (from window right to wall right)
          const distFromRight = wallRight - windowRight
          if (distFromRight > inchesToPixels(0.5)) { // Only show if > 0.5"
            ctx.beginPath()
            ctx.moveTo(windowRight, dimensionLineY)
            ctx.lineTo(wallRight, dimensionLineY)
            // Add dimension line endpoints
            ctx.moveTo(windowRight, dimensionLineY - 4)
            ctx.lineTo(windowRight, dimensionLineY + 4)
            ctx.moveTo(wallRight, dimensionLineY - 4)
            ctx.lineTo(wallRight, dimensionLineY + 4)
            ctx.stroke()
            
            const inches = Math.round(distFromRight / PX_PER_IN * 8) / 8
            ctx.fillText(`${inches}"`, (windowRight + wallRight) / 2, dimensionLineY - 8)
          }
          
          // Center distance indicator (from wall left to window center)
          const distFromLeftToCenter = windowCenterX - wallLeft
          if (distFromLeftToCenter > inchesToPixels(0.5)) { // Only show if > 0.5"
            ctx.beginPath()
            ctx.moveTo(wallLeft, dimensionLineY3)
            ctx.lineTo(windowCenterX, dimensionLineY3)
            // Add dimension line endpoints
            ctx.moveTo(wallLeft, dimensionLineY3 - 4)
            ctx.lineTo(wallLeft, dimensionLineY3 + 4)
            ctx.moveTo(windowCenterX, dimensionLineY3 - 4)
            ctx.lineTo(windowCenterX, dimensionLineY3 + 4)
            ctx.stroke()
            
            const inches = Math.round(distFromLeftToCenter / PX_PER_IN * 8) / 8
            ctx.fillText(`${inches}" C`, (wallLeft + windowCenterX) / 2, dimensionLineY3 - 8)
          }
          
          // Add dimension summary box
          const summaryY = baseDimensionY - inchesToPixels(6)
          const summaryX = windowLeft + windowWidth / 4
          
          // Draw summary background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
          ctx.fillRect(summaryX - 20, summaryY - 15, 120, 20)
          ctx.strokeStyle = '#dc2626'
          ctx.lineWidth = 1
          ctx.strokeRect(summaryX - 20, summaryY - 15, 120, 20)
          
          // Add summary text
          ctx.font = 'bold 10px Arial'
          ctx.fillStyle = '#1f2937'
          ctx.textAlign = 'left'
          ctx.fillText(`L:${Math.round(distFromLeft / PX_PER_IN * 8) / 8}" W:${Math.round(windowWidth / PX_PER_IN * 8) / 8}" R:${Math.round(distFromRight / PX_PER_IN * 8) / 8}"`, summaryX - 15, summaryY - 2)
        }
      } else {
        // Vertical wall - check if window is close to this wall
        const wallCenterX = (wallLeft + wallRight) / 2
        const windowCenterX = windowX + windowWidth / 2
        
        if (Math.abs(windowCenterX - wallCenterX) < inchesToPixels(6)) {
          // Window is near this vertical wall
          const windowTop = windowY
          const windowBottom = windowY + windowDepth
          const windowCenterY = windowY + windowDepth / 2
          
          // Calculate stable dimension line positions (fixed offsets from wall)
          const baseDimensionX = wallLeft - inchesToPixels(3) // 3" left of wall
          const dimensionLineX = baseDimensionX
          const dimensionLineX2 = baseDimensionX - inchesToPixels(2) // 2" spacing
          const dimensionLineX3 = baseDimensionX - inchesToPixels(4) // 4" spacing
          
          // Draw distance indicators with consistent styling
          ctx.strokeStyle = '#dc2626'
          ctx.lineWidth = 2
          ctx.font = 'bold 12px Arial'
          ctx.fillStyle = '#dc2626'
          ctx.textAlign = 'center'
          
          // Top distance indicator (from wall top to window top)
          const distFromTop = windowTop - wallTop
          if (distFromTop > inchesToPixels(0.5)) { // Only show if > 0.5"
            ctx.beginPath()
            ctx.moveTo(dimensionLineX, wallTop)
            ctx.lineTo(dimensionLineX, windowTop)
            // Add dimension line endpoints
            ctx.moveTo(dimensionLineX - 4, wallTop)
            ctx.lineTo(dimensionLineX + 4, wallTop)
            ctx.moveTo(dimensionLineX - 4, windowTop)
            ctx.lineTo(dimensionLineX + 4, windowTop)
            ctx.stroke()
            
            const inches = Math.round(distFromTop / PX_PER_IN * 8) / 8
            ctx.save()
            ctx.translate(dimensionLineX - 8, (wallTop + windowTop) / 2)
            ctx.rotate(-Math.PI / 2)
            ctx.fillText(`${inches}"`, 0, 0)
            ctx.restore()
          }
          
          // Window height indicator (for vertical walls, window width becomes height)
          if (windowWidth > inchesToPixels(0.5)) { // Only show if > 0.5"
            ctx.beginPath()
            ctx.moveTo(dimensionLineX2, windowTop)
            ctx.lineTo(dimensionLineX2, windowBottom)
            // Add dimension line endpoints
            ctx.moveTo(dimensionLineX2 - 4, windowTop)
            ctx.lineTo(dimensionLineX2 + 4, windowTop)
            ctx.moveTo(dimensionLineX2 - 4, windowBottom)
            ctx.lineTo(dimensionLineX2 + 4, windowBottom)
            ctx.stroke()
            
            const inches = Math.round(windowWidth / PX_PER_IN * 8) / 8
            ctx.save()
            ctx.translate(dimensionLineX2 - 8, windowCenterY)
            ctx.rotate(-Math.PI / 2)
            ctx.fillText(`${inches}" H`, 0, 0)
            ctx.restore()
          }
          
          // Bottom distance indicator (from window bottom to wall bottom)
          const distFromBottom = wallBottom - windowBottom
          if (distFromBottom > inchesToPixels(0.5)) { // Only show if > 0.5"
            ctx.beginPath()
            ctx.moveTo(dimensionLineX, windowBottom)
            ctx.lineTo(dimensionLineX, wallBottom)
            // Add dimension line endpoints
            ctx.moveTo(dimensionLineX - 4, windowBottom)
            ctx.lineTo(dimensionLineX + 4, windowBottom)
            ctx.moveTo(dimensionLineX - 4, wallBottom)
            ctx.lineTo(dimensionLineX + 4, wallBottom)
            ctx.stroke()
            
            const inches = Math.round(distFromBottom / PX_PER_IN * 8) / 8
            ctx.save()
            ctx.translate(dimensionLineX - 8, (windowBottom + wallBottom) / 2)
            ctx.rotate(-Math.PI / 2)
            ctx.fillText(`${inches}"`, 0, 0)
            ctx.restore()
          }
          
          // Center distance indicator (from wall top to window center)
          const distFromTopToCenter = windowCenterY - wallTop
          if (distFromTopToCenter > inchesToPixels(0.5)) { // Only show if > 0.5"
            ctx.beginPath()
            ctx.moveTo(dimensionLineX3, wallTop)
            ctx.lineTo(dimensionLineX3, windowCenterY)
            // Add dimension line endpoints
            ctx.moveTo(dimensionLineX3 - 4, wallTop)
            ctx.lineTo(dimensionLineX3 + 4, wallTop)
            ctx.moveTo(dimensionLineX3 - 4, windowCenterY)
            ctx.lineTo(dimensionLineX3 + 4, windowCenterY)
            ctx.stroke()
            
            const inches = Math.round(distFromTopToCenter / PX_PER_IN * 8) / 8
            ctx.save()
            ctx.translate(dimensionLineX3 - 8, (wallTop + windowCenterY) / 2)
            ctx.rotate(-Math.PI / 2)
            ctx.fillText(`${inches}" C`, 0, 0)
            ctx.restore()
          }
          
          // Add dimension summary box for vertical walls
          const summaryX = baseDimensionX - inchesToPixels(6)
          const summaryY = windowTop + windowDepth / 4
          
          // Draw summary background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
          ctx.fillRect(summaryX - 20, summaryY - 10, 120, 20)
          ctx.strokeStyle = '#dc2626'
          ctx.lineWidth = 1
          ctx.strokeRect(summaryX - 20, summaryY - 10, 120, 20)
          
          // Add summary text
          ctx.font = 'bold 10px Arial'
          ctx.fillStyle = '#1f2937'
          ctx.textAlign = 'left'
          ctx.save()
          ctx.translate(summaryX - 15, summaryY + 3)
          ctx.rotate(-Math.PI / 2)
          ctx.fillText(`T:${Math.round(distFromTop / PX_PER_IN * 8) / 8}" H:${Math.round(windowWidth / PX_PER_IN * 8) / 8}" B:${Math.round(distFromBottom / PX_PER_IN * 8) / 8}"`, 0, 0)
          ctx.restore()
        }
      }
    })
  }

  // Draw cabinet position indicators relative to walls
  const drawCabinetPositionIndicators = (ctx: CanvasRenderingContext2D, instance: Instance) => {
    if (!isDragging || selectedIds.length !== 1 || selectedIds[0] !== instance.id) return
    
    const template = getTemplateById(templates, instance.templateId)
    if (!template || template.category === 'room') return
    
    const cabinetX = inchesToPixels(instance.x)
    const cabinetY = inchesToPixels(instance.y)
    const cabinetWidth = inchesToPixels(instance.widthIn || 0)
    const cabinetDepth = inchesToPixels(instance.depthIn || 0)
    
    // Find nearby walls
    allWalls.forEach(wall => {
      const wallLeft = Math.min(wall.x1, wall.x2)
      const wallRight = Math.max(wall.x1, wall.x2)
      const wallTop = Math.min(wall.y1, wall.y2)
      const wallBottom = Math.max(wall.y1, wall.y2)
      
      // Determine wall orientation
      const isHorizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1)
      
      if (isHorizontal) {
        // Horizontal wall - check if cabinet is close to this wall
        const wallCenterY = (wallTop + wallBottom) / 2
        const cabinetCenterY = cabinetY + cabinetDepth / 2
        
        if (Math.abs(cabinetCenterY - wallCenterY) < inchesToPixels(6)) {
          // Cabinet is near this horizontal wall
          const cabinetLeft = cabinetX
          const cabinetRight = cabinetX + cabinetWidth
          
          // Calculate distances from wall ends
          const distFromLeft = Math.abs(cabinetLeft - wallLeft)
          const distFromRight = Math.abs(cabinetRight - wallRight)
          
          // Draw distance indicators
          ctx.strokeStyle = '#ff6b6b'
          ctx.lineWidth = 2
          ctx.font = '12px Arial'
          ctx.fillStyle = '#ff6b6b'
          ctx.textAlign = 'center'
          
          // Left distance indicator
          if (distFromLeft < inchesToPixels(24)) { // Only show if within 24"
            const midY = Math.min(cabinetY, wallTop) - 15
            ctx.beginPath()
            ctx.moveTo(wallLeft, midY)
            ctx.lineTo(cabinetLeft, midY)
            ctx.stroke()
            
            const inches = Math.round(distFromLeft / PX_PER_IN * 8) / 8
            ctx.fillText(`${inches}"`, (wallLeft + cabinetLeft) / 2, midY - 5)
          }
          
          // Right distance indicator
          if (distFromRight < inchesToPixels(24)) { // Only show if within 24"
            const midY = Math.min(cabinetY, wallTop) - 15
            ctx.beginPath()
            ctx.moveTo(cabinetRight, midY)
            ctx.lineTo(wallRight, midY)
            ctx.stroke()
            
            const inches = Math.round(distFromRight / PX_PER_IN * 8) / 8
            ctx.fillText(`${inches}"`, (cabinetRight + wallRight) / 2, midY - 5)
          }
        }
      } else {
        // Vertical wall - check if cabinet is close to this wall
        const wallCenterX = (wallLeft + wallRight) / 2
        const cabinetCenterX = cabinetX + cabinetWidth / 2
        
        if (Math.abs(cabinetCenterX - wallCenterX) < inchesToPixels(6)) {
          // Cabinet is near this vertical wall
          const cabinetTop = cabinetY
          const cabinetBottom = cabinetY + cabinetDepth
          
          // Calculate distances from wall ends
          const distFromTop = Math.abs(cabinetTop - wallTop)
          const distFromBottom = Math.abs(cabinetBottom - wallBottom)
          
          // Draw distance indicators
          ctx.strokeStyle = '#ff6b6b'
          ctx.lineWidth = 2
          ctx.font = '12px Arial'
          ctx.fillStyle = '#ff6b6b'
          ctx.textAlign = 'center'
          
          // Top distance indicator
          if (distFromTop < inchesToPixels(24)) { // Only show if within 24"
            const midX = Math.min(cabinetX, wallLeft) - 15
            ctx.beginPath()
            ctx.moveTo(midX, wallTop)
            ctx.lineTo(midX, cabinetTop)
            ctx.stroke()
            
            const inches = Math.round(distFromTop / PX_PER_IN * 8) / 8
            ctx.fillText(`${inches}"`, midX - 5, (wallTop + cabinetTop) / 2)
          }
          
          // Bottom distance indicator
          if (distFromBottom < inchesToPixels(24)) { // Only show if within 24"
            const midX = Math.min(cabinetX, wallLeft) - 15
            ctx.beginPath()
            ctx.moveTo(midX, cabinetBottom)
            ctx.lineTo(midX, wallBottom)
            ctx.stroke()
            
            const inches = Math.round(distFromBottom / PX_PER_IN * 8) / 8
            ctx.fillText(`${inches}"`, midX - 5, (cabinetBottom + wallBottom) / 2)
          }
        }
      }
    })
  }

  // Draw coordinate display
  const drawCoordinateDisplay = (ctx: CanvasRenderingContext2D) => {
    if (!ui.rulers) return

    const x = mouseCoords.x
    const y = mouseCoords.y
    
    // Convert to inches
    const inchesX = Math.round(x / PX_PER_IN * 8) / 8 // Round to nearest 1/8"
    const inchesY = Math.round(y / PX_PER_IN * 8) / 8 // Round to nearest 1/8"
    
    // Draw coordinate display box
    const text = `X: ${inchesX}" Y: ${inchesY}"`
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(x + 10, y - 20, text.length * 6 + 10, 20)
    
    ctx.fillStyle = '#fff'
    ctx.font = '12px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(text, x + 15, y - 8)
  }

  // Draw walls
  const drawWalls = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3
    
    allWalls.forEach(wall => {
      ctx.beginPath()
      ctx.moveTo(wall.x1, wall.y1)
      ctx.lineTo(wall.x2, wall.y2)
      ctx.stroke()
    })
  }

  // Draw instances
  const drawInstances = (ctx: CanvasRenderingContext2D) => {
    // Sort instances by category for proper layering
    // Base cabinets first, then wall cabinets on top
    const sortedInstances = [...instances].sort((a, b) => {
      const templateA = getTemplateById(templates, a.templateId)
      const templateB = getTemplateById(templates, b.templateId)
      
      if (!templateA || !templateB) return 0
      
      // Define rendering order: base < wall < tall < appliances < trim < room
      const order = { base: 0, wall: 1, tall: 2, appliances: 3, trim: 4, room: 5 }
      const orderA = order[templateA.category as keyof typeof order] ?? 6
      const orderB = order[templateB.category as keyof typeof order] ?? 6
      
      return orderA - orderB
    })
    
    sortedInstances.forEach(instance => {
      const template = getTemplateById(templates, instance.templateId)
      if (!template) return

      const x = inchesToPixels(instance.x)
      const y = inchesToPixels(instance.y)
      const width = inchesToPixels(instance.widthIn || 0)
      const height = inchesToPixels(instance.heightIn || 0)
      const depth = inchesToPixels(instance.depthIn || 0)
      
      const isSelected = selectedIds.includes(instance.id)
      
      // Different rendering based on category
      if (template.category === 'room') {
        // Windows and doors
        drawRoomElement(ctx, template, x, y, width, height, isSelected, instance)
      } else {
        // Cabinets and appliances
        drawCabinet(ctx, template, x, y, width, height, depth, isSelected, instance)
      }
    })
  }

  // Draw cabinet elements
  const drawCabinet = (ctx: CanvasRenderingContext2D, template: any, x: number, y: number, width: number, height: number, depth: number, isSelected: boolean, instance: Instance) => {
    ctx.save()
    
    // Apply rotation
    const centerX = x + width / 2
    const centerY = y + depth / 2
    ctx.translate(centerX, centerY)
    ctx.rotate((instance.rot || 0) * Math.PI / 180)
    ctx.translate(-centerX, -centerY)
    
    // Check if cabinet is snapped to a wall
    const isSnappedToWall = isInWallSnapZone(instance, walls)
    
    // Rectangle representing cabinet footprint in top view (width × depth)
    ctx.fillStyle = template.render.fill
    ctx.strokeStyle = isSelected ? "#3b82f6" : (isSnappedToWall ? "#10b981" : template.render.stroke)
    ctx.lineWidth = isSelected ? 3 : (isSnappedToWall ? 2 : 1)
    
    ctx.fillRect(x, y, width, depth)
    ctx.strokeRect(x, y, width, depth)
    
    
    // Label at the front of the cabinet (bottom on screen)
    ctx.fillStyle = '#333'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'
    
    // Position label at the front edge of the cabinet (bottom on screen)
    const frontX = x + width / 2  // Center horizontally
    const frontY = y + depth + 15 // Just below the front edge (bottom on screen)
    
    ctx.fillText(instance.derived.title, frontX, frontY)
    
    ctx.restore()
  }

  // Draw room elements (windows, doors, walls)
  const drawRoomElement = (ctx: CanvasRenderingContext2D, template: any, x: number, y: number, width: number, height: number, isSelected: boolean, instance: Instance) => {
    ctx.save()
    
    // Apply rotation
    const centerX = x + width / 2
    const centerY = y + height / 2
    ctx.translate(centerX, centerY)
    ctx.rotate((instance.rot || 0) * Math.PI / 180)
    ctx.translate(-centerX, -centerY)
    
    ctx.fillStyle = template.render.fill
    ctx.strokeStyle = isSelected ? "#3b82f6" : template.render.stroke
    ctx.lineWidth = isSelected ? 3 : 2
    
    if (template.id.startsWith('WINDOW')) {
      // Draw window to match wall depth
      const windowDepth = inchesToPixels(instance.depthIn || 4) // Use instance depth or default to 4"
      
      // Window frame (darker outline) - use selection color if selected
      ctx.strokeStyle = isSelected ? "#3b82f6" : '#8B4513' // Blue if selected, brown if not
      ctx.lineWidth = isSelected ? 3 : 2
      ctx.strokeRect(x, y, width, windowDepth)
      
      // Window glass area (light blue fill)
      ctx.fillStyle = '#e6f3ff' // Light blue for window glass
      ctx.fillRect(x + 2, y + 2, width - 4, windowDepth - 4)
      
      // Window mullions (cross pattern)
      ctx.strokeStyle = isSelected ? '#1e40af' : '#8B4513' // Blue if selected, brown if not
      ctx.lineWidth = 1
      
      // Vertical mullion (center)
      ctx.beginPath()
      ctx.moveTo(x + width / 2, y + 2)
      ctx.lineTo(x + width / 2, y + windowDepth - 2)
      ctx.stroke()
      
      // Horizontal mullion (center)
      ctx.beginPath()
      ctx.moveTo(x + 2, y + windowDepth / 2)
      ctx.lineTo(x + width - 2, y + windowDepth / 2)
      ctx.stroke()
      
      // Add a prominent highlight when window is selected
      if (isSelected) {
        // Draw a bright blue selection box around the window
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 3
        ctx.setLineDash([8, 4])
        ctx.strokeRect(x - 4, y - 4, width + 8, windowDepth + 8)
        ctx.setLineDash([])
        
        // Add corner handles to show it's selected
        const handleSize = 6
        ctx.fillStyle = '#3b82f6'
        // Top-left corner
        ctx.fillRect(x - 4, y - 4, handleSize, handleSize)
        // Top-right corner
        ctx.fillRect(x + width - 2, y - 4, handleSize, handleSize)
        // Bottom-left corner
        ctx.fillRect(x - 4, y + windowDepth - 2, handleSize, handleSize)
        // Bottom-right corner
        ctx.fillRect(x + width - 2, y + windowDepth - 2, handleSize, handleSize)
      }
      
    } else if (template.id.startsWith('DOOR')) {
      // Draw door opening in top view (thin rectangle representing the opening)
      ctx.fillStyle = '#f5f5dc' // Light beige for door opening
      ctx.fillRect(x, y, width, 6) // 6px thick to represent door opening
      ctx.strokeStyle = template.render.stroke
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, 6)
      
      // Door swing arc (showing swing direction)
      ctx.strokeStyle = '#8B4513' // Brown for swing arc
      ctx.lineWidth = 2
      ctx.beginPath()
      if (template.id.includes('SINGLE')) {
        // Single door swing - arc from door edge
        ctx.arc(x + width, y + 3, width * 0.8, 0, Math.PI/2)
      } else if (template.id.includes('DOUBLE')) {
        // Double door swing - arc from center
        ctx.arc(x + width/2, y + 3, width/2 * 0.8, 0, Math.PI/2)
      } else if (template.id.includes('SLIDING')) {
        // Sliding door - show track
        ctx.strokeStyle = '#666'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, y + 6)
        ctx.lineTo(x + width, y + 6)
        ctx.stroke()
        // Add small rectangles to show door panels
        ctx.fillStyle = '#8B4513'
        ctx.fillRect(x + 2, y + 1, width/2 - 2, 4)
        ctx.fillRect(x + width/2 + 2, y + 1, width/2 - 2, 4)
      }
      ctx.stroke()
      
      } else if (template.id.startsWith('WALL')) {
        // Draw wall segment as 4" wide rectangle
        ctx.fillStyle = template.render.fill
        ctx.strokeStyle = isSelected ? "#3b82f6" : template.render.stroke
        ctx.lineWidth = isSelected ? 3 : 1
        
        // Draw wall as rectangle (4" thick)
        ctx.fillRect(x, y, width, 12) // 12px = 4" at 3px/inch scale
        ctx.strokeRect(x, y, width, 12)
        
        // Draw dimension line for wall length
        drawWallDimension(ctx, x, y, width, isSelected)
        
        // If there's a selected window nearby, also show wall length for context
        if (selectedIds.length === 1) {
          const selectedInstance = instances.find(i => i.id === selectedIds[0])
          if (selectedInstance) {
            const selectedTemplate = getTemplateById(templates, selectedInstance.templateId)
            if (selectedTemplate && selectedTemplate.id.startsWith('WINDOW')) {
              // Show wall length when window is selected for context
              const wallLengthInches = Math.round(width / PX_PER_IN * 8) / 8
              ctx.fillStyle = '#666'
              ctx.font = '10px Arial'
              ctx.textAlign = 'center'
              ctx.fillText(`Wall: ${wallLengthInches}"`, x + width / 2, y - 25)
            }
          }
        }
      }
    
    // Label (skip for walls - they have dimension lines instead)
    if (!template.id.startsWith('WALL')) {
      ctx.fillStyle = '#333'
      ctx.font = '10px Arial'
      ctx.fillText(instance.derived.title, x + 2, y + 12)
    }
    
    ctx.restore()
  }

  // Draw dimension line for wall segments
  const drawWallDimension = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, isSelected: boolean) => {
    const dimensionOffset = 20 // Distance from wall to dimension line
    
    // Calculate wall length in inches
    const lengthInches = Math.round(width / PX_PER_IN * 8) / 8 // Round to nearest 1/8"
    
    // Dimension line position (above the wall)
    const dimY = y - dimensionOffset
    
    // Extension lines (vertical lines from wall ends)
    ctx.strokeStyle = isSelected ? '#3b82f6' : '#666'
    ctx.lineWidth = 1
    
    // Left extension line
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, dimY)
    ctx.stroke()
    
    // Right extension line
    ctx.beginPath()
    ctx.moveTo(x + width, y)
    ctx.lineTo(x + width, dimY)
    ctx.stroke()
    
    // Main dimension line (horizontal)
    ctx.beginPath()
    ctx.moveTo(x, dimY)
    ctx.lineTo(x + width, dimY)
    ctx.stroke()
    
    // Oblique ticks (45-degree lines at ends)
    const tickLength = 6
    
    // Left oblique tick
    ctx.beginPath()
    ctx.moveTo(x - tickLength/2, dimY - tickLength/2)
    ctx.lineTo(x + tickLength/2, dimY + tickLength/2)
    ctx.stroke()
    
    // Right oblique tick
    ctx.beginPath()
    ctx.moveTo(x + width - tickLength/2, dimY - tickLength/2)
    ctx.lineTo(x + width + tickLength/2, dimY + tickLength/2)
    ctx.stroke()
    
    // Dimension text
    ctx.fillStyle = isSelected ? '#3b82f6' : '#333'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${lengthInches}"`, x + width/2, dimY - 5)
  }

  // Handle mouse up on window to catch middle mouse release outside canvas
  useEffect(() => {
    const handleWindowMouseUp = () => {
      setIsPanning(false)
      setIsDragging(false)
    }

    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => window.removeEventListener('mouseup', handleWindowMouseUp)
  }, [])

  // Redraw when data changes
  useEffect(() => {
    draw()
  }, [instances, walls, ui, selectedIds])

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Use the new coordinate conversion function
    const { x, y } = screenToWorld(e.clientX, e.clientY)

    // Check for middle mouse button (button 1) for panning
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
      return
    }

    // Left click (button 0) for selection and dragging
    if (e.button !== 0) return

    // Handle dimensioning mode
    if (ui.mode === 'dimension') {
      const detectedEdge = detectComponentEdge(x, y)
      
      if (dimensioningState.phase === 'none') {
        // First phase: Click on an edge to start dimensioning
        if (detectedEdge) {
          setDimensioningState({
            phase: 'edge-selected',
            selectedEdge: detectedEdge,
            endPoint: null
          })
          console.log(`Selected first edge for dimensioning: ${detectedEdge.description}`)
        } else {
          // Clicked on empty space - do nothing
          console.log('Click on an edge to start dimensioning')
        }
      } else if (dimensioningState.phase === 'edge-selected') {
        // Second phase: Click on another edge to create dimension
        if (detectedEdge && detectedEdge.id !== dimensioningState.selectedEdge!.id) {
          // Calculate the actual distance between the two edges in world coordinates
          const edge1Start = { x: pixelsToInches(dimensioningState.selectedEdge!.start.x), y: pixelsToInches(dimensioningState.selectedEdge!.start.y) }
          const edge1End = { x: pixelsToInches(dimensioningState.selectedEdge!.end.x), y: pixelsToInches(dimensioningState.selectedEdge!.end.y) }
          const edge2Start = { x: pixelsToInches(detectedEdge.start.x), y: pixelsToInches(detectedEdge.start.y) }
          const edge2End = { x: pixelsToInches(detectedEdge.end.x), y: pixelsToInches(detectedEdge.end.y) }
          
          // Calculate distance between the closest points on the two edges
          const distance = Math.hypot(
            edge1Start.x - edge2Start.x,
            edge1Start.y - edge2Start.y
          )
          
          // Format the distance label
          const label = formatInches(distance, "feet-inches", 16)
          
          // Create dimension line between the two edges
          const newDimensionLine: DimensionLine = {
            id: `dim_${Date.now()}`,
            x1: pixelsToInches(dimensioningState.selectedEdge!.start.x),
            y1: pixelsToInches(dimensioningState.selectedEdge!.start.y),
            x2: pixelsToInches(detectedEdge.start.x),
            y2: pixelsToInches(detectedEdge.start.y),
            label: label,
            style: 'linear'
          }
          
          addDimensionLine(newDimensionLine)
          console.log(`Created dimension line from ${dimensioningState.selectedEdge!.description} to ${detectedEdge.description}: ${label}`)
          
          // Reset dimensioning state
          setDimensioningState({
            phase: 'none',
            selectedEdge: null,
            endPoint: null
          })
        } else if (detectedEdge && detectedEdge.id === dimensioningState.selectedEdge!.id) {
          // Clicked on same edge - deselect it
          setDimensioningState({
            phase: 'none',
            selectedEdge: null,
            endPoint: null
          })
          console.log(`Deselected edge: ${detectedEdge.description}`)
        } else {
          // Clicked on empty space - do nothing, keep current selection
          console.log('Click on another edge to complete the dimension')
        }
      }
      return
    }

    // Check if clicking on an instance - prioritize wall cabinets over base cabinets
    const clickedInstance = instances
      .map(instance => ({
        instance,
        template: getTemplateById(templates, instance.templateId)
      }))
      .filter(item => item.template) // Only include instances with valid templates
      .sort((a, b) => {
        // Sort by category priority: wall cabinets first (mounted above), then base cabinets, then room elements last
        const categoryOrder = { wall: 1, base: 2, tall: 3, appliances: 4, trim: 5, room: 6 }
        return categoryOrder[(a.template?.category as keyof typeof categoryOrder) || 'room'] - categoryOrder[(b.template?.category as keyof typeof categoryOrder) || 'room']
      })
      .find(item => {
        const { instance, template } = item

        const instanceX = inchesToPixels(instance.x)
        const instanceY = inchesToPixels(instance.y)
        const instanceWidth = inchesToPixels(instance.widthIn || 0)
        
        // For room elements (walls, windows, doors), use depth for click detection
        let instanceHeight = inchesToPixels(instance.depthIn || 0)
        if (template && template.category === 'room') {
          // For windows specifically, make them easier to click when inside walls
          if (template.id.startsWith('WINDOW')) {
            // Make window clickable area larger for easier selection
            instanceHeight = Math.max(instanceHeight, inchesToPixels(6)) // 6" tall clickable area for windows
          } else {
            // Other room elements should have a minimum clickable area
            instanceHeight = Math.max(instanceHeight, inchesToPixels(4)) // At least 4" tall clickable area
          }
        } else {
          // For cabinets, use depth for click detection in top view
          instanceHeight = inchesToPixels(instance.depthIn || 0)
        }
        
        // Check if click is within instance bounds
        const isWithinBounds = x >= instanceX && x <= instanceX + instanceWidth &&
                              y >= instanceY && y <= instanceY + instanceHeight
        
        // Debug logging
        if (isWithinBounds && template) {
          console.log(`Click within bounds of ${template.category} element:`, {
            templateId: template.id,
            category: template.category,
            clickPos: { x, y },
            instancePos: { x: instanceX, y: instanceY },
            instanceSize: { width: instanceWidth, height: instanceHeight },
            isWindow: template.id.startsWith('WINDOW')
          })
        }
        
        // Since we've sorted by priority, the first match should be selected
        return isWithinBounds
      })

    if (clickedInstance) {
      select(clickedInstance.instance.id, e.shiftKey)
      setIsDragging(true)
      setDragStart({ x, y })
      setDragStartTime(Date.now())
      setDragOffset({
        x: x - inchesToPixels(clickedInstance.instance.x),
        y: y - inchesToPixels(clickedInstance.instance.y)
      })
    } else {
      select('', false) // Clear selection
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Use the new coordinate conversion function
    const { x, y } = screenToWorld(e.clientX, e.clientY)

    // Update mouse coordinates for coordinate display (screen coordinates)
    const rect = canvas.getBoundingClientRect()
    setMouseCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top })

    // Handle dimensioning hover detection and preview
    if (ui.mode === 'dimension') {
      const detectedEdge = detectComponentEdge(x, y)
      
      if (dimensioningState.phase === 'none') {
        // First phase: Show hover highlighting for edges
        if (detectedEdge && (!hoveredEdge || detectedEdge.id !== hoveredEdge.id)) {
          console.log('Hovering over edge:', detectedEdge.description)
        }
        setHoveredEdge(detectedEdge)
      } else if (dimensioningState.phase === 'edge-selected') {
        // Second phase: Show hover highlighting and preview to second edge
        if (detectedEdge && detectedEdge.id !== dimensioningState.selectedEdge!.id) {
          // Show preview to the hovered edge
          setHoveredEdge(detectedEdge)
          setDimensioningState(prev => ({
            ...prev,
            endPoint: { x: pixelsToInches(detectedEdge.start.x), y: pixelsToInches(detectedEdge.start.y) }
          }))
        } else {
          // No edge detected or same edge - clear preview
          setHoveredEdge(null)
          setDimensioningState(prev => ({
            ...prev,
            endPoint: null
          }))
        }
      }
    } else {
      if (hoveredEdge) {
        console.log('Clearing hovered edge - mode:', ui.mode)
      }
      setHoveredEdge(null)
      // Reset dimensioning state when switching modes
      if (dimensioningState.phase !== 'none') {
        setDimensioningState({
          phase: 'none',
          selectedEdge: null,
          endPoint: null
        })
      }
    }

    // Handle panning with middle mouse button
    if (isPanning) {
      const deltaX = e.clientX - panStart.x
      const deltaY = e.clientY - panStart.y
      
      setPan({
        x: ui.pan.x + deltaX,
        y: ui.pan.y + deltaY
      })
      
      setPanStart({ x: e.clientX, y: e.clientY })
      return
    }

    if (!isDragging || selectedIds.length !== 1) return

    const instance = instances.find(i => i.id === selectedIds[0])
    if (!instance) return

    let newX = pixelsToInches(x - dragOffset.x)
    let newY = pixelsToInches(y - dragOffset.y)

    // Apply snap if enabled
    if (ui.snap) {
      newX = Math.round(newX)
      newY = Math.round(newY)
    }

    // Create temporary instance for collision detection
    const tempInstance = { ...instance, x: newX, y: newY }
    
    // Allow more movement tolerance for smoother dragging
    const dragDuration = Date.now() - dragStartTime
    const tolerance = dragDuration < 200 ? inchesToPixels(2) : inchesToPixels(1)
    
    // Check for hard wall collision first (prevents going through walls) - with high tolerance for smooth dragging
    if (checkWallCollision(tempInstance, allWalls, tolerance)) {
      // Hard collision - don't move
      return
    }
    
    // Check if in snap zone (within 2 inches of wall) - allow sliding along wall
    if (isInWallSnapZone(tempInstance, allWalls)) {
      // Try to snap to wall (this will allow sliding along the wall)
      const snapPosition = snapToWall(tempInstance, allWalls)
      if (snapPosition) {
        // Check if snapped position is valid (no collisions) - with high tolerance
        const snappedInstance = { ...instance, x: snapPosition.x, y: snapPosition.y }
        if (!checkWallCollision(snappedInstance, allWalls, tolerance) && 
            !checkInstanceCollisions(snappedInstance, instances.filter(i => i.id !== instance.id), templates)) {
          newX = snapPosition.x
          newY = snapPosition.y
        }
        // If snapped position collides, keep original position
      }
    }
    
    // Check for instance collision (cabinet-to-cabinet) - with tolerance
    if (checkInstanceCollisions(tempInstance, instances.filter(i => i.id !== instance.id), templates)) {
      // If collides with other instances, don't move
      return
    }

    // Check if this is a window being dragged near a wall - auto-snap to wall
    const template = getTemplateById(templates, instance.templateId)
    if (template && template.id.startsWith('WINDOW')) {
      console.log("Window being dragged, checking for nearby walls. Total walls:", allWalls.length)
      const wallDetection = detectWallForWindowPlacement(x, y)
      if (wallDetection) {
        console.log("Window dragged near wall, auto-positioning inside wall", wallDetection)
        // Auto-position window in the wall but don't force center - let user position it
        const wall = allWalls.find(w => w.id === wallDetection.wallId)
        if (wall) {
          const isHorizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1)
          
          if (isHorizontal) {
            // Horizontal wall - position window horizontally where dragged, but center vertically in wall
            const finalY = pixelsToInches((wall.y1 + wall.y2) / 2) // Center in wall thickness (no offset)
            
            console.log(`Auto-positioning window vertically to wall center: Y=${finalY}`)
            newY = finalY
            // Keep X position where user dragged it (don't force center)
          } else {
            // Vertical wall - position window vertically where dragged, but center horizontally in wall
            const finalX = pixelsToInches((wall.x1 + wall.x2) / 2) // Center in wall thickness (no offset)
            
            console.log(`Auto-positioning window horizontally to wall center: X=${finalX}`)
            newX = finalX
            // Keep Y position where user dragged it (don't force center)
          }
        }
      } else {
        console.log("No wall detected near window at position:", x, y)
      }
    }

    moveInstance(instance.id, newX, newY)
  }

  // Zoom functions
  const handleZoomExtent = () => {
    if (instances.length === 0 && allWalls.length === 0) {
      // If no content, reset to default view
      setZoom(1)
      setPan({ x: 0, y: 0 })
      return
    }

    // Calculate bounds of all content
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    // Include instances
    instances.forEach(instance => {
      const x = inchesToPixels(instance.x)
      const y = inchesToPixels(instance.y)
      const width = inchesToPixels(instance.widthIn || 0)
      const height = inchesToPixels(instance.depthIn || 0)
      
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + width)
      maxY = Math.max(maxY, y + height)
    })

    // Include walls
    allWalls.forEach(wall => {
      minX = Math.min(minX, wall.x1, wall.x2)
      minY = Math.min(minY, wall.y1, wall.y2)
      maxX = Math.max(maxX, wall.x1, wall.x2)
      maxY = Math.max(maxY, wall.y1, wall.y2)
    })

    // Add padding
    const padding = inchesToPixels(24) // 24" padding
    minX -= padding
    minY -= padding
    maxX += padding
    maxY += padding

    // Calculate zoom to fit content
    const contentWidth = maxX - minX
    const contentHeight = maxY - minY
    const canvasWidth = canvasSize.width - RULER_SIZE
    const canvasHeight = canvasSize.height - RULER_SIZE
    
    const zoomX = canvasWidth / contentWidth
    const zoomY = canvasHeight / contentHeight
    const newZoom = Math.min(zoomX, zoomY, 2) // Cap at 2x zoom

    // Center the content
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    
    const newPanX = canvasSize.width / 2 - centerX * newZoom
    const newPanY = canvasSize.height / 2 - centerY * newZoom

    setZoom(newZoom)
    setPan({ x: newPanX, y: newPanY })
    setContextMenu({ visible: false, x: 0, y: 0, instanceId: "" })
  }

  const handleWindowPlacement = (options: { width: number; positionType: 'from-left' | 'from-right' | 'center'; distance: number }) => {
    if (!windowPlacement.wallId || !windowPlacement.templateId) return

    // Find the window instance by the currently selected ID (more precise than templateId)
    const selectedWindow = instances.find(i => i.id === selectedIds[0] && i.templateId === windowPlacement.templateId)
    if (!selectedWindow) {
      console.error('Selected window instance not found for ID:', selectedIds[0], 'templateId:', windowPlacement.templateId)
      return
    }
    
    console.log('Found specific window instance for placement:', selectedWindow.id, selectedWindow.templateId)

    // Find the wall
    const wall = allWalls.find(w => w.id === windowPlacement.wallId)
    if (!wall) return

    // Calculate window position based on options
    let windowX: number
    let windowY: number

    // Convert inches to pixels for calculations
    const distancePixels = inchesToPixels(options.distance)
    const widthPixels = inchesToPixels(options.width)

    const isHorizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1)
    
    if (isHorizontal) {
      // Horizontal wall
      const wallLeft = Math.min(wall.x1, wall.x2)
      const wallRight = Math.max(wall.x1, wall.x2)
      
      switch (options.positionType) {
        case 'from-left':
          windowX = wallLeft + distancePixels
          break
        case 'from-right':
          windowX = wallRight - distancePixels - widthPixels
          break
        case 'center':
          const wallCenter = (wallLeft + wallRight) / 2
          windowX = wallCenter - widthPixels / 2 + distancePixels
          break
      }
      
      // Center window vertically in wall (4" thick wall, center window)
      windowY = (wall.y1 + wall.y2) / 2 // Center in wall thickness (no offset)
    } else {
      // Vertical wall
      const wallTop = Math.min(wall.y1, wall.y2)
      const wallBottom = Math.max(wall.y1, wall.y2)
      
      switch (options.positionType) {
        case 'from-left':
          windowY = wallTop + distancePixels
          break
        case 'from-right':
          windowY = wallBottom - distancePixels - widthPixels
          break
        case 'center':
          const wallCenter = (wallTop + wallBottom) / 2
          windowY = wallCenter - widthPixels / 2 + distancePixels
          break
      }
      
      // Center window horizontally in wall (4" thick wall, center window)
      windowX = (wall.x1 + wall.x2) / 2 // Center in wall thickness (no offset)
    }

    console.log(`Window placement: ${options.positionType}, distance: ${options.distance}", width: ${options.width}"`)
    console.log(`Calculated position: (${pixelsToInches(windowX)}, ${pixelsToInches(windowY)})`)

    // Update window width if it changed
    if (options.width !== selectedWindow.widthIn) {
      console.log(`Updating window width from ${selectedWindow.widthIn}" to ${options.width}"`)
      updateInstance(selectedWindow.id, { widthIn: options.width })
    }

    // Move the existing window instance to the calculated position
    console.log(`Moving ONLY window ${selectedWindow.id} to position (${pixelsToInches(windowX)}, ${pixelsToInches(windowY)})`)
    moveInstance(selectedWindow.id, pixelsToInches(windowX), pixelsToInches(windowY))

    // Ensure the window remains selected after placement for dimension display
    select(selectedWindow.id, false)
    console.log(`Selected window ${selectedWindow.id} after placement`)

    // Close window placement HUD
    setWindowPlacement({ visible: false, wallId: "", wallLength: 0, templateId: "" })
  }


  const detectWallForWindowPlacement = (x: number, y: number): { wallId: string; wallLength: number } | null => {
    // Find the nearest wall to the click point
    let nearestWall: any = null
    let minDistance = Infinity
    
    console.log(`Detecting walls for position (${x}, ${y}). Total walls: ${allWalls.length}`)
    
    for (const wall of allWalls) {
      const wallLeft = Math.min(wall.x1, wall.x2)
      const wallRight = Math.max(wall.x1, wall.x2)
      const wallTop = Math.min(wall.y1, wall.y2)
      const wallBottom = Math.max(wall.y1, wall.y2)
      
      // Determine wall orientation
      const isHorizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1)
      
      let distance: number
      
      if (isHorizontal) {
        // Horizontal wall - check distance to wall center line
        const wallCenterY = (wallTop + wallBottom) / 2
        distance = Math.abs(y - wallCenterY)
        
        // Check if click is within wall bounds horizontally and within wall thickness (very lenient)
        if (x >= wallLeft && x <= wallRight && distance <= inchesToPixels(12)) {
          const wallLength = pixelsToInches(wallRight - wallLeft)
          console.log(`Found horizontal wall at distance ${distance}px (${pixelsToInches(distance)}"). Wall bounds: ${wallLeft}-${wallRight}, click: ${x}`)
          if (distance < minDistance) {
            minDistance = distance
            nearestWall = { wallId: wall.id, wallLength }
          }
        }
      } else {
        // Vertical wall - check distance to wall center line
        const wallCenterX = (wallLeft + wallRight) / 2
        distance = Math.abs(x - wallCenterX)
        
        // Check if click is within wall bounds vertically and within wall thickness (very lenient)
        if (y >= wallTop && y <= wallBottom && distance <= inchesToPixels(12)) {
          const wallLength = pixelsToInches(wallBottom - wallTop)
          console.log(`Found vertical wall at distance ${distance}px (${pixelsToInches(distance)}"). Wall bounds: ${wallTop}-${wallBottom}, click: ${y}`)
          if (distance < minDistance) {
            minDistance = distance
            nearestWall = { wallId: wall.id, wallLength }
          }
        }
      }
    }
    
    return nearestWall
  }

  const handleZoomDefault = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setContextMenu({ visible: false, x: 0, y: 0, instanceId: "" })
  }

  const handleWindowPlacementCancel = () => {
    setWindowPlacement({ visible: false, wallId: "", wallLength: 0, templateId: "" })
  }

  const handleWindowPlacementPreviewChange = useCallback((options: { width: number; positionType: 'from-left' | 'from-right' | 'center'; distance: number }) => {
    // Only update if the values actually changed to prevent unnecessary re-renders
    setWindowPlacementPreview(prev => {
      if (prev.width === options.width && 
          prev.positionType === options.positionType && 
          prev.distance === options.distance) {
        return prev // No change, return same object
      }
      return options // Values changed, update
    })
  }, [])

  const handleMouseUp = () => {
    // Auto-snap windows to walls when mouse is released
    if (isDragging && selectedIds.length === 1) {
      const instance = instances.find(i => i.id === selectedIds[0])
      if (instance) {
        const template = getTemplateById(templates, instance.templateId)
        if (template && template.id.startsWith('WINDOW')) {
          console.log("Window dropped, checking for auto-snap to wall")
          
          // Get current mouse position for wall detection
          const canvas = canvasRef.current
          if (canvas) {
            const rect = canvas.getBoundingClientRect()
            // We need to get the current mouse position, but since this is mouse up,
            // we'll use the instance's current position
            const instanceX = inchesToPixels(instance.x)
            const instanceY = inchesToPixels(instance.y)
            
            const wallDetection = detectWallForWindowPlacement(instanceX, instanceY)
            if (wallDetection) {
              console.log("Auto-snapping window to wall on mouse up")
              const wall = allWalls.find(w => w.id === wallDetection.wallId)
              if (wall) {
                const isHorizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1)
                
                if (isHorizontal) {
                  // Horizontal wall - center window vertically in wall, keep horizontal position
                  const finalY = pixelsToInches((wall.y1 + wall.y2) / 2) // Center in wall thickness (no offset)
                  
                  console.log(`Mouse up: Moving window vertically to wall center: Y=${finalY}`)
                  // Only update Y position, keep X where user placed it
                  moveInstance(instance.id, instance.x, finalY)
                } else {
                  // Vertical wall - center window horizontally in wall, keep vertical position
                  const finalX = pixelsToInches((wall.x1 + wall.x2) / 2) // Center in wall thickness (no offset)
                  
                  console.log(`Mouse up: Moving window horizontally to wall center: X=${finalX}`)
                  // Only update X position, keep Y where user placed it
                  moveInstance(instance.id, finalX, instance.y)
                }
              }
            } else {
              console.log("No wall detected for auto-snap on mouse up")
            }
          }
        }
      }
    }
    
    setIsDragging(false)
    setIsPanning(false)
  }

  // Handle right-click for context menu
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    
    // Don't show context menu in dimensioning mode
    if (ui.mode === 'dimension') {
      return
    }
    
    const canvas = canvasRef.current
    if (!canvas) return

    // Use the new coordinate conversion function
    const { x, y } = screenToWorld(e.clientX, e.clientY)

    console.log(`Right-click at position: (${x}, ${y})`)

    // Check if right-clicking on an instance - prioritize windows over walls
    const clickedInstance = instances
      .map(instance => ({
        instance,
        template: getTemplateById(templates, instance.templateId)
      }))
      .filter(item => item.template) // Only include instances with valid templates
      .sort((a, b) => {
        // Sort by priority: windows first, then other elements, walls last
        const aIsWindow = a.template?.id.startsWith('WINDOW') ? 0 : (a.template?.id.startsWith('WALL') ? 2 : 1)
        const bIsWindow = b.template?.id.startsWith('WINDOW') ? 0 : (b.template?.id.startsWith('WALL') ? 2 : 1)
        return aIsWindow - bIsWindow
      })
      .find(item => {
        const { instance, template } = item

        const instanceX = inchesToPixels(instance.x)
        const instanceY = inchesToPixels(instance.y)
        const instanceWidth = inchesToPixels(instance.widthIn || 0)
        
        // For room elements (walls, windows, doors), use depth for click detection
        let instanceHeight = inchesToPixels(instance.depthIn || 0)
        if (template && template.category === 'room') {
          // For windows specifically, make them easier to click when inside walls
          if (template.id.startsWith('WINDOW')) {
            // Make window clickable area larger for easier selection
            instanceHeight = Math.max(instanceHeight, inchesToPixels(6)) // 6" tall clickable area for windows
          } else {
            // Other room elements should have a minimum clickable area
            instanceHeight = Math.max(instanceHeight, inchesToPixels(4)) // At least 4" tall clickable area
          }
        } else {
          // For cabinets, use depth for click detection in top view
          instanceHeight = inchesToPixels(instance.depthIn || 0)
        }
        
        // Debug logging for right-click detection
        const isWithinBounds = x >= instanceX && x <= instanceX + instanceWidth &&
                              y >= instanceY && y <= instanceY + instanceHeight
        
        if (isWithinBounds && template) {
          console.log(`Right-click within bounds of ${template.category} element:`, {
            templateId: template.id,
            category: template.category,
            clickPos: { x, y },
            instancePos: { x: instanceX, y: instanceY },
            instanceSize: { width: instanceWidth, height: instanceHeight },
            isWindow: template.id.startsWith('WINDOW'),
            isWall: template.id.startsWith('WALL')
          })
        }
        
        return isWithinBounds
      })

    const clickedItem = clickedInstance ? { instance: clickedInstance.instance, template: clickedInstance.template } : null

    if (clickedItem) {
      // Check if this is a window - offer placement options
      const { instance, template } = clickedItem
      if (template && template.id.startsWith('WINDOW')) {
        // For windows, show placement HUD instead of context menu
        const instanceX = inchesToPixels(instance.x)
        const instanceY = inchesToPixels(instance.y)
        const wallDetection = detectWallForWindowPlacement(instanceX, instanceY)
        
        console.log(`Right-clicked window, wall detection:`, wallDetection)
        
        if (wallDetection) {
          // First select the window to show blue highlighting
          select(instance.id)
          console.log(`Selected ONLY window ${instance.id} for placement control (selectedIds: ${selectedIds})`)
          
          setWindowPlacement({
            visible: true,
            wallId: wallDetection.wallId,
            wallLength: wallDetection.wallLength,
            templateId: instance.templateId
          })
          console.log(`Showing Window Placement HUD for window ${instance.id}`)
        } else {
          // No wall detected, but try to find the nearest wall anyway for window placement
          // This helps with subsequent placements where the window might not be exactly at wall center
          console.log(`No wall detected at window position (${instanceX}, ${instanceY}), trying broader search...`)
          
          // Try a broader search for walls near the window
          let nearestWall: any = null
          let minDistance = Infinity
          
          for (const wall of allWalls) {
            const wallLeft = Math.min(wall.x1, wall.x2)
            const wallRight = Math.max(wall.x1, wall.x2)
            const wallTop = Math.min(wall.y1, wall.y2)
            const wallBottom = Math.max(wall.y1, wall.y2)
            
            const isHorizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1)
            
            let distance: number
            if (isHorizontal) {
              // Check distance to wall center line for horizontal walls
              const wallCenterY = (wallTop + wallBottom) / 2
              distance = Math.abs(instanceY - wallCenterY)
              
              // Check if window is within wall bounds horizontally and reasonable distance vertically
              if (instanceX >= wallLeft && instanceX <= wallRight && distance <= inchesToPixels(24)) {
                const wallLength = pixelsToInches(wallRight - wallLeft)
                if (distance < minDistance) {
                  minDistance = distance
                  nearestWall = { wallId: wall.id, wallLength }
                }
              }
            } else {
              // Check distance to wall center line for vertical walls
              const wallCenterX = (wallLeft + wallRight) / 2
              distance = Math.abs(instanceX - wallCenterX)
              
              // Check if window is within wall bounds vertically and reasonable distance horizontally
              if (instanceY >= wallTop && instanceY <= wallBottom && distance <= inchesToPixels(24)) {
                const wallLength = pixelsToInches(wallBottom - wallTop)
                if (distance < minDistance) {
                  minDistance = distance
                  nearestWall = { wallId: wall.id, wallLength }
                }
              }
            }
          }
          
          if (nearestWall) {
            console.log(`Found nearby wall with broader search, showing Window Placement HUD`)
            // First select the window to show blue highlighting
            select(instance.id)
            console.log(`Selected ONLY window ${instance.id} for placement control (selectedIds: ${selectedIds})`)
            
            setWindowPlacement({
              visible: true,
              wallId: nearestWall.wallId,
              wallLength: nearestWall.wallLength,
              templateId: instance.templateId
            })
          } else {
            // Still no wall found, show regular context menu
            // First select the window to show blue highlighting
            select(instance.id)
            console.log(`Selected ONLY window ${instance.id} for context menu (selectedIds: ${selectedIds})`)
            
            setContextMenu({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              instanceId: instance.id
            })
            console.log(`No nearby wall found, showing regular context menu for window ${instance.id}`)
          }
        }
      } else {
        // Regular context menu for non-windows
        // First select the instance to show blue highlighting
        select(instance.id)
        console.log(`Selected ${template?.id || 'unknown element'} ${instance.id} for context menu`)
        
        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          instanceId: instance.id
        })
        console.log(`Showing regular context menu for ${template?.id || 'unknown element'}`)
      }
    } else {
      // Right-click on empty space - show zoom options
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        instanceId: "" // Empty instanceId indicates zoom menu
      })
    }
  }

  const handleRotate = (degrees: number) => {
    if (contextMenu.instanceId) {
      updateInstance(contextMenu.instanceId, { rot: degrees })
    }
    setContextMenu({ visible: false, x: 0, y: 0, instanceId: "" })
  }

  const handleMove = (direction: 'left' | 'right' | 'up' | 'down', distance: number) => {
    if (contextMenu.instanceId) {
      const instance = instances.find(i => i.id === contextMenu.instanceId)
      if (!instance) return
      
      let newX = instance.x
      let newY = instance.y
      
      switch (direction) {
        case 'left':
          newX = instance.x - distance
          break
        case 'right':
          newX = instance.x + distance
          break
        case 'up':
          newY = instance.y - distance
          break
        case 'down':
          newY = instance.y + distance
          break
      }
      
      // Check for collisions before moving
      const tempInstance = { ...instance, x: newX, y: newY }
      if (!checkWallCollision(tempInstance, allWalls, inchesToPixels(0.5)) && 
          !checkInstanceCollisions(tempInstance, instances.filter(i => i.id !== instance.id), templates)) {
        moveInstance(contextMenu.instanceId, newX, newY)
      }
    }
    setContextMenu({ visible: false, x: 0, y: 0, instanceId: "" })
  }

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, instanceId: "" })
  }

  const handleDelete = () => {
    if (contextMenu.instanceId) {
      deleteInstance(contextMenu.instanceId)
      console.log(`Deleted instance: ${contextMenu.instanceId}`)
    }
    setContextMenu({ visible: false, x: 0, y: 0, instanceId: "" })
  }

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const oldScale = ui.zoom
    const newScale = Math.max(0.1, Math.min(5, oldScale * (e.deltaY > 0 ? 0.9 : 1.1)))
    
    const newPanX = mouseX - (mouseX - ui.pan.x) * (newScale / oldScale)
    const newPanY = mouseY - (mouseY - ui.pan.y) * (newScale / oldScale)
    
    setZoom(newScale)
    setPan({ x: newPanX, y: newPanY })
  }

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIds.length === 0) return
      
      const nudgeAmount = e.shiftKey ? 6 : 1 // 6" or 1"
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          selectedIds.forEach(id => {
            const instance = instances.find(i => i.id === id)
            if (instance) {
              moveInstance(id, instance.x - nudgeAmount, instance.y)
            }
          })
          break
        case 'ArrowRight':
          e.preventDefault()
          selectedIds.forEach(id => {
            const instance = instances.find(i => i.id === id)
            if (instance) {
              moveInstance(id, instance.x + nudgeAmount, instance.y)
            }
          })
          break
        case 'ArrowUp':
          e.preventDefault()
          selectedIds.forEach(id => {
            const instance = instances.find(i => i.id === id)
            if (instance) {
              moveInstance(id, instance.x, instance.y - nudgeAmount)
            }
          })
          break
        case 'ArrowDown':
          e.preventDefault()
          selectedIds.forEach(id => {
            const instance = instances.find(i => i.id === id)
            if (instance) {
              moveInstance(id, instance.x, instance.y + nudgeAmount)
            }
          })
          break
        case 'Delete':
          e.preventDefault()
          // TODO: Implement delete selected
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, instances, moveInstance])

  return (
    <main className="flex-1 relative bg-background overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${
          ui.mode === 'select' ? 'cursor-default' : 'cursor-pointer'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
      />

      {/* Empty state */}
      {instances.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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
      )}
      {/* Window Placement HUD - Optional for manual positioning */}
      {windowPlacement.visible && (
        <WindowPlacementHUD
          visible={windowPlacement.visible}
          wallId={windowPlacement.wallId}
          wallLength={windowPlacement.wallLength}
          currentWindowWidth={instances.find(i => i.id === selectedIds[0])?.widthIn}
          onPlace={handleWindowPlacement}
          onCancel={handleWindowPlacementCancel}
          onPreviewChange={handleWindowPlacementPreviewChange}
        />
      )}
      
      {/* Context Menu */}
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          visible={contextMenu.visible}
          onClose={closeContextMenu}
          onRotate={handleRotate}
          onMove={handleMove}
          onDelete={contextMenu.instanceId ? handleDelete : undefined}
          onZoomExtent={handleZoomExtent}
          onZoomDefault={handleZoomDefault}
          currentRotation={instances.find(i => i.id === contextMenu.instanceId)?.rot || 0}
          instanceId={contextMenu.instanceId}
        />
    </main>
  )
}