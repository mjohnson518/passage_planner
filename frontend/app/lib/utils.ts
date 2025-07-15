import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date))
}

export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
  }).format(new Date(date))
}

export function formatDistance(nm: number) {
  return `${nm.toFixed(1)} nm`
}

export function formatDuration(hours: number) {
  const days = Math.floor(hours / 24)
  const remainingHours = Math.floor(hours % 24)
  const minutes = Math.floor((hours % 1) * 60)
  
  if (days > 0) {
    return `${days}d ${remainingHours}h ${minutes}m`
  }
  return `${remainingHours}h ${minutes}m`
} 