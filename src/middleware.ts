import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';

const PUBLIC = [
  '/login',
  '/api/auth/login',
  '/api/auth/token',
  '/api/stats/today',
  '/api/cron/daily-milestones',
  '/api/ingest',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    PUBLIC.some((p) => pathname === p || pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const token = req.nextUrl.searchParams.get('token');
  if (token) {
    const url = new URL('/api/auth/token', req.url);
    url.searchParams.set('token', token);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const session = req.cookies.get(COOKIE_NAME)?.value;
  if (!session) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
