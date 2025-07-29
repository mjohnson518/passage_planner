import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { 
  MapPin, 
  Users, 
  Calendar, 
  MoreVertical,
  Wrench,
  Navigation
} from 'lucide-react'
import type { FleetVessel } from '@passage-planner/shared'
import { toRelativeTime } from '../../lib/utils'

interface FleetVesselCardProps {
  vessel: FleetVessel
}

export function FleetVesselCard({ vessel }: FleetVesselCardProps) {
  const getStatusColor = (status: FleetVessel['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{vessel.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getStatusColor(vessel.status)}>
                {vessel.status}
              </Badge>
              {vessel.callSign && (
                <span className="text-xs text-muted-foreground">
                  {vessel.callSign}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Current Location */}
        {vessel.currentLocation && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>
              {vessel.currentLocation.lat.toFixed(4)}°, {vessel.currentLocation.lng.toFixed(4)}°
            </span>
            <span className="text-xs text-muted-foreground">
              {toRelativeTime(vessel.currentLocation.lastUpdated)}
            </span>
          </div>
        )}

        {/* Assigned Crew */}
        {vessel.assignedCrew && vessel.assignedCrew.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{vessel.assignedCrew.length} crew assigned</span>
          </div>
        )}

        {/* Last Passage */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>Last used 3 days ago</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" className="flex-1">
            <Navigation className="h-4 w-4 mr-1" />
            Track
          </Button>
          {vessel.status === 'maintenance' && (
            <Button size="sm" variant="outline" className="flex-1">
              <Wrench className="h-4 w-4 mr-1" />
              Maintenance
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 