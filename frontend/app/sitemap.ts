import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://helmwise.co'
  const now = new Date().toISOString()

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/onboarding`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/api-docs`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ]
}


