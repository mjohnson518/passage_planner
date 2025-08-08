'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Code, Copy, CheckCircle, AlertCircle, Key, Terminal, Book } from 'lucide-react'
import { toast } from 'sonner'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  auth: boolean
  params?: { name: string; type: string; required: boolean; description: string }[]
  body?: { name: string; type: string; required: boolean; description: string }[]
  response: {
    success: any
    error?: any
  }
  example: {
    request: string
    response: string
  }
}

const endpoints: Record<string, APIEndpoint[]> = {
  passages: [
    {
      method: 'POST',
      path: '/api/passages/plan',
      description: 'Plan a new passage using natural language',
      auth: true,
      body: [
        { name: 'query', type: 'string', required: true, description: 'Natural language description of your passage' },
        { name: 'preferences', type: 'object', required: false, description: 'Override user preferences for this passage' }
      ],
      response: {
        success: {
          id: 'string',
          route: 'Route',
          weather: 'WeatherData',
          tides: 'TidalData',
          safety: 'SafetyInfo',
          eta: 'string'
        }
      },
      example: {
        request: `{
  "query": "Plan a passage from Boston to Portland next Tuesday morning"
}`,
        response: `{
  "id": "passage_123",
  "route": {
    "waypoints": [...],
    "distance": 98.5,
    "duration": "12h 30m"
  },
  "weather": {...},
  "tides": {...},
  "safety": {...},
  "eta": "2024-01-16T18:30:00Z"
}`
      }
    },
    {
      method: 'GET',
      path: '/api/passages',
      description: 'Get all passages for the authenticated user',
      auth: true,
      params: [
        { name: 'limit', type: 'number', required: false, description: 'Number of passages to return (default: 20)' },
        { name: 'offset', type: 'number', required: false, description: 'Offset for pagination' },
        { name: 'status', type: 'string', required: false, description: 'Filter by status: planned, completed, cancelled' }
      ],
      response: {
        success: {
          passages: 'Passage[]',
          total: 'number',
          limit: 'number',
          offset: 'number'
        }
      },
      example: {
        request: 'GET /api/passages?limit=10&status=planned',
        response: `{
  "passages": [...],
  "total": 45,
  "limit": 10,
  "offset": 0
}`
      }
    },
    {
      method: 'GET',
      path: '/api/passages/:id/export',
      description: 'Export passage plan in various formats',
      auth: true,
      params: [
        { name: 'format', type: 'string', required: true, description: 'Export format: gpx, kml, csv, pdf' }
      ],
      response: {
        success: 'Binary file data',
        error: {
          error: 'string',
          code: 'FEATURE_LOCKED'
        }
      },
      example: {
        request: 'GET /api/passages/passage_123/export?format=gpx',
        response: 'Binary GPX file'
      }
    }
  ],
  weather: [
    {
      method: 'GET',
      path: '/api/weather/forecast',
      description: 'Get weather forecast for specific coordinates',
      auth: true,
      params: [
        { name: 'lat', type: 'number', required: true, description: 'Latitude' },
        { name: 'lon', type: 'number', required: true, description: 'Longitude' },
        { name: 'days', type: 'number', required: false, description: 'Number of days (1-7, default: 3)' }
      ],
      response: {
        success: {
          location: 'Location',
          forecasts: 'WeatherForecast[]'
        }
      },
      example: {
        request: 'GET /api/weather/forecast?lat=42.3601&lon=-71.0589&days=3',
        response: `{
  "location": {
    "lat": 42.3601,
    "lon": -71.0589,
    "name": "Boston Harbor"
  },
  "forecasts": [...]
}`
      }
    }
  ],
  fleet: [
    {
      method: 'POST',
      path: '/api/fleet/create',
      description: 'Create a new fleet (Pro tier only)',
      auth: true,
      body: [
        { name: 'name', type: 'string', required: true, description: 'Fleet name' },
        { name: 'description', type: 'string', required: false, description: 'Fleet description' }
      ],
      response: {
        success: {
          id: 'string',
          name: 'string',
          created_at: 'string'
        },
        error: {
          error: 'string',
          code: 'SUBSCRIPTION_REQUIRED'
        }
      },
      example: {
        request: `{
  "name": "Boston Yacht Club",
  "description": "Official fleet for BYC members"
}`,
        response: `{
  "id": "fleet_456",
  "name": "Boston Yacht Club",
  "created_at": "2024-01-15T10:00:00Z"
}`
      }
    }
  ]
}

