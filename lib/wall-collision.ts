// Wall collision and snapping utilities

import { Instance, Wall } from './types'
import { inchesToPixels, pixelsToInches } from './units'
import { getTemplateById } from './catalog'

/**
 * Check if a cabinet is in the snap zone of any wall (within 2 inches for smoother movement)
 */
export function isInWallSnapZone(instance: Instance, walls: Wall[]): boolean {
  const cabinetX = instance.x
  const cabinetY = instance.y
  const cabinetWidth = instance.widthIn || 0
  const cabinetDepth = instance.depthIn || 0
  
  // Convert to pixels for distance calculation
  const pxX = inchesToPixels(cabinetX)
  const pxY = inchesToPixels(cabinetY)
  const pxWidth = inchesToPixels(cabinetWidth)
  const pxDepth = inchesToPixels(cabinetDepth)
  
  // Cabinet center
  const cabinetCenterX = pxX + pxWidth / 2
  const cabinetCenterY = pxY + pxDepth / 2
  
  // Check distance to each wall
  for (const wall of walls) {
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
      distance = Math.abs(cabinetCenterY - wallCenterY)
    } else {
      // Vertical wall - check distance to wall center line
      const wallCenterX = (wallLeft + wallRight) / 2
      distance = Math.abs(cabinetCenterX - wallCenterX)
    }
    
    // Snap zone is 4 inches for smoother movement
    if (distance < inchesToPixels(4)) {
      return true
    }
  }
  
  return false
}

/**
 * Check if a cabinet collides with any wall (hard collision) - with tolerance for dragging
 */
export function checkWallCollision(instance: Instance, walls: Wall[], tolerance: number = 0): boolean {
  const cabinetX = instance.x
  const cabinetY = instance.y
  const cabinetWidth = instance.widthIn || 0
  const cabinetDepth = instance.depthIn || 0
  
  // Convert to pixels for collision detection
  const pxX = inchesToPixels(cabinetX)
  const pxY = inchesToPixels(cabinetY)
  const pxWidth = inchesToPixels(cabinetWidth)
  const pxDepth = inchesToPixels(cabinetDepth)
  
  // Cabinet bounding box
  const cabinetLeft = pxX
  const cabinetRight = pxX + pxWidth
  const cabinetTop = pxY
  const cabinetBottom = pxY + pxDepth
  
  // Check collision with each wall
  for (const wall of walls) {
    const wallLeft = Math.min(wall.x1, wall.x2)
    const wallRight = Math.max(wall.x1, wall.x2)
    const wallTop = Math.min(wall.y1, wall.y2)
    const wallBottom = Math.max(wall.y1, wall.y2)
    
    // Wall thickness (4" = 12px) + tolerance
    const wallThickness = inchesToPixels(4) + tolerance
    
    // Determine wall orientation
    const isHorizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1)
    
    let wallBounds
    if (isHorizontal) {
      // Horizontal wall - expand vertically
      wallBounds = {
        left: wallLeft,
        right: wallRight,
        top: wallTop - wallThickness / 2,
        bottom: wallBottom + wallThickness / 2
      }
    } else {
      // Vertical wall - expand horizontally
      wallBounds = {
        left: wallLeft - wallThickness / 2,
        right: wallRight + wallThickness / 2,
        top: wallTop,
        bottom: wallBottom
      }
    }
    
    // Check for collision using proper AABB collision detection
    if (cabinetLeft < wallBounds.right &&
        cabinetRight > wallBounds.left &&
        cabinetTop < wallBounds.bottom &&
        cabinetBottom > wallBounds.top) {
      return true
    }
  }
  
  return false
}

/**
 * Find the nearest wall for sliding along (allows free movement along wall axis)
 */
