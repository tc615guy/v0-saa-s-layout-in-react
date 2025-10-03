import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Geometry utilities for dimensioning
export type Point = { x: number; y: number }

export function dot(a: Point, b: Point) { return a.x * b.x + a.y * b.y }
export function sub(a: Point, b: Point) { return { x: a.x - b.x, y: a.y - b.y } }
export function add(a: Point, b: Point) { return { x: a.x + b.x, y: a.y + b.y } }
export function mul(a: Point, s: number) { return { x: a.x * s, y: a.y * s } }
export function len(a: Point) { return Math.hypot(a.x, a.y) }
export function norm(a: Point) { const L = len(a) || 1; return { x: a.x / L, y: a.y / L } }
export function perp(u: Point) { return { x: -u.y, y: u.x } }
export function midpoint(p: Point, q: Point) { return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } }

/** Point to segment distance in pixels */
export function pointToSegmentDistance(point: Point, segStart: Point, segEnd: Point): number {
  const ap = sub(point, segStart)
  const ab = sub(segEnd, segStart)
  const t = Math.max(0, Math.min(1, dot(ap, ab) / (dot(ab, ab) || 1)))
  const proj = add(segStart, mul(ab, t))
  return len(sub(point, proj))
}

/** Format inches to feet-inches or decimal inches */
export function formatInches(inches: number, display: "feet-inches" | "inches" = "feet-inches", precisionDenom: 2 | 4 | 8 | 16 = 16): string {
  if (display === "inches") {
    const rounded = Math.round(inches * precisionDenom) / precisionDenom
    return `${rounded.toFixed(precisionDenom >= 10 ? 2 : 3)}"`
  }
  
  const sign = inches < 0 ? "-" : ""
  inches = Math.abs(inches)
  const feet = Math.floor(inches / 12)
  const rem = inches - feet * 12
  const r = Math.round(rem * precisionDenom) / precisionDenom
  const whole = Math.floor(r)
  const frac = r - whole
  let fracTxt = ""
  if (frac > 1e-6) {
    const n = Math.round(frac * precisionDenom)
    fracTxt = ` ${n}/${precisionDenom}`
  }
  const inchPart = `${whole}${fracTxt}"`
  if (feet === 0) return `${sign}${inchPart}`
  return `${sign}${feet}'-${inchPart}`
}