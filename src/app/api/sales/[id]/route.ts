import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, ensureTables } from '@/db';
import { legacySales } from '@/db/schema';
import { isoNow } from '@/lib/dates';
import { normalizePhone, isValidPhone } from '@/lib/phone';
import { parseSaleDate } from '@/lib/dates';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureTables();
  const { id } = await ctx.params;
  const row = await db.select().from(legacySales).where(eq(legacySales.id, id)).limit(1);
  if (!row[0]) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, row: row[0] });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureTables();
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  const existing = await db.select().from(legacySales).where(eq(legacySales.id, id)).limit(1);
  if (!existing[0]) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  const patch: Partial<typeof legacySales.$inferInsert> = { updatedAt: isoNow() };
  if (body.customerName != null) patch.customerName = String(body.customerName).trim();
  if (body.phone != null) {
    const p = normalizePhone(String(body.phone));
    if (!isValidPhone(p)) return NextResponse.json({ ok: false, error: 'Invalid phone' }, { status: 400 });
    patch.phone = p;
  }
  if (body.reference != null) patch.reference = String(body.reference).trim() || null;
  if (body.address != null) patch.address = String(body.address).trim() || null;
  if (body.saleDate != null) {
    const d = parseSaleDate(String(body.saleDate));
    if (!d) return NextResponse.json({ ok: false, error: 'Invalid date' }, { status: 400 });
    patch.saleDate = d;
  }
  if (body.centerId != null) patch.centerId = String(body.centerId).trim() || null;
  if (body.notes != null) patch.notes = String(body.notes).trim() || null;
  if (body.status != null) patch.status = String(body.status);

  await db.update(legacySales).set(patch).where(eq(legacySales.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureTables();
  const { id } = await ctx.params;
  await db.delete(legacySales).where(eq(legacySales.id, id));
  return NextResponse.json({ ok: true });
}
