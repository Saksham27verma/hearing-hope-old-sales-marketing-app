import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseSessionCookie, verifyToken, COOKIE_NAME } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/stats/today', '/api/cron/daily-milestones'];

export function isAuthed(req: NextRequest): boolean {
  if (parseSessionCookie(req.headers.get('cookie'))) return true;
  const token = req.nextUrl.searchParams.get('token');
  if (token && verifyToken(token).valid) return true;
  return false;
}

export function requireApiAuth(req: NextRequest): NextResponse | null {
  const path = req.nextUrl.pathname;
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p))) {
    if (path === '/api/stats/today') return null;
    if (path === '/api/cron/daily-milestones') return null;
  }

  if (path.startsWith('/api/stats/today')) {
    const auth = req.headers.get('authorization') || '';
    const secret = process.env.CRM_WEBHOOK_SECRET?.trim();
    if (secret && auth === `Bearer ${secret}`) return null;
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (path.startsWith('/api/cron/')) {
    const secret = process.env.CRON_SECRET?.trim();
    if (secret) {
      const auth = req.headers.get('authorization') || '';
      if (auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    return null;
  }

  if (path.startsWith('/api/') && !path.startsWith('/api/auth/')) {
    if (!isAuthed(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return null;
}

export { COOKIE_NAME };
