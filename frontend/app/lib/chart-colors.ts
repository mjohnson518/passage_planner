'use client'

import { useEffect, useState } from 'react'

/**
 * Centralized chart color constants for Recharts components.
 * Recharts renders to SVG and requires actual color values (not CSS variables).
 * This hook reads computed CSS variable values so charts respect the current theme.
 */

export interface ChartColors {
  primary: string
  secondary: string
  tertiary: string
  quaternary: string
  danger: string
  success: string
  warning: string
  muted: string
}

/** Fallback colors (light mode) — used server-side or before mount */
export const CHART_COLORS_FALLBACK: ChartColors = {
  primary: 'hsl(205, 85%, 28%)',    // ocean blue
  secondary: 'hsl(164, 100%, 38%)', // seafoam
  tertiary: 'hsl(38, 70%, 50%)',    // brass/amber
  quaternary: 'hsl(270, 50%, 45%)', // purple
  danger: 'hsl(0, 72%, 51%)',       // red
  success: 'hsl(142, 71%, 35%)',    // green
  warning: 'hsl(38, 92%, 42%)',     // amber
  muted: 'hsl(205, 30%, 70%)',      // muted ocean
}

function hslVarToString(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  // CSS custom property value is "H S% L%" — wrap in hsl()
  return `hsl(${trimmed})`
}

function readChartColors(): ChartColors {
  if (typeof window === 'undefined') return CHART_COLORS_FALLBACK
  const style = getComputedStyle(document.documentElement)
  return {
    primary: hslVarToString(style.getPropertyValue('--chart-1')) || CHART_COLORS_FALLBACK.primary,
    secondary: hslVarToString(style.getPropertyValue('--chart-2')) || CHART_COLORS_FALLBACK.secondary,
    tertiary: hslVarToString(style.getPropertyValue('--chart-3')) || CHART_COLORS_FALLBACK.tertiary,
    quaternary: hslVarToString(style.getPropertyValue('--chart-4')) || CHART_COLORS_FALLBACK.quaternary,
    danger: hslVarToString(style.getPropertyValue('--chart-5')) || CHART_COLORS_FALLBACK.danger,
    success: hslVarToString(style.getPropertyValue('--status-go')) || CHART_COLORS_FALLBACK.success,
    warning: hslVarToString(style.getPropertyValue('--status-caution')) || CHART_COLORS_FALLBACK.warning,
    muted: CHART_COLORS_FALLBACK.muted,
  }
}

/**
 * Hook that returns chart colors that automatically update when the theme changes.
 * Safe to use in 'use client' components that render Recharts charts.
 */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(CHART_COLORS_FALLBACK)

  useEffect(() => {
    setColors(readChartColors())

    // Watch for dark mode changes via the class attribute on <html>
    const observer = new MutationObserver(() => {
      setColors(readChartColors())
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return colors
}
