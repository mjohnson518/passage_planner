/**
 * Environment Variable Validation Module
 * 
 * Validates all required environment variables at startup to ensure
 * the application fails fast with clear error messages rather than
 * failing later with cryptic errors.
 * 
 * CRITICAL: This is life-safety infrastructure. Missing configuration
 * could lead to incorrect weather data, failed route calculations, or
 * other safety issues. We validate everything upfront.
 */

interface EnvRule {
  required: boolean
  minLength?: number
  maxLength?: number
  format?: 'url' | 'email' | 'key'
  protocol?: string
  startsWith?: string
  description: string
  example?: string
  whereToGet?: string
}

interface EnvRules {
  [key: string]: EnvRule
}

/**
 * Environment variable validation rules
 * 
 * Security: CRITICAL variables are required for production
 * Safety: Weather/Navigation APIs are required for accurate data
 * Revenue: Stripe keys are required for billing
 */
const ENV_RULES: EnvRules = {
  // ==========================================================================
  // AUTHENTICATION & SECURITY (CRITICAL)
  // ==========================================================================
  JWT_SECRET: {
    required: true,
    minLength: 32,
    description: 'JWT signing secret for API authentication',
    example: 'use openssl rand -base64 32',
    whereToGet: 'Generate with: openssl rand -base64 32'
  },
  
  NEXT_PUBLIC_SUPABASE_URL: {
    required: true,
    format: 'url',
    protocol: 'https:',
    description: 'Supabase project URL',
    whereToGet: 'https://app.supabase.com/project/YOUR_PROJECT/settings/api'
  },
  
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    required: true,
    minLength: 20,
    description: 'Supabase anonymous key (public)',
    whereToGet: 'https://app.supabase.com/project/YOUR_PROJECT/settings/api'
  },
  
  SUPABASE_SERVICE_ROLE_KEY: {
    required: true,
    minLength: 20,
    description: 'Supabase service role key (server-side only)',
    whereToGet: 'https://app.supabase.com/project/YOUR_PROJECT/settings/api'
  },
  
  // ==========================================================================
  // STRIPE BILLING (CRITICAL FOR REVENUE)
  // ==========================================================================
  STRIPE_SECRET_KEY: {
    required: true,
    startsWith: 'sk_',
    minLength: 20,
    description: 'Stripe secret key (use sk_test_ for testing)',
    whereToGet: 'https://dashboard.stripe.com/apikeys'
  },
  
  STRIPE_WEBHOOK_SECRET: {
    required: true,
    startsWith: 'whsec_',
    description: 'Stripe webhook signing secret',
    whereToGet: 'https://dashboard.stripe.com/webhooks'
  },
  
  STRIPE_PREMIUM_MONTHLY_PRICE_ID: {
    required: true,
    startsWith: 'price_',
    description: 'Premium tier monthly price ID',
    whereToGet: 'https://dashboard.stripe.com/products'
  },
  
  STRIPE_PREMIUM_YEARLY_PRICE_ID: {
    required: false,
    startsWith: 'price_',
    description: 'Premium tier yearly price ID',
    whereToGet: 'https://dashboard.stripe.com/products'
  },
  
  STRIPE_PRO_MONTHLY_PRICE_ID: {
    required: true,
    startsWith: 'price_',
    description: 'Pro tier monthly price ID',
    whereToGet: 'https://dashboard.stripe.com/products'
  },
  
  STRIPE_PRO_YEARLY_PRICE_ID: {
    required: false,
    startsWith: 'price_',
    description: 'Pro tier yearly price ID',
    whereToGet: 'https://dashboard.stripe.com/products'
  },
  
  // ==========================================================================
  // DATABASE & CACHE (CRITICAL)
  // ==========================================================================
  DATABASE_URL: {
    required: true,
    format: 'url',
    protocol: 'postgresql:',
    description: 'PostgreSQL database connection string',
    example: 'postgresql://user:password@localhost:5432/helmwise'
  },
  
  REDIS_URL: {
    required: true,
    format: 'url',
    protocol: 'redis:',
    description: 'Redis cache connection string',
    example: 'redis://localhost:6379'
  },
  
  // ==========================================================================
  // APPLICATION URLs (CRITICAL)
  // ==========================================================================
  NEXT_PUBLIC_APP_URL: {
    required: true,
    format: 'url',
    description: 'Frontend application URL',
    example: 'https://helmwise.co'
  },
  
  NEXT_PUBLIC_API_URL: {
    required: true,
    format: 'url',
    description: 'Backend API URL',
    example: 'https://api.helmwise.co'
  },
  
  ORCHESTRATOR_URL: {
    required: true,
    format: 'url',
    description: 'Orchestrator service URL (server-side)',
    example: 'http://localhost:8080'
  },
  
  // ==========================================================================
  // WEATHER APIs (HIGH PRIORITY - Safety Critical)
  // ==========================================================================
  OPENWEATHER_API_KEY: {
    required: false, // Made optional but recommended
    minLength: 20,
    description: 'OpenWeather API key for weather data',
    whereToGet: 'https://openweathermap.org/api'
  },
  
  NOAA_API_KEY: {
    required: false, // NOAA API is free and doesn't require a key for basic usage
    description: 'NOAA API key (optional - free tier works without)',
    whereToGet: 'https://www.weather.gov/documentation/services-web-api'
  },
  
  // ==========================================================================
  // EMAIL SERVICE (RECOMMENDED)
  // ==========================================================================
  RESEND_API_KEY: {
    required: false,
    startsWith: 're_',
    description: 'Resend API key for transactional emails',
    whereToGet: 'https://resend.com/api-keys'
  },
  
  EMAIL_FROM: {
    required: false,
    format: 'email',
    description: 'From email address for transactional emails',
    example: 'noreply@helmwise.co'
  },
  
  // ==========================================================================
  // ERROR TRACKING (RECOMMENDED)
  // ==========================================================================
  SENTRY_DSN: {
    required: false,
    format: 'url',
    description: 'Sentry DSN for error tracking',
    whereToGet: 'https://sentry.io/settings/projects/YOUR_PROJECT/keys/'
  }
}

