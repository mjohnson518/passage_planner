'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '../ui/input'
import { MapPin, Check } from 'lucide-react'

interface Port {
  name: string
  lat: number
  lng: number
  country?: string
}

interface PortSelectorProps {
  value: string
  onChange: (value: string) => void
  onPortSelected: (port: Port) => void
  placeholder?: string
  className?: string
  id?: string
  'data-testid'?: string
}

// Global port database for fallback when Google Maps unavailable
const GLOBAL_PORTS: Port[] = [
  // US East Coast
  { name: 'Boston, MA', lat: 42.3601, lng: -71.0589, country: 'USA' },
  { name: 'Portland, ME', lat: 43.6591, lng: -70.2568, country: 'USA' },
  { name: 'Newport, RI', lat: 41.4901, lng: -71.3128, country: 'USA' },
  { name: 'New York, NY', lat: 40.7128, lng: -74.0060, country: 'USA' },
  { name: 'Charleston, SC', lat: 32.7765, lng: -79.9311, country: 'USA' },
  { name: 'Miami, FL', lat: 25.7617, lng: -80.1918, country: 'USA' },
  { name: 'Key West, FL', lat: 24.5551, lng: -81.7800, country: 'USA' },
  
  // Caribbean
  { name: 'Nassau, Bahamas', lat: 25.0480, lng: -77.3554, country: 'Bahamas' },
  { name: 'Hamilton, Bermuda', lat: 32.2949, lng: -64.7829, country: 'Bermuda' },
  { name: 'Bridgetown, Barbados', lat: 13.0969, lng: -59.6145, country: 'Barbados' },
  { name: 'St. Lucia (Rodney Bay)', lat: 14.0781, lng: -60.9542, country: 'St. Lucia' },
  { name: 'Antigua (English Harbour)', lat: 17.0051, lng: -61.7579, country: 'Antigua' },
  
  // Mediterranean
  { name: 'Gibraltar', lat: 36.1408, lng: -5.3536, country: 'UK' },
  { name: 'Barcelona, Spain', lat: 41.3851, lng: 2.1734, country: 'Spain' },
  { name: 'Athens (Piraeus), Greece', lat: 37.9422, lng: 23.6470, country: 'Greece' },
  { name: 'Valletta, Malta', lat: 35.8989, lng: 14.5146, country: 'Malta' },
  { name: 'Marseille, France', lat: 43.2965, lng: 5.3698, country: 'France' },
  
  // Pacific
  { name: 'Honolulu, Hawaii', lat: 21.3099, lng: -157.8581, country: 'USA' },
  { name: 'Papeete, Tahiti', lat: -17.5350, lng: -149.5696, country: 'French Polynesia' },
  { name: 'Suva, Fiji', lat: -18.1416, lng: 178.4419, country: 'Fiji' },
  { name: 'Apia, Samoa', lat: -13.8333, lng: -171.7667, country: 'Samoa' },
  
  // Asia
  { name: 'Singapore', lat: 1.2644, lng: 103.8220, country: 'Singapore' },
  { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, country: 'China' },
  { name: 'Phuket, Thailand', lat: 7.8804, lng: 98.3923, country: 'Thailand' },
  
  // Atlantic Islands
  { name: 'Las Palmas, Canary Islands', lat: 28.1391, lng: -15.4318, country: 'Spain' },
  { name: 'Horta, Azores', lat: 38.5319, lng: -28.6267, country: 'Portugal' },
  { name: 'Funchal, Madeira', lat: 32.6495, lng: -16.9083, country: 'Portugal' },
  
  // Europe
  { name: 'Southampton, UK', lat: 50.9097, lng: -1.4044, country: 'UK' },
  { name: 'Plymouth, UK', lat: 50.3755, lng: -4.1427, country: 'UK' },
  
  // Australia
  { name: 'Sydney, Australia', lat: -33.8568, lng: 151.2153, country: 'Australia' },
  { name: 'Auckland, New Zealand', lat: -36.8485, lng: 174.7633, country: 'New Zealand' }
]

export default function PortSelector({
  value,
  onChange,
  onPortSelected,
  placeholder = 'Type port name...',
  className = '',
  id,
  'data-testid': dataTestId
}: PortSelectorProps) {
  const [searchTerm, setSearchTerm] = useState(value)
  const [showDropdown, setShowDropdown] = useState(false)
  const [filteredPorts, setFilteredPorts] = useState<Port[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Filter ports as user types
  useEffect(() => {
    if (searchTerm.length > 0) {
      const filtered = GLOBAL_PORTS.filter(port =>
        port.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (port.country && port.country.toLowerCase().includes(searchTerm.toLowerCase()))
      ).slice(0, 8) // Show top 8 matches
      
      setFilteredPorts(filtered)
      setShowDropdown(filtered.length > 0)
    } else {
      setFilteredPorts([])
      setShowDropdown(false)
    }
  }, [searchTerm])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectPort = (port: Port) => {
    setSearchTerm(port.name)
    onChange(port.name)
    onPortSelected(port)
    setShowDropdown(false)
  }

  return (
    <div ref={wrapperRef} className="relative" data-testid={dataTestId || (id ? `port-selector-${id}` : 'port-selector')}>
      <Input
        type="text"
        data-testid={id ? `port-selector-${id}-input` : 'port-selector-input'}
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value)
          onChange(e.target.value)
        }}
        onFocus={() => searchTerm.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className={className}
        id={id}
      />

      {showDropdown && filteredPorts.length > 0 && (
        <div data-testid="port-selector-dropdown" className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredPorts.map((port, index) => (
            <div
              key={index}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
              onClick={() => handleSelectPort(port)}
            >
              <div>
                <div className="font-medium text-sm">{port.name}</div>
                {port.country && (
                  <div className="text-xs text-gray-500">{port.country}</div>
                )}
              </div>
              <MapPin className="h-4 w-4 text-gray-400" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

