// Zustand store for application state management

import { create } from 'zustand'
import { AppState, Template, Instance, Wall, Room, UIState, DimensionLine } from './types'
import { createInstance, updateInstanceDerived, getTemplateById } from './catalog'
import { roundToEighth, clampToAllowed } from './units'

interface AppStore extends AppState {
  // Template actions
  initTemplates: (templates: Template[]) => void
  
  // Instance actions
  addInstance: (templateId: string) => void
  updateInstance: (id: string, patch: Partial<Instance>) => void
  moveInstance: (id: string, x: number, y: number) => void
  deleteInstance: (id: string) => void
  
  // Selection actions
  select: (id: string, multi?: boolean) => void
  selectAll: () => void
  clearSelection: () => void
  deleteSelected: () => void
  
  // UI actions
  setZoom: (zoom: number) => void
  setPan: (pan: { x: number; y: number }) => void
  toggleSnap: () => void
  toggleRulers: () => void
  setMode: (mode: 'select' | 'wall' | 'window' | 'door' | 'dimension') => void
  setDimensioningMode: (mode: 'none' | 'linear' | 'extend') => void
  
  // Undo/Redo
  pushUndo: (operation: any) => void
  undo: () => void
  redo: () => void
  
  // Room actions
  updateRoom: (room: Partial<Room>) => void
  
  // Wall actions
  addWall: (wall: Wall) => void
  deleteWall: (id: string) => void
  
  // Dimension line actions
  addDimensionLine: (dimensionLine: DimensionLine) => void
  updateDimensionLine: (id: string, patch: Partial<DimensionLine>) => void
  deleteDimensionLine: (id: string) => void
  
  // Window placement actions
  setWindowPlacementMode: (templateId: string) => void
  
  // Window placement state
  windowPlacementMode: string | null
}

