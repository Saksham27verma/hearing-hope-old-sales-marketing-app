import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, ensureTables } from '@/db';
import { legacySales } from '@/db/schema';
import { isoNow, parseSaleDate } from '@/lib/dates';
import { newId } from '@/lib/templates';
import { normalizePhone, isValidPhone } from '@/lib/phone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifySecret(req: Request): boolean {
  const expected = (process.env.CRM_WEBHOOK_SECRET || '').trim();
  if (!expected) return false;
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  const token = bearer ? bearer[1] : req.headers.get('x-lifecycle-secret') || '';
  return token === expected;
}

type IngestBody = {
  crmSaleId?: string;
  customerName?: string;
  phone?: string;
  saleDate?: string;
  address?: string;
  reference?: string;
  centerId?: string;
  notes?: string;
  cancelled?: boolean;
};

export async function POST(req: Request) {
  if (!verifySecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  await ensureTables();

  const body = (await req.json().catch(() => ({}))) as IngestBody;
  const crmSaleId = String(body.crmSaleId || '').trim();
  const customerName = String(body.customerName || '').trim();
  const phone = normalizePhone(String(body.phone || ''));
  const saleDate = parseSaleDate(String(body.saleDate || ''));
  const cancelled = body.cancelled === true;

  if (!crmSaleId) {
    return NextResponse.json({ ok: false, error: 'crmSaleId required' }, { status: 400 });
  }
  if (!customerName || !isValidPhone(phone) || !saleDate) {
    return NextResponse.json(
      { ok: false, error: 'Invalid name, phone, or sale date' },
      { status: 400 },
    );
  }

  const reference = String(body.reference || '').trim() || null;
  const address = String(body.address || '').trim() || null;
  const centerId = String(body.centerId || '').trim() || null;
  const notes = String(body.notes || '').trim() || null;
  const now = isoNow();

  const existing = await db
    .select()
    .from(legacySales)
    .where(eq(legacySales.crmSaleId, crmSaleId))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    const nextStatus = cancelled
      ? 'do_not_contact'
      : row.status === 'do_not_contact'
        ? 'active'
        : row.status;
    await db
      .update(legacySales)
      .set({
        customerName,
        phone,
        saleDate,
        reference,
        address,
        centerId,
        notes,
        source: row.source === 'manual' ? 'crm_sync' : row.source,
        status: nextStatus,
        updatedAt: now,
      })
      .where(eq(legacySales.id, row.id));
    return NextResponse.json({ ok: true, id: row.id, action: 'updated' });
  }

  const id = newId();
  await db.insert(legacySales).values({
    id,
    customerName,
    phone,
    reference,
    address,
    saleDate,
    centerId,
    notes,
    source: 'crm_sync',
    status: cancelled ? 'do_not_contact' : 'active',
    milestonesSentJson: '{}',
    crmSaleId,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ ok: true, id, action: 'created' });
}

export async function DELETE(req: Request) {
  if (!verifySecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  await ensureTables();
  const url = new URL(req.url);
  const crmSaleId = (url.searchParams.get('crmSaleId') || '').trim();
  if (!crmSaleId) {
    return NextResponse.json({ ok: false, error: 'crmSaleId required' }, { status: 400 });
  }
  const now = isoNow();
  const updated = await db
    .update(legacySales)
    .set({ status: 'do_not_contact', updatedAt: now })
    .where(eq(legacySales.crmSaleId, crmSaleId))
    .returning({ id: legacySales.id });
  return NextResponse.json({ ok: true, affected: updated.length });
}
