import { Skeleton } from '../components/ui/skeleton'
import { Card, CardContent, CardHeader } from '../components/ui/card'

export default function DashboardLoading() {
  return (
    <div className="relative min-h-screen">
      <div className="relative container mx-auto px-4 py-8 lg:py-12 max-w-7xl space-y-10">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div>
            <Skeleton className="h-8 w-64 mb-1" />
            <Skeleton className="h-5 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 text-center">
                <Skeleton className="w-14 h-14 rounded-xl mx-auto mb-4" />
                <Skeleton className="h-5 w-24 mx-auto mb-1" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-9 w-20" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
