import { NextResponse } from 'next/server';
import { COOKIE_NAME, sessionCookieValue, verifyToken } from '@/lib/auth';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const next = url.searchParams.get('next') || '/dashboard';

  if (!verifyToken(token).valid) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  const res = NextResponse.redirect(new URL(next, url.origin));
  res.cookies.set(COOKIE_NAME, sessionCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  return res;
}
