import { NextResponse, type NextRequest } from 'next/server'

// Runs in front of every matched request (Next.js 16 proxy, formerly middleware).
// Attaches a request id for tracing and rejects oversized JSON bodies early.
export default function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID()

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 100_000) {
    return NextResponse.json(
      { error: 'Request body too large.' },
      { status: 413, headers: { 'x-request-id': requestId } }
    )
  }

  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
