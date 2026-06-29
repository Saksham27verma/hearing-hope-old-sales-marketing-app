import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'lifecycle_session';

export function getSigningSecret(): string {
  return (
    process.env.TOKEN_SIGNING_SECRET?.trim() ||
    process.env.LIFECYCLE_ADMIN_PASSWORD?.trim() ||
    'dev-secret-change-me'
  );
}

export function signToken(payload: Record<string, unknown>, expiresInSec = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = createHmac('sha256', getSigningSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token: string): { valid: boolean; payload?: Record<string, unknown> } {
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };
  const [body, sig] = parts;
  const expected = createHmac('sha256', getSigningSecret()).update(body).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false };
  } catch {
    return { valid: false };
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
    const exp = Number(payload.exp);
    if (!exp || exp < Math.floor(Date.now() / 1000)) return { valid: false };
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.LIFECYCLE_ADMIN_PASSWORD?.trim();
  if (!expected) return password === 'changeme';
  return password === expected;
}

export function sessionCookieValue(): string {
  return signToken({ role: 'admin' }, 60 * 60 * 24 * 7);
}

export function parseSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  return verifyToken(decodeURIComponent(match[1])).valid;
}

export { COOKIE_NAME };