export default function APIDocsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [apiKey, setApiKey] = useState<string>('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [copiedEndpoint, setCopiedEndpoint] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState('passages')
  const [testEndpoint, setTestEndpoint] = useState<APIEndpoint | null>(null)
  const [testResult, setTestResult] = useState<any>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    // Check if user has Pro tier by fetching user's subscription data
    checkProAccess()
  }, [user, router])

  const checkProAccess = async () => {
    try {
      const response = await fetch('/api/user/subscription', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const hasProAccess = data.tier === 'pro' || data.tier === 'enterprise'
        
        if (!hasProAccess) {
          router.push('/pricing?feature=api')
          return
        }
      } else {
        // If we can't verify subscription, redirect to pricing
        router.push('/pricing?feature=api')
      }
    } catch (error) {
      console.error('Failed to check subscription:', error)
      router.push('/pricing?feature=api')
    }
  }

  const fetchApiKey = async () => {
    try {
      const response = await fetch('/api/user/api-key', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setApiKey(data.apiKey || '')
      }
    } catch (error) {
      console.error('Failed to fetch API key:', error)
    }
  }

  const generateApiKey = async () => {
    try {
      const response = await fetch('/api/user/api-key/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setApiKey(data.apiKey)
        setShowApiKey(true)
        toast.success('New API key generated')
      }
    } catch (error) {
      toast.error('Failed to generate API key')
    }
  }

  const copyToClipboard = (text: string, endpoint?: string) => {
    navigator.clipboard.writeText(text)
    if (endpoint) {
      setCopiedEndpoint(endpoint)
      setTimeout(() => setCopiedEndpoint(''), 2000)
    }
    toast.success('Copied to clipboard')
  }

  const testAPIEndpoint = async (endpoint: APIEndpoint) => {
    setTesting(true)
    setTestResult(null)
    
    try {
      const url = process.env.NEXT_PUBLIC_API_URL + endpoint.path
      const options: RequestInit = {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }

      if (endpoint.method === 'POST' && endpoint.example.request) {
        options.body = endpoint.example.request
      }

      const response = await fetch(url, options)
      const data = await response.json()
      
      setTestResult({
        status: response.status,
        statusText: response.statusText,
        data
      })
    } catch (error: any) {
      setTestResult({
        status: 'error',
        statusText: 'Request failed',
        data: { error: error.message }
      })
    } finally {
      setTesting(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
        <p className="text-muted-foreground">
          Build powerful integrations with the Passage Planner API
        </p>
      </div>

      {/* API Key Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Your API Key
          </CardTitle>
          <CardDescription>
            Use this key to authenticate your API requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKey ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(apiKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Keep your API key secure</AlertTitle>
                <AlertDescription>
                  Never share your API key or commit it to version control. Regenerate it immediately if compromised.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="mb-4 text-muted-foreground">No API key generated yet</p>
              <Button onClick={generateApiKey}>
                Generate API Key
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Authentication Example */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>
            All API requests must include your API key in the Authorization header
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <SyntaxHighlighter
              language="bash"
              style={vscDarkPlus}
              customStyle={{ borderRadius: '0.5rem' }}
            >
              {`curl -X GET "${process.env.NEXT_PUBLIC_API_URL}/api/passages" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
            </SyntaxHighlighter>
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2"
              onClick={() => copyToClipboard(`curl -X GET "${process.env.NEXT_PUBLIC_API_URL}/api/passages" \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json"`)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>API Endpoints</CardTitle>
          <CardDescription>
            Explore available endpoints and test them directly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="passages">Passages</TabsTrigger>
              <TabsTrigger value="weather">Weather</TabsTrigger>
              <TabsTrigger value="fleet">Fleet</TabsTrigger>
            </TabsList>

            {Object.entries(endpoints).map(([category, categoryEndpoints]) => (
              <TabsContent key={category} value={category} className="space-y-6">
                {categoryEndpoints.map((endpoint, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              endpoint.method === 'GET' ? 'default' :
                              endpoint.method === 'POST' ? 'secondary' :
                              endpoint.method === 'PUT' ? 'outline' :
                              'destructive'
                            }>
                              {endpoint.method}
                            </Badge>
                            <code className="text-sm font-mono">{endpoint.path}</code>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {endpoint.description}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTestEndpoint(endpoint)}
                        >
                          <Terminal className="h-4 w-4 mr-1" />
                          Test
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Parameters */}
                      {endpoint.params && endpoint.params.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Query Parameters</h4>
                          <div className="space-y-2">
                            {endpoint.params.map((param, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <code className="font-mono bg-muted px-1 py-0.5 rounded">
                                  {param.name}
                                </code>
                                <span className="text-muted-foreground">
                                  {param.type}
                                  {param.required && <span className="text-red-500 ml-1">*</span>}
                                </span>
                                <span className="text-muted-foreground">—</span>
                                <span className="text-muted-foreground">{param.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Request Body */}
                      {endpoint.body && endpoint.body.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Request Body</h4>
                          <div className="space-y-2">
                            {endpoint.body.map((field, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <code className="font-mono bg-muted px-1 py-0.5 rounded">
                                  {field.name}
                                </code>
                                <span className="text-muted-foreground">
                                  {field.type}
                                  {field.required && <span className="text-red-500 ml-1">*</span>}
                                </span>
                                <span className="text-muted-foreground">—</span>
                                <span className="text-muted-foreground">{field.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Example */}
                      <div>
                        <h4 className="font-medium mb-2">Example</h4>
                        <div className="space-y-2">
                          {endpoint.method !== 'GET' && (
                            <div className="relative">
                              <p className="text-sm text-muted-foreground mb-1">Request:</p>
                              <SyntaxHighlighter
                                language="json"
                                style={vscDarkPlus}
                                customStyle={{ fontSize: '0.875rem' }}
                              >
                                {endpoint.example.request}
                              </SyntaxHighlighter>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="absolute top-6 right-2"
                                onClick={() => copyToClipboard(endpoint.example.request, endpoint.path)}
                              >
                                {copiedEndpoint === endpoint.path ? (
                                  <CheckCircle className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                          <div className="relative">
                            <p className="text-sm text-muted-foreground mb-1">Response:</p>
                            <SyntaxHighlighter
                              language="json"
                              style={vscDarkPlus}
                              customStyle={{ fontSize: '0.875rem' }}
                            >
                              {endpoint.example.response}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Test Dialog */}
      {testEndpoint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto">
            <CardHeader>
              <CardTitle>Test API Endpoint</CardTitle>
              <CardDescription>
                {testEndpoint.method} {testEndpoint.path}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!apiKey && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No API Key</AlertTitle>
                  <AlertDescription>
                    Generate an API key first to test endpoints
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <h4 className="font-medium mb-2">Request</h4>
                <SyntaxHighlighter
                  language="bash"
                  style={vscDarkPlus}
                >
                  {`curl -X ${testEndpoint.method} "${process.env.NEXT_PUBLIC_API_URL}${testEndpoint.path}" \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json"${testEndpoint.body ? ` \\
  -d '${testEndpoint.example.request}'` : ''}`}
                </SyntaxHighlighter>
              </div>

              {testResult && (
                <div>
                  <h4 className="font-medium mb-2">Response</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={testResult.status < 400 ? 'default' : 'destructive'}>
                        {testResult.status} {testResult.statusText}
                      </Badge>
                    </div>
                    <SyntaxHighlighter
                      language="json"
                      style={vscDarkPlus}
                    >
                      {JSON.stringify(testResult.data, null, 2)}
                    </SyntaxHighlighter>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTestEndpoint(null)
                    setTestResult(null)
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => testAPIEndpoint(testEndpoint)}
                  disabled={!apiKey || testing}
                >
                  {testing ? 'Testing...' : 'Send Request'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
} 