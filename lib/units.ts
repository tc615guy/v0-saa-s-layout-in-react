// Measurement utilities for cabinet sketching

/**
 * Round inches to nearest 1/8" increment
 */
export function roundToEighth(inches: number): number {
  return Math.round(inches * 8) / 8
}

/**
 * Format inches as string with fractions
 * e.g., 33.125 → "33 1/8\""
 */
export function fmtInches(inches: number): string {
  const whole = Math.floor(inches)
  const fraction = inches - whole
  
  if (fraction === 0) {
    return `${whole}"`
  }
  
  // Convert to 8ths
  const eighths = Math.round(fraction * 8)
  
  if (eighths === 0) {
    return `${whole}"`
  }
  
  // Simplify fractions
  let num = eighths
  let den = 8
  
  // Reduce to lowest terms
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const divisor = gcd(num, den)
  num /= divisor
  den /= divisor
  
  if (den === 1) {
    return `${whole} ${num}"`
  }
  
  return `${whole} ${num}/${den}"`
}

/**
 * Parse inches string back to number
 * Handles formats like "33 1/8", "33.125", "33"
 */
export function parseInches(str: string): number {
  const trimmed = str.trim().replace(/"/g, '')
  
  // Handle decimal format
  if (trimmed.includes('.')) {
    return parseFloat(trimmed)
  }
  
  // Handle fraction format
  const parts = trimmed.split(' ')
  if (parts.length === 2) {
    const whole = parseInt(parts[0]) || 0
    const fraction = parts[1]
    
    if (fraction.includes('/')) {
      const [num, den] = fraction.split('/').map(n => parseInt(n))
      return whole + (num / den)
    }
  }
  
  // Handle whole number
  return parseInt(trimmed) || 0
}

/**
 * Clamp value to nearest allowed value
 */
export function clampToAllowed(value: number, allowed: number[]): number {
  if (allowed.length === 0) return value
  
  return allowed.reduce((prev, curr) => 
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  )
}

/**
 * Convert inches to pixels at given scale
 */
export function inchesToPixels(inches: number, scale: number = 3): number {
  return inches * scale
}

/**
 * Convert pixels to inches at given scale
 */
export function pixelsToInches(pixels: number, scale: number = 3): number {
  return pixels / scale
}