/**
 * Validation result with errors and warnings
 */
interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  config: Record<string, string | undefined>
}

/**
 * Validate a URL format
 */
function isValidUrl(value: string, requiredProtocol?: string): boolean {
  try {
    const url = new URL(value)
    if (requiredProtocol && url.protocol !== requiredProtocol) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Validate an email format
 */
function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

/**
 * Validate a single environment variable against its rule
 */
function validateVariable(
  name: string,
  value: string | undefined,
  rule: EnvRule
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check if required variable is missing
  if (rule.required && !value) {
    errors.push(
      `❌ ${name} is REQUIRED but not set\n` +
      `   Description: ${rule.description}\n` +
      (rule.whereToGet ? `   Get it from: ${rule.whereToGet}\n` : '') +
      (rule.example ? `   Example: ${rule.example}` : '')
    )
    return { valid: false, errors, warnings }
  }
  
  // Check if optional variable is missing
  if (!rule.required && !value) {
    warnings.push(
      `⚠️  ${name} is not set (optional)\n` +
      `   Description: ${rule.description}\n` +
      (rule.whereToGet ? `   Get it from: ${rule.whereToGet}` : '')
    )
    return { valid: true, errors, warnings }
  }
  
  // Variable exists, validate format/content
  if (value) {
    // Minimum length check
    if (rule.minLength && value.length < rule.minLength) {
      errors.push(
        `❌ ${name} is too short (minimum ${rule.minLength} characters, got ${value.length})`
      )
    }
    
    // Maximum length check
    if (rule.maxLength && value.length > rule.maxLength) {
      errors.push(
        `❌ ${name} is too long (maximum ${rule.maxLength} characters, got ${value.length})`
      )
    }
    
    // Prefix check
    if (rule.startsWith && !value.startsWith(rule.startsWith)) {
      errors.push(
        `❌ ${name} must start with "${rule.startsWith}" (got: ${value.substring(0, 10)}...)`
      )
    }
    
    // Format validation
    if (rule.format === 'url') {
      if (!isValidUrl(value, rule.protocol)) {
        errors.push(
          `❌ ${name} is not a valid URL` +
          (rule.protocol ? ` with protocol ${rule.protocol}` : '') +
          `\n   Got: ${value}`
        )
      }
    }
    
    if (rule.format === 'email') {
      if (!isValidEmail(value)) {
        errors.push(
          `❌ ${name} is not a valid email address\n   Got: ${value}`
        )
      }
    }
  }
  
  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate all environment variables
 * 
 * @param customRules - Optional additional rules to validate
 * @returns ValidationResult with errors, warnings, and config
 */
export function validateEnvironment(customRules?: EnvRules): ValidationResult {
  const rules = { ...ENV_RULES, ...customRules }
  const allErrors: string[] = []
  const allWarnings: string[] = []
  const config: Record<string, string | undefined> = {}
  
  // Validate each variable
  for (const [name, rule] of Object.entries(rules)) {
    const value = process.env[name]
    config[name] = value
    
    const result = validateVariable(name, value, rule)
    allErrors.push(...result.errors)
    allWarnings.push(...result.warnings)
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    config
  }
}

/**
 * Validate environment and throw if invalid
 * Use this at application startup to fail fast
 */
export function validateEnv(customRules?: EnvRules): Record<string, string | undefined> {
  console.log('🔍 Validating environment variables...\n')
  
  const result = validateEnvironment(customRules)
  
  // Show warnings first
  if (result.warnings.length > 0) {
    console.warn('⚠️  WARNINGS:\n')
    result.warnings.forEach(warning => console.warn(warning + '\n'))
  }
  
  // Then show errors
  if (!result.valid) {
    console.error('❌ ENVIRONMENT VALIDATION FAILED\n')
    console.error('The following required variables are missing or invalid:\n')
    result.errors.forEach(error => console.error(error + '\n'))
    console.error('\n💡 Fix these errors and restart the service.\n')
    
    throw new Error(
      `Environment validation failed: ${result.errors.length} error(s) found. ` +
      `Check logs above for details.`
    )
  }
  
  console.log('✅ Environment validation passed\n')
  
  if (result.warnings.length > 0) {
    console.log(`   ${result.warnings.length} optional variable(s) not set (see warnings above)\n`)
  }
  
  return result.config
}

/**
 * Get a validated environment variable with type safety
 * Throws if variable doesn't exist and is required
 */
export function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name]
  
  if (!value && !defaultValue) {
    throw new Error(
      `Environment variable ${name} is not set and no default provided. ` +
      `This should have been caught by validateEnv().`
    )
  }
  
  return value || defaultValue!
}

/**
 * Get optional environment variable
 * Returns undefined if not set
 */
export function getOptionalEnv(name: string): string | undefined {
  return process.env[name]
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test'
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
}

/**
 * Get safe environment info for logging (redacts secrets)
 */
export function getSafeEnvInfo(): Record<string, string> {
  const safe: Record<string, string> = {}
  
  // Safe to log
  const safeKeys = [
    'NODE_ENV',
    'LOG_LEVEL',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_API_URL',
    'ORCHESTRATOR_URL',
    'PORT'
  ]
  
  safeKeys.forEach(key => {
    if (process.env[key]) {
      safe[key] = process.env[key]!
    }
  })
  
  // Show which secrets are configured (but not their values)
  const secretKeys = [
    'JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'REDIS_URL'
  ]
  
  secretKeys.forEach(key => {
    safe[key] = process.env[key] ? '✓ configured' : '✗ not set'
  })
  
  return safe
}

