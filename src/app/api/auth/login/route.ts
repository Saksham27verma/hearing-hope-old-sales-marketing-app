import { NextResponse } from 'next/server';
import { COOKIE_NAME, sessionCookieValue, verifyPassword } from '@/lib/auth';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!verifyPassword(String(body.password || ''))) {
    return NextResponse.json({ ok: false, error: 'Invalid password' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, sessionCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
