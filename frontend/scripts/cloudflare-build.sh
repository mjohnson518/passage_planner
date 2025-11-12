#!/bin/bash
# Cloudflare Pages Build Script
# Ensures npm is used and prevents yarn registry errors

set -e

echo "🔧 Helmwise Cloudflare Build Starting..."

# Force npm usage
export npm_config_registry="https://registry.npmjs.org/"
export ADBLOCK=true
export DISABLE_OPENCOLLECTIVE=true

# Ensure we're using npm, not yarn
if command -v yarn &> /dev/null; then
  echo "⚠️ Yarn detected, but forcing npm usage"
fi

# Set build environment
export NODE_ENV=production

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf .next
rm -rf .vercel

# Run Next.js build with @cloudflare/next-on-pages
echo "📦 Building with @cloudflare/next-on-pages..."
npx @cloudflare/next-on-pages

echo "✅ Build complete!"

