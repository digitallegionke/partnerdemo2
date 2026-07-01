// Configure CORS for API routes. Allowed origins may be provided via env var
// CORS_ALLOWED_ORIGINS (comma-separated) or NEXT_PUBLIC_CORS_ALLOWED_ORIGINS

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Default for local development
const DEFAULT_ORIGINS = ['http://localhost:8081']
const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_CORS_ALLOWED_ORIGINS || '').trim()
const ALLOWED_ORIGINS = envOrigins ? envOrigins.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_ORIGINS
// When using a wildcard ('*') with credentials=true, browsers will reject it. Set CORS_ALLOW_CREDENTIALS to 'false' to allow '*'.
const ALLOW_CREDENTIALS = (process.env.CORS_ALLOW_CREDENTIALS || 'true') === 'true'

export function middleware(req: NextRequest) {
  // Only apply middleware to API routes
  if (!req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next()

  const origin = req.headers.get('origin') || ''

  // Determine allowed origin to return in header
  const hasWildcard = ALLOWED_ORIGINS.includes('*')
  let allowed = ''

  if (hasWildcard) {
    // If wildcard present and credentials are allowed, fall back to the first configured origin
    allowed = ALLOW_CREDENTIALS ? (ALLOWED_ORIGINS.find(o => o !== '*') || ALLOWED_ORIGINS[0]) : '*'
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    allowed = origin
  } else {
    // Default to first entry (useful for CLI/Dev where origin header may be absent)
    allowed = ALLOWED_ORIGINS[0]
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    // 204 cannot have a response body; use an empty Response instead of NextResponse.json
    const res = new Response(null, { status: 204 })
    if (allowed) res.headers.set('Access-Control-Allow-Origin', allowed)
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PATCH,DELETE')
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.headers.set('Access-Control-Allow-Credentials', String(ALLOW_CREDENTIALS))
    return res
  }

  const res = NextResponse.next()
  if (allowed) res.headers.set('Access-Control-Allow-Origin', allowed)
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PATCH,DELETE')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.headers.set('Access-Control-Allow-Credentials', String(ALLOW_CREDENTIALS))
  return res
}

export const config = {
  matcher: ['/api/:path*'],
}
