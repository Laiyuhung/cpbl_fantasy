import { NextResponse } from 'next/server'

export async function middleware(request) {
  const { pathname, origin } = request.nextUrl

  if (!pathname.startsWith('/photo/')) {
    return NextResponse.next()
  }

  if (pathname === '/photo/defaultPlayer.png') {
    return NextResponse.next()
  }

  try {
    const res = await fetch(`${origin}/api/admin/photo-privacy`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'x-photo-privacy-check': '1',
      },
    })

    if (res.ok) {
      const data = await res.json()
      if (data?.forceDefaultPlayerPhoto) {
        const url = request.nextUrl.clone()
        url.pathname = '/photo/defaultPlayer.png'
        return NextResponse.rewrite(url)
      }
    }
  } catch {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/photo/:path*'],
}
