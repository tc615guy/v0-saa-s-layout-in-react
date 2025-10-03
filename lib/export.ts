// Export utilities for BOM CSV and Plan PDF

import { Instance, Template, BOMRow, ExportOptions } from './types'
import { getTemplateById, resolveTokens } from './catalog'
import { fmtInches } from './units'

/**
 * Export BOM as CSV
 */
export function exportBOM(instances: Instance[], templates: Template[]): BOMRow[] {
  return instances.map(instance => {
    const template = getTemplateById(templates, instance.templateId)
    if (!template) {
      return {
        sku: 'UNKNOWN',
        title: 'Unknown Item',
        widthIn: 0,
        heightIn: 0,
        qty: 1,
        notes: 'Template not found'
      }
    }
    
    const resolved = resolveTokens(template, instance)
    
    return {
      sku: resolved.sku,
      title: resolved.title,
      widthIn: instance.widthIn || 0,
      heightIn: instance.heightIn || 0,
      qty: 1,
      notes: instance.options.notes || ''
    }
  })
}

/**
 * Convert BOM rows to CSV string
 */
export function bomToCSV(bomRows: BOMRow[]): string {
  const headers = ['SKU', 'Description', 'Width', 'Height', 'Qty', 'Notes']
  const rows = bomRows.map(row => [
    row.sku,
    row.title,
    fmtInches(row.widthIn),
    fmtInches(row.heightIn),
    row.qty.toString(),
    row.notes || ''
  ])
  
  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n')
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string = 'bom.csv'): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export plan as PDF
 */
export async function exportPlanPDF(
  canvasDataURL: string, 
  options: ExportOptions = {
    projectName: 'CabSketch Plan',
    date: new Date().toLocaleDateString(),
    scale: '1" = 1"'
  }
): Promise<void> {
  // Create a simple PDF using canvas-to-pdf approach
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // Set canvas size for PDF (8.5" x 11" at 150 DPI)
  canvas.width = 1275 // 8.5 * 150
  canvas.height = 1650 // 11 * 150
  
  // White background
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // Title block
  ctx.fillStyle = 'black'
  ctx.font = 'bold 24px Arial'
  ctx.fillText(options.projectName, 50, 50)
  
  ctx.font = '16px Arial'
  ctx.fillText(`Date: ${options.date}`, 50, 80)
  ctx.fillText(`Scale: ${options.scale}`, 50, 100)
  
  // Load and draw the canvas image
  const img = new Image()
  img.onload = () => {
    // Draw canvas image scaled to fit
    const imgWidth = canvas.width - 100
    const imgHeight = canvas.height - 200
    ctx.drawImage(img, 50, 150, imgWidth, imgHeight)
    
    // Draw scale bar
    drawScaleBar(ctx, 50, canvas.height - 100, 200, options.scale)
    
    // Convert to PDF (simplified - in production, use a proper PDF library)
    downloadCanvasAsPDF(canvas, `${options.projectName.replace(/\s+/g, '-')}-plan.pdf`)
  }
  
  img.src = canvasDataURL
}

/**
 * Draw scale bar on canvas
 */
function drawScaleBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, scale: string): void {
  ctx.strokeStyle = 'black'
  ctx.lineWidth = 2
  
  // Draw scale bar line
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + width, y)
  ctx.stroke()
  
  // Draw tick marks
  const tickCount = 5
  for (let i = 0; i <= tickCount; i++) {
    const tickX = x + (width * i) / tickCount
    ctx.beginPath()
    ctx.moveTo(tickX, y - 5)
    ctx.lineTo(tickX, y + 5)
    ctx.stroke()
  }
  
  // Draw scale label
  ctx.font = '12px Arial'
  ctx.fillText(scale, x, y - 10)
}

/**
 * Download canvas as PDF (simplified implementation)
 */
function downloadCanvasAsPDF(canvas: HTMLCanvasElement, filename: string): void {
  // In a real implementation, you'd use a PDF library like jsPDF
  // For now, we'll download as PNG
  const link = document.createElement('a')
  link.download = filename.replace('.pdf', '.png')
  link.href = canvas.toDataURL('image/png')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Generate canvas data URL from Konva stage
 */
export function getCanvasDataURL(stage: any): string {
  return stage.toDataURL({
    pixelRatio: 2,
    mimeType: 'image/png',
    quality: 1
  })
}

/**
 * Export complete BOM with summary
 */
export function exportCompleteBOM(instances: Instance[], templates: Template[]): void {
  const bomRows = exportBOM(instances, templates)
  
  // Add summary row
  const summaryRow: BOMRow = {
    sku: 'SUMMARY',
    title: `Total Items: ${bomRows.length}`,
    widthIn: 0,
    heightIn: 0,
    qty: bomRows.length,
    notes: `Generated on ${new Date().toLocaleDateString()}`
  }
  
  const csvContent = bomToCSV([...bomRows, summaryRow])
  downloadCSV(csvContent, `bom-${new Date().toISOString().split('T')[0]}.csv`)
}
