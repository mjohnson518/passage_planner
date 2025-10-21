'use client'

import { useState } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { 
  User, 
  Mail, 
  Phone, 
  MoreVertical,
  Search,
  Shield,
  UserCheck,
  UserX
} from 'lucide-react'
import type { CrewMember } from '@/types/shared'

interface CrewListProps {
  crew: CrewMember[]
  fleetId: string
}

export function CrewList({ crew, fleetId }: CrewListProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredCrew = crew.filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRoleBadgeColor = (role: CrewMember['role']) => {
    switch (role) {
      case 'captain':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      case 'skipper':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'crew':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'guest':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: CrewMember['status']) => {
    switch (status) {
      case 'active':
        return <UserCheck className="h-4 w-4 text-green-600" />
      case 'invited':
        return <Mail className="h-4 w-4 text-yellow-600" />
      case 'inactive':
        return <UserX className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search crew members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Crew List */}
      <div className="space-y-2">
        {filteredCrew.map((member) => (
          <Card key={member.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{member.name}</h3>
                    <Badge className={getRoleBadgeColor(member.role)}>
                      {member.role}
                    </Badge>
                    {getStatusIcon(member.status)}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <span>{member.email}</span>
                    </div>
                    
                    {member.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Permissions Summary */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {member.permissions.canManageVessels && (
                      <Badge variant="outline" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Vessel Manager
                      </Badge>
                    )}
                    {member.permissions.canInviteCrew && (
                      <Badge variant="outline" className="text-xs">
                        <UserCheck className="h-3 w-3 mr-1" />
                        Can Invite
                      </Badge>
                    )}
                    {member.vessels.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {member.vessels.length} vessel{member.vessels.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredCrew.length === 0 && (
        <div className="text-center py-8">
          <UserX className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {searchTerm ? 'No crew members found' : 'No crew members yet'}
          </p>
        </div>
      )}
    </div>
  )
} 