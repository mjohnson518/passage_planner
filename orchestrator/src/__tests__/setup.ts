// Test environment setup
process.env.NODE_ENV = 'test'
process.env.PORT = '8081'
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-service-key'
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.REDIS_URL = 'redis://localhost:6379'

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}

// Add custom matchers
expect.extend({
  toBeValidWebhookSignature(received: string) {
    const pass = received.startsWith('t=') && received.includes(',v1=')
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid webhook signature`
        : `expected ${received} to be a valid webhook signature (format: t=timestamp,v1=signature)`,
    }
  }
}) 