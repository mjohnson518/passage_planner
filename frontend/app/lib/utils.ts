import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}

export function formatDistance(distanceNm: number): string {
  return `${distanceNm.toFixed(1)} nm`
}

export function formatDuration(hours: number): string {
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  
  if (days > 0) {
    return `${days}d ${remainingHours.toFixed(0)}h`
  }
  return `${hours.toFixed(1)}h`
} 