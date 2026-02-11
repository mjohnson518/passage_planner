import { Skeleton } from '../components/ui/skeleton'
import { Card, CardContent, CardHeader } from '../components/ui/card'

export default function AdminLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="mb-8">
        <Skeleton className="h-9 w-56 mb-2" />
        <Skeleton className="h-5 w-80" />
      </div>
      <Skeleton className="h-10 w-full max-w-4xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent><Skeleton className="h-24 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