const initialState: AppState = {
  templates: [],
  instances: [],
  walls: [],
  dimensionLines: [],
  room: {
    ceilingHeightIn: 96,
    plumbing: { x: 0, y: 0 }
  },
  ui: {
    snap: true,
    zoom: 1,
    pan: { x: 0, y: 0 },
    rulers: true,
    mode: 'select' as const,
    dimensioningMode: 'none'
  },
  selectedIds: [],
  undoStack: [],
  redoStack: [],
  windowPlacementMode: null
}

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,
  
  initTemplates: (templates: Template[]) => {
    set({ templates })
  },
  
  addInstance: (templateId: string) => {
    const state = get()
    const template = getTemplateById(state.templates, templateId)
    if (!template) {
      console.error('Template not found:', templateId)
      return
    }
    
    console.log('Adding instance for template:', template.title, templateId)
    const instance = createInstance(template, 12, 12)
    console.log('Created instance:', instance)
    
    set(state => ({
      instances: [...state.instances, instance],
      selectedIds: [instance.id]
    }))
    
    // Push to undo stack
    get().pushUndo({ type: 'addInstance', instance })
  },
  
  updateInstance: (id: string, patch: Partial<Instance>) => {
    const state = get()
    const instance = state.instances.find(i => i.id === id)
    if (!instance) return
    
    const template = getTemplateById(state.templates, instance.templateId)
    if (!template) return
    
    // Handle width clamping
    if (patch.widthIn !== undefined && template.allowedWidthsIn) {
      patch.widthIn = clampToAllowed(patch.widthIn, template.allowedWidthsIn)
    }
    
    // Round dimensions to 1/8"
    if (patch.widthIn !== undefined) patch.widthIn = roundToEighth(patch.widthIn)
    if (patch.heightIn !== undefined) patch.heightIn = roundToEighth(patch.heightIn)
    if (patch.depthIn !== undefined) patch.depthIn = roundToEighth(patch.depthIn)
    
    // Push to undo stack before making changes
    get().pushUndo({ type: 'updateInstance', id, patch, previousInstance: instance })
    
    const updatedInstance = { ...instance, ...patch }
    
    // Update derived values if dimensions changed
    if (patch.widthIn !== undefined || patch.heightIn !== undefined || patch.depthIn !== undefined) {
      updatedInstance.derived = updateInstanceDerived(template, updatedInstance).derived
    }
    
    set(state => ({
      instances: state.instances.map(i => i.id === id ? updatedInstance : i)
    }))
  },
  
  moveInstance: (id: string, x: number, y: number) => {
    const state = get()
    
    // Apply snap if enabled
    if (state.ui.snap) {
      x = Math.round(x)
      y = Math.round(y)
    }
    
    set(state => ({
      instances: state.instances.map(i => 
        i.id === id ? { ...i, x, y } : i
      )
    }))
    
    // Push to undo stack
    get().pushUndo({ type: 'moveInstance', id, x, y })
  },
  
  deleteInstance: (id: string) => {
    set(state => ({
      instances: state.instances.filter(i => i.id !== id),
      selectedIds: state.selectedIds.filter(sid => sid !== id)
    }))
    
    // Push to undo stack
    get().pushUndo({ type: 'deleteInstance', id })
  },
  
  select: (id: string, multi: boolean = false) => {
    set(state => ({
      selectedIds: multi 
        ? state.selectedIds.includes(id)
          ? state.selectedIds.filter(sid => sid !== id)
          : [...state.selectedIds, id]
        : [id]
    }))
  },
  
  selectAll: () => {
    set(state => ({
      selectedIds: state.instances.map(i => i.id)
    }))
  },
  
  clearSelection: () => {
    set({ selectedIds: [] })
  },
  
  deleteSelected: () => {
    const state = get()
    const idsToDelete = state.selectedIds
    
    set(state => ({
      instances: state.instances.filter(i => !idsToDelete.includes(i.id)),
      selectedIds: []
    }))
    
    // Push to undo stack
    get().pushUndo({ type: 'deleteSelected', ids: idsToDelete })
  },
  
  setZoom: (zoom: number) => {
    set(state => ({
      ui: { ...state.ui, zoom: Math.max(0.1, Math.min(5, zoom)) }
    }))
  },
  
  setPan: (pan: { x: number; y: number }) => {
    set(state => ({
      ui: { ...state.ui, pan }
    }))
  },
  
  toggleSnap: () => {
    set(state => ({
      ui: { ...state.ui, snap: !state.ui.snap }
    }))
  },
  
  toggleRulers: () => {
    set(state => ({
      ui: { ...state.ui, rulers: !state.ui.rulers }
    }))
  },
  
  setMode: (mode: 'select' | 'wall' | 'window' | 'door' | 'dimension') => {
    set(state => ({
      ui: { ...state.ui, mode }
    }))
  },

  setDimensioningMode: (dimensioningMode: 'none' | 'linear' | 'extend') => {
    set(state => ({
      ui: { ...state.ui, dimensioningMode }
    }))
  },
  
  pushUndo: (operation: any) => {
    set(state => ({
      undoStack: [...state.undoStack.slice(-49), operation],
      redoStack: []
    }))
  },
  
  undo: () => {
    const state = get()
    if (state.undoStack.length === 0) return
    
    const operation = state.undoStack[state.undoStack.length - 1]
    
    // Remove the operation from undo stack
    const newUndoStack = state.undoStack.slice(0, -1)
    
    if (operation.type === 'addInstance') {
      // Undo add: remove the instance
      set(state => ({
        instances: state.instances.filter(i => i.id !== operation.instance.id),
        selectedIds: state.selectedIds.filter(id => id !== operation.instance.id),
        undoStack: newUndoStack,
        redoStack: [...state.redoStack, { type: 'addInstance', instance: operation.instance }]
      }))
    } else if (operation.type === 'updateInstance') {
      // Undo update: restore previous instance
      set(state => ({
        instances: state.instances.map(i => 
          i.id === operation.id ? operation.previousInstance : i
        ),
        undoStack: newUndoStack,
        redoStack: [...state.redoStack, { 
          type: 'updateInstance', 
          id: operation.id, 
          patch: operation.patch,
          previousInstance: state.instances.find(i => i.id === operation.id)
        }]
      }))
    } else if (operation.type === 'deleteInstance') {
      // Undo delete: restore the instance
      set(state => ({
        instances: [...state.instances, operation.instance],
        selectedIds: [...state.selectedIds, operation.instance.id],
        undoStack: newUndoStack,
        redoStack: [...state.redoStack, { type: 'deleteInstance', instance: operation.instance }]
      }))
    }
  },
  
  redo: () => {
    const state = get()
    if (state.redoStack.length === 0) return
    
    const operation = state.redoStack[state.redoStack.length - 1]
    
    // Remove the operation from redo stack
    const newRedoStack = state.redoStack.slice(0, -1)
    
    if (operation.type === 'addInstance') {
      // Redo add: add the instance back
      set(state => ({
        instances: [...state.instances, operation.instance],
        selectedIds: [...state.selectedIds, operation.instance.id],
        undoStack: [...state.undoStack, { type: 'addInstance', instance: operation.instance }],
        redoStack: newRedoStack
      }))
    } else if (operation.type === 'updateInstance') {
      // Redo update: apply the patch again
      const instance = state.instances.find(i => i.id === operation.id)
      if (instance) {
        const updatedInstance = { ...instance, ...operation.patch }
        set(state => ({
          instances: state.instances.map(i => 
            i.id === operation.id ? updatedInstance : i
          ),
          undoStack: [...state.undoStack, { 
            type: 'updateInstance', 
            id: operation.id, 
            patch: operation.patch,
            previousInstance: instance
          }],
          redoStack: newRedoStack
        }))
      }
    } else if (operation.type === 'deleteInstance') {
      // Redo delete: remove the instance again
      set(state => ({
        instances: state.instances.filter(i => i.id !== operation.instance.id),
        selectedIds: state.selectedIds.filter(id => id !== operation.instance.id),
        undoStack: [...state.undoStack, { type: 'deleteInstance', instance: operation.instance }],
        redoStack: newRedoStack
      }))
    }
  },
  
  updateRoom: (room: Partial<Room>) => {
    set(state => ({
      room: { ...state.room, ...room }
    }))
  },
  
  addWall: (wall: Wall) => {
    set(state => ({
      walls: [...state.walls, wall]
    }))
  },
  
  setWindowPlacementMode: (templateId: string) => {
    console.log("setWindowPlacementMode called with:", templateId)
    set({ windowPlacementMode: templateId })
    console.log("windowPlacementMode set to:", templateId)
  },
  
  deleteWall: (id: string) => {
    set(state => ({
      walls: state.walls.filter(w => w.id !== id)
    }))
  },

  // Dimension line actions
  addDimensionLine: (dimensionLine: DimensionLine) => {
    set(state => ({
      dimensionLines: [...state.dimensionLines, dimensionLine]
    }))
  },

  updateDimensionLine: (id: string, patch: Partial<DimensionLine>) => {
    set(state => ({
      dimensionLines: state.dimensionLines.map(dl => 
        dl.id === id ? { ...dl, ...patch } : dl
      )
    }))
  },

  deleteDimensionLine: (id: string) => {
    set(state => ({
      dimensionLines: state.dimensionLines.filter(dl => dl.id !== id)
    }))
  }
}))
