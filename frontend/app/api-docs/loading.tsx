import { Skeleton } from '../components/ui/skeleton'
import { Card, CardContent, CardHeader } from '../components/ui/card'

export default function ApiDocsLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
      <div>
        <Skeleton className="h-9 w-56 mb-2" />
        <Skeleton className="h-5 w-80" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent><Skeleton className="h-12 w-full" /></CardContent>
      </Card>
      <Card>
        <CardHeader><Skeleton className="h-6 w-36" /></CardHeader>
        <CardContent><Skeleton className="h-24 w-full rounded-lg" /></CardContent>
      </Card>
      <Card>
        <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
