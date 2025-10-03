// Rules engine for generating warnings

import { AppState, Warning, Instance, Wall } from './types'
import { getTemplateById } from './catalog'

/**
 * Evaluate all warnings for the current state
 */
export function evalWarnings(state: AppState): Warning[] {
  const warnings: Warning[] = []
  
  // Group instances by wall runs for filler analysis
  const wallRuns = getWallRuns(state.walls)
  
  state.instances.forEach(instance => {
    const template = getTemplateById(state.templates, instance.templateId)
    if (!template) return
    
    // Check filler requirements
    if (template.rules?.requiresFillerIfGapLtIn) {
      const fillerWarnings = checkFillerRequirements(instance, wallRuns, template.rules.requiresFillerIfGapLtIn)
      warnings.push(...fillerWarnings)
    }
    
    // Check ceiling clearance
    if (template.rules?.checkCeilingClearance && instance.heightIn) {
      const ceilingWarning = checkCeilingClearance(instance, state.room)
      if (ceilingWarning) warnings.push(ceilingWarning)
    }
    
    // Check wall mount height conflicts
    if (template.rules?.mountHeightIn) {
      const mountWarnings = checkWallMountConflicts(instance, state.instances, template.rules.mountHeightIn)
      warnings.push(...mountWarnings)
    }
    
    // Check plumbing proximity
    if (template.rules?.mustBeNearPlumbingIn) {
      const plumbingWarning = checkPlumbingProximity(instance, state.room, template.rules.mustBeNearPlumbingIn)
      if (plumbingWarning) warnings.push(plumbingWarning)
    }
  })
  
  return warnings
}

/**
 * Check filler requirements for wall runs
 */
function checkFillerRequirements(instance: Instance, wallRuns: Wall[][], threshold: number): Warning[] {
  const warnings: Warning[] = []
  
  // Find which wall run this instance belongs to
  const wallRun = wallRuns.find(run => 
    run.some(wall => isInstanceOnWall(instance, wall))
  )
  
  if (!wallRun) return warnings
  
  // Calculate total cabinet width in this run
  const totalCabinetWidth = wallRuns.reduce((total, run) => {
    if (run === wallRun) {
      return total + (instance.widthIn || 0)
    }
    return total
  }, 0)
  
  // Calculate wall span
  const wallSpan = wallRun.reduce((span, wall) => {
    const length = Math.sqrt(Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2))
    return span + length
  }, 0)
  
  const gap = wallSpan - totalCabinetWidth
  
  if (gap < threshold) {
    warnings.push({
      instanceId: instance.id,
      code: 'RUN_SLACK_LOW',
      message: `Wall run has only ${gap.toFixed(1)}" gap. Consider adding filler strips.`
    })
  }
  
  return warnings
}

/**
 * Check ceiling clearance for tall cabinets
 */
function checkCeilingClearance(instance: Instance, room: any): Warning | null {
  if (!instance.heightIn) return null
  
  const totalHeight = instance.heightIn + (room.crownHeight || 0)
  
  if (totalHeight > room.ceilingHeightIn) {
    return {
      instanceId: instance.id,
      code: 'CEILING_CONFLICT',
      message: `Cabinet height (${totalHeight}") exceeds ceiling height (${room.ceilingHeightIn}").`
    }
  }
  
  return null
}

/**
 * Check wall mount height conflicts
 */
function checkWallMountConflicts(instance: Instance, allInstances: Instance[], mountHeight: number): Warning[] {
  const warnings: Warning[] = []
  
  // Find adjacent tall cabinets that might conflict
  const adjacentTalls = allInstances.filter(other => {
    if (other.id === instance.id) return false
    if (!other.heightIn) return false
    
    // Check if cabinets are adjacent (simplified)
    const distance = Math.sqrt(
      Math.pow(other.x - instance.x, 2) + Math.pow(other.y - instance.y, 2)
    )
    
    return distance < 30 // Within 30" is considered adjacent
  })
  
  adjacentTalls.forEach(tall => {
    const wallBottom = mountHeight
    const tallTop = (tall.y || 0) + (tall.heightIn || 0)
    
    if (wallBottom < tallTop) {
      warnings.push({
        instanceId: instance.id,
        code: 'WALL_HEIGHT_CONFLICT',
        message: `Wall cabinet mount height conflicts with adjacent tall cabinet.`
      })
    }
  })
  
  return warnings
}

/**
 * Check plumbing proximity requirements
 */
function checkPlumbingProximity(instance: Instance, room: any, maxDistance: number): Warning | null {
  const distance = Math.sqrt(
    Math.pow(instance.x - room.plumbing.x, 2) + 
    Math.pow(instance.y - room.plumbing.y, 2)
  )
  
  if (distance > maxDistance) {
    return {
      instanceId: instance.id,
      code: 'PLUMBING_DISTANCE',
      message: `Cabinet is ${distance.toFixed(1)}" from plumbing. Maximum recommended: ${maxDistance}".`
    }
  }
  
  return null
}

/**
 * Group walls into continuous runs
 */
function getWallRuns(walls: Wall[]): Wall[][] {
  const runs: Wall[][] = []
  const used = new Set<string>()
  
  walls.forEach(wall => {
    if (used.has(wall.id)) return
    
    const run: Wall[] = [wall]
    used.add(wall.id)
    
    // Find connected walls
    let foundMore = true
    while (foundMore) {
      foundMore = false
      walls.forEach(otherWall => {
        if (used.has(otherWall.id)) return
        
        // Check if walls are connected (share endpoints)
        const lastWall = run[run.length - 1]
        if (areWallsConnected(lastWall, otherWall)) {
          run.push(otherWall)
          used.add(otherWall.id)
          foundMore = true
        }
      })
    }
    
    runs.push(run)
  })
  
  return runs
}

/**
 * Check if two walls are connected
 */
function areWallsConnected(wall1: Wall, wall2: Wall): boolean {
  const tolerance = 0.1
  
  return (
    Math.abs(wall1.x1 - wall2.x1) < tolerance && Math.abs(wall1.y1 - wall2.y1) < tolerance ||
    Math.abs(wall1.x1 - wall2.x2) < tolerance && Math.abs(wall1.y1 - wall2.y2) < tolerance ||
    Math.abs(wall1.x2 - wall2.x1) < tolerance && Math.abs(wall1.y2 - wall2.y1) < tolerance ||
    Math.abs(wall1.x2 - wall2.x2) < tolerance && Math.abs(wall1.y2 - wall2.y2) < tolerance
  )
}

/**
 * Check if instance is positioned on a wall
 */
function isInstanceOnWall(instance: Instance, wall: Wall): boolean {
  // Simplified check - instance back edge within 1" of wall
  const tolerance = 1
  
  // Calculate wall line equation
  const wallLength = Math.sqrt(Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2))
  if (wallLength === 0) return false
  
  // Calculate distance from instance center to wall line
  const distance = Math.abs(
    ((wall.y2 - wall.y1) * instance.x - (wall.x2 - wall.x1) * instance.y + wall.x2 * wall.y1 - wall.y2 * wall.x1) /
    wallLength
  )
  
  return distance < tolerance
}
