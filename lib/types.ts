// Core types for the cabinet sketching application

export interface Template {
  id: string
  title: string
  category: 'base' | 'wall' | 'tall' | 'trim' | 'appliances' | 'room'
  defaultWidthIn?: number
  defaultHeightIn?: number
  depthIn?: number
  allowedWidthsIn?: number[]
  allowedHeightsIn?: number[]
  allowedDepthsIn?: number[]
  options?: Record<string, string[]>
  render: {
    symbol: string
    stroke: string
    fill: string
  }
  rules?: {
    requiresFillerIfGapLtIn?: number
    snap?: string[]
    mountHeightIn?: number
    checkCeilingClearance?: boolean
    mustBeNearPlumbingIn?: number
  }
  bom: {
    skuBase: string
    uom?: string
  }
}

export interface Instance {
  id: string
  templateId: string
  x: number
  y: number
  rot: number // Changed from 0|90|180|270 to number for 360-degree rotation
  widthIn?: number
  heightIn?: number
  depthIn?: number
  options: Record<string, string>
  derived: {
    sku: string
    title: string
  }
}

export interface Wall {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Room {
  ceilingHeightIn: number
  plumbing: {
    x: number
    y: number
  }
}

export interface Warning {
  instanceId: string
  code: string
  message: string
}

export interface DimensionLine {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  label?: string
  style?: 'linear' | 'angular'
}

export interface UIState {
  snap: boolean
  zoom: number
  pan: {
    x: number
    y: number
  }
  rulers: boolean
  mode: 'select' | 'wall' | 'window' | 'door' | 'dimension'
  dimensioningMode: 'none' | 'linear' | 'extend'
}

export interface AppState {
  templates: Template[]
  instances: Instance[]
  walls: Wall[]
  dimensionLines: DimensionLine[]
  room: Room
  ui: UIState
  selectedIds: string[]
  undoStack: any[]
  redoStack: any[]
  windowPlacementMode: string | null
}

export interface BOMRow {
  sku: string
  title: string
  widthIn: number
  heightIn: number
  qty: number
  notes?: string
}

export interface ExportOptions {
  projectName: string
  date: string
  scale: string
}
