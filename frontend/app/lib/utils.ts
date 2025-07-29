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

export function formatDistanceToNow(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
} 

export function toRelativeTime(date: Date | string): string {
  const now = new Date()
  const past = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return 'just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000)
    return `${months} month${months > 1 ? 's' : ''} ago`
  } else {
    const years = Math.floor(diffInSeconds / 31536000)
    return `${years} year${years > 1 ? 's' : ''} ago`
  }
} 