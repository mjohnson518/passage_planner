'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '../ui/input'

interface LocationAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelected?: (place: {
    name: string
    latitude: number
    longitude: number
    formatted_address: string
  }) => void
  placeholder?: string
  className?: string
  id?: string
}

export default function LocationAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Enter port or location...',
  className = '',
  id
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google?.maps?.places) {
      initializeAutocomplete()
      return
    }

    // Load Google Maps Script
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    
    if (!apiKey) {
      console.warn('Google Maps API key not configured - autocomplete disabled')
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    
    script.onload = () => {
      setIsLoaded(true)
      initializeAutocomplete()
    }

    script.onerror = () => {
      console.error('Failed to load Google Maps')
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  const initializeAutocomplete = () => {
    if (!inputRef.current || !window.google?.maps?.places) return

    const autocomplete = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ['(cities)', 'establishment'],
        fields: ['formatted_address', 'geometry', 'name', 'address_components']
      }
    )

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      
      if (!place.geometry?.location) {
        console.warn('No geometry for selected place')
        return
      }

      const latitude = place.geometry.location.lat()
      const longitude = place.geometry.location.lng()
      const name = place.name || place.formatted_address || value

      // Update the input value
      onChange(name)

      // Call callback with full place data
      if (onPlaceSelected) {
        onPlaceSelected({
          name,
          latitude,
          longitude,
          formatted_address: place.formatted_address || name
        })
      }
    })
  }

  return (
    <Input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      id={id}
    />
  )
}

