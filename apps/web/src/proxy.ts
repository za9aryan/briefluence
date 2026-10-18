import { NextResponse, type NextRequest } from 'next/server';

/**
 * Role-based routing (Next.js 16 "proxy", formerly middleware). Reads the non-secret `bf_role`
 * hint cookie set by the API; the API itself enforces every permission.
 */
const AREA_ROLE: Record<string, string> = {
  influencer: 'INFLUENCER',
  brand: 'BRAND',
  admin: 'ADMIN',
};
const HOME: Record<string, string> = {
  INFLUENCER: '/influencer/dashboard',
  BRAND: '/brand/dashboard',
  ADMIN: '/admin/overview',
};

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const role = req.cookies.get('bf_role')?.value;
  const area = pathname.split('/')[1] ?? '';

  if (area in AREA_ROLE || pathname.startsWith('/notifications')) {
    if (!role) {
      const url = new URL('/login', req.url);
      url.searchParams.set('next', pathname + search);
      return NextResponse.redirect(url);
    }
    const required = AREA_ROLE[area];
    if (required && role !== required)
      return NextResponse.redirect(new URL(HOME[role] ?? '/', req.url));
  }

  if ((pathname === '/login' || pathname === '/signup') && role && HOME[role]) {
    return NextResponse.redirect(new URL(HOME[role]!, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/influencer/:path*',
    '/brand/:path*',
    '/admin/:path*',
    '/notifications/:path*',
    '/login',
    '/signup',
  ],
};
