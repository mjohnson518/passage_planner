export const runtime = 'edge'

import PassageDetailClient from './PassageDetailClient'
import RequireAuth from '../../components/auth/RequireAuth'

export default function PassageDetailPage() {
  return (
    <RequireAuth>
      <PassageDetailClient />
    </RequireAuth>
  )
}
