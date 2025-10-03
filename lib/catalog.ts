// Catalog management utilities

import { Template, Instance } from './types'
import catalogData from '@/data/catalog.generic.json'

/**
 * Load catalog templates from JSON
 */
export async function loadCatalog(): Promise<Template[]> {
  return catalogData as Template[]
}

/**
 * Resolve token placeholders in template strings
 * Replaces {W}, {H}, {D} with instance dimensions
 */
export function resolveTokens(template: Template, instance: Instance): { sku: string; title: string } {
  let sku = template.bom.skuBase
  let title = template.title
  
  // Replace width token
  if (instance.widthIn !== undefined) {
    sku = sku.replace(/{W}/g, instance.widthIn.toString())
    title = title.replace(/{W}/g, instance.widthIn.toString())
  }
  
  // Replace height token
  if (instance.heightIn !== undefined) {
    sku = sku.replace(/{H}/g, instance.heightIn.toString())
    title = title.replace(/{H}/g, instance.heightIn.toString())
  }
  
  // Replace depth token
  if (instance.depthIn !== undefined) {
    sku = sku.replace(/{D}/g, instance.depthIn.toString())
    title = title.replace(/{D}/g, instance.depthIn.toString())
  }
  
  return { sku, title }
}

/**
 * Create a new instance from template with defaults
 */
export function createInstance(template: Template, x: number = 12, y: number = 12): Instance {
  // For wall cabinets, calculate Y position based on top alignment
  let instanceY = y
  if (template.category === 'wall' && template.options?.topAlignment) {
    const topAlignment = parseFloat(template.options.topAlignment[1]) // Default to 90"
    instanceY = topAlignment - (template.heightIn || 0) // Position so top aligns with ceiling height
  }

  const instance: Instance = {
    id: `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    templateId: template.id,
    x,
    y: instanceY,
    rot: 0,
    widthIn: template.defaultWidthIn,
    heightIn: template.heightIn,
    depthIn: template.depthIn,
    options: {
      // Set default top alignment for wall cabinets
      ...(template.category === 'wall' && template.options?.topAlignment ? {
        topAlignment: template.options.topAlignment[1]
      } : {})
    },
    derived: {
      sku: '',
      title: ''
    }
  }
  
  // Resolve tokens with initial values
  instance.derived = resolveTokens(template, instance)
  
  return instance
}

/**
 * Update instance derived values when dimensions change
 */
export function updateInstanceDerived(template: Template, instance: Instance): Instance {
  return {
    ...instance,
    derived: resolveTokens(template, instance)
  }
}

/**
 * Get template by ID
 */
export function getTemplateById(templates: Template[], id: string): Template | undefined {
  // First try exact match
  let template = templates.find(t => t.id === id)
  if (template) return template
  
  // If no exact match, try to find template with tokens
  // For templates like "WALL_SEGMENT_{W}", we need to match the base pattern
  const baseId = id.replace(/_{[WHD]}$/, '') // Remove _{W}, _{H}, _{D} suffix
  template = templates.find(t => t.id.startsWith(baseId))
  
  return template
}

/**
 * Filter templates by category
 */
export function getTemplatesByCategory(templates: Template[], category: string): Template[] {
  return templates.filter(t => t.category === category)
}