export function findNearestWallForSliding(instance: Instance, walls: Wall[]): { wall: Wall; distance: number; snapX?: number; snapY?: number } | null {
  const cabinetX = instance.x
  const cabinetY = instance.y
  const cabinetWidth = instance.widthIn || 0
  const cabinetDepth = instance.depthIn || 0
  
  let nearestWall: Wall | null = null
  let minDistance = Infinity
  let snapX: number | undefined
  let snapY: number | undefined
  
  for (const wall of walls) {
    const wallLeft = Math.min(wall.x1, wall.x2)
    const wallRight = Math.max(wall.x1, wall.x2)
    const wallTop = Math.min(wall.y1, wall.y2)
    const wallBottom = Math.max(wall.y1, wall.y2)
    
    // Determine wall orientation
    const isHorizontal = Math.abs(wall.y2 - wall.y1) < Math.abs(wall.x2 - wall.x1)
    
    let distance: number
    let snapPosition: { x: number; y: number } | null = null
    
    if (isHorizontal) {
      // Horizontal wall - check distance to wall center line
      const wallCenterY = (wallTop + wallBottom) / 2
      
      // Distance from cabinet center to wall center
      const cabinetCenterY = cabinetY + cabinetDepth / 2
      
      distance = Math.abs(cabinetCenterY - wallCenterY)
      
      // Only snap if cabinet is close to wall (within 3 inches)
      if (distance <= inchesToPixels(3)) {
        // Snap cabinet bottom edge to wall top edge, but allow free X movement
        snapPosition = {
          x: cabinetX, // Keep current X position for free sliding
          y: pixelsToInches(wallTop) - cabinetDepth
        }
      }
    } else {
      // Vertical wall - check distance to wall center line
      const wallCenterX = (wallLeft + wallRight) / 2
      
      // Distance from cabinet center to wall center
      const cabinetCenterX = cabinetX + cabinetWidth / 2
      
      distance = Math.abs(cabinetCenterX - wallCenterX)
      
      // Only snap if cabinet is close to wall (within 3 inches)
      if (distance <= inchesToPixels(3)) {
        // Snap cabinet right edge to wall left edge, but allow free Y movement
        snapPosition = {
          x: pixelsToInches(wallLeft) - cabinetWidth,
          y: cabinetY // Keep current Y position for free sliding
        }
      }
    }
    
    if (snapPosition && distance < minDistance) {
      minDistance = distance
      nearestWall = wall
      snapX = snapPosition.x
      snapY = snapPosition.y
    }
  }
  
  // Only snap if within reasonable distance (3 inches for smoother movement)
  if (minDistance <= inchesToPixels(3) && nearestWall) {
    return { wall: nearestWall, distance: minDistance, snapX, snapY }
  }
  
  return null
}

/**
 * Check if two instances collide with each other
 * Wall cabinets can move freely over base cabinets (they're mounted above)
 */
export function checkInstanceCollision(instance1: Instance, instance2: Instance, templates: any[]): boolean {
  if (instance1.id === instance2.id) return false
  
  // Get template categories for collision rules
  const template1 = getTemplateById(templates, instance1.templateId)
  const template2 = getTemplateById(templates, instance2.templateId)
  
  // Wall cabinets can move freely over base cabinets
  if (template1?.category === 'wall' && template2?.category === 'base') return false
  if (template1?.category === 'base' && template2?.category === 'wall') return false
  
  const x1 = instance1.x
  const y1 = instance1.y
  const w1 = instance1.widthIn || 0
  const d1 = instance1.depthIn || 0
  
  const x2 = instance2.x
  const y2 = instance2.y
  const w2 = instance2.widthIn || 0
  const d2 = instance2.depthIn || 0
  
  // AABB collision detection
  return x1 < x2 + w2 &&
         x1 + w1 > x2 &&
         y1 < y2 + d2 &&
         y1 + d1 > y2
}

/**
 * Check if an instance collides with any other instances
 */
export function checkInstanceCollisions(instance: Instance, allInstances: Instance[], templates: any[]): boolean {
  return allInstances.some(other => checkInstanceCollision(instance, other, templates))
}

/**
 * Snap cabinet to nearest wall if close enough - allows sliding along wall
 */
export function snapToWall(instance: Instance, walls: Wall[]): { x: number; y: number } | null {
  const snapResult = findNearestWallForSliding(instance, walls)
  
  if (snapResult && snapResult.snapX !== undefined && snapResult.snapY !== undefined) {
    return {
      x: snapResult.snapX,
      y: snapResult.snapY
    }
  }
  
  return null
}

