import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../../contexts/AuthContext'
import { SocketProvider } from '../../contexts/SocketContext'
import { Toaster } from '../../components/ui/toaster'

// Create a custom render function that includes all providers
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

interface AllTheProvidersProps {
  children: React.ReactNode
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children }) => {
  const queryClient = createTestQueryClient()
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          {children}
          <Toaster />
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Mock factories for common test data
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  subscription_tier: 'free',
  subscription_status: 'active',
  api_key: 'test-api-key',
  ...overrides,
})

export const createMockPassage = (overrides = {}) => ({
  id: 'test-passage-id',
  user_id: 'test-user-id',
  name: 'Test Passage',
  start_port: 'San Francisco',
  end_port: 'Los Angeles',
  departure_time: new Date().toISOString(),
  arrival_time: new Date(Date.now() + 86400000).toISOString(),
  distance_nm: 350,
  status: 'draft',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

export const createMockSubscription = (overrides = {}) => ({
  tier: 'premium',
  status: 'active',
  current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
  cancel_at_period_end: false,
  ...overrides,
}) 