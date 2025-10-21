export const dynamic = 'force-dynamic'

import { WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '../components/ui/button'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <WifiOff className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-2">You're Offline</h1>
        <p className="text-muted-foreground mb-6">
          It looks like you've lost your internet connection. 
          Some features may not be available until you're back online.
        </p>
        
        <div className="space-y-4">
          <Button
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Available offline:</p>
            <ul className="space-y-1">
              <li>• View cached passages</li>
              <li>• Access boat profiles</li>
              <li>• Review saved weather data</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 