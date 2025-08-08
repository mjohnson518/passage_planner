export default function robots() {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://helmwise.co'
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}


