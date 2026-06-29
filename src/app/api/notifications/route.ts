import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db, ensureTables } from '@/db';
import { lifecycleNotifications } from '@/db/schema';

export async function GET() {
  await ensureTables();
  const rows = await db
    .select()
    .from(lifecycleNotifications)
    .orderBy(desc(lifecycleNotifications.createdAt))
    .limit(100);
  return NextResponse.json({ ok: true, rows });
}

export async function PATCH(req: Request) {
  await ensureTables();
  const body = (await req.json()) as { id?: string; status?: string };
  if (!body.id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  const { eq } = await import('drizzle-orm');
  const { isoNow } = await import('@/lib/dates');
  await db
    .update(lifecycleNotifications)
    .set({
      status: String(body.status || 'done'),
      completedAt: isoNow(),
    })
    .where(eq(lifecycleNotifications.id, body.id));
  return NextResponse.json({ ok: true });
}
