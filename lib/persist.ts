// Local storage persistence utilities

import { AppState } from './types'

const STORAGE_KEY = 'cabsketch_plan'

/**
 * Save state subset to localStorage
 */
export function saveLocal(key: string, stateSubset: any): void {
  try {
    const serialized = JSON.stringify(stateSubset)
    localStorage.setItem(key, serialized)
  } catch (error) {
    console.error('Failed to save to localStorage:', error)
  }
}

/**
 * Load state subset from localStorage
 */
export function loadLocal(key: string): any | null {
  try {
    const serialized = localStorage.getItem(key)
    if (serialized === null) return null
    return JSON.parse(serialized)
  } catch (error) {
    console.error('Failed to load from localStorage:', error)
    return null
  }
}

/**
 * Save complete plan to localStorage
 */
export function savePlan(state: AppState): void {
  const planData = {
    instances: state.instances,
    walls: state.walls,
    room: state.room,
    ui: {
      snap: state.ui.snap,
      zoom: state.ui.zoom,
      pan: state.ui.pan,
      rulers: state.ui.rulers
    },
    timestamp: new Date().toISOString()
  }
  
  saveLocal(STORAGE_KEY, planData)
}

/**
 * Load complete plan from localStorage
 */
export function loadPlan(): Partial<AppState> | null {
  const planData = loadLocal(STORAGE_KEY)
  if (!planData) return null
  
  return {
    instances: planData.instances || [],
    walls: planData.walls || [],
    room: planData.room || {
      ceilingHeightIn: 96,
      plumbing: { x: 0, y: 0 }
    },
    ui: {
      snap: planData.ui?.snap ?? true,
      zoom: planData.ui?.zoom ?? 1,
      pan: planData.ui?.pan ?? { x: 0, y: 0 },
      rulers: planData.ui?.rulers ?? true
    }
  }
}

/**
 * Clear saved plan from localStorage
 */
export function clearPlan(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Export plan as JSON file
 */
export function exportPlanAsJSON(state: AppState): void {
  const planData = {
    instances: state.instances,
    walls: state.walls,
    room: state.room,
    ui: state.ui,
    timestamp: new Date().toISOString(),
    version: '1.0'
  }
  
  const blob = new Blob([JSON.stringify(planData, null, 2)], {
    type: 'application/json'
  })
  
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cabsketch-plan-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Import plan from JSON file
 */
export function importPlanFromJSON(file: File): Promise<Partial<AppState>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const planData = JSON.parse(e.target?.result as string)
        
        const importedState: Partial<AppState> = {
          instances: planData.instances || [],
          walls: planData.walls || [],
          room: planData.room || {
            ceilingHeightIn: 96,
            plumbing: { x: 0, y: 0 }
          },
          ui: {
            snap: planData.ui?.snap ?? true,
            zoom: planData.ui?.zoom ?? 1,
            pan: planData.ui?.pan ?? { x: 0, y: 0 },
            rulers: planData.ui?.rulers ?? true
          }
        }
        
        resolve(importedState)
      } catch (error) {
        reject(new Error('Invalid JSON file'))
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
