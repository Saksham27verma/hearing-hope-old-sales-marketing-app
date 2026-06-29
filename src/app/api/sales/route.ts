import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db, ensureTables } from '@/db';
import { legacySales } from '@/db/schema';
import { isoNow } from '@/lib/dates';
import { newId } from '@/lib/templates';
import { normalizePhone, isValidPhone } from '@/lib/phone';
import { parseSaleDate } from '@/lib/dates';
import { COHORT_LABELS, filterSalesByCohort, isCohortKey } from '@/lib/cohortFilter';

export async function GET(req: Request) {
  await ensureTables();
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  const status = url.searchParams.get('status');
  const cohortParam = url.searchParams.get('cohort');
  const cohort = isCohortKey(cohortParam) ? cohortParam : null;

  const rows = await db.select().from(legacySales).orderBy(desc(legacySales.saleDate));
  let filtered = filterSalesByCohort(rows, cohort);
  if (status) filtered = filtered.filter((r) => r.status === status);
  if (q) {
    filtered = filtered.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        (r.reference || '').toLowerCase().includes(q),
    );
  }
  return NextResponse.json({
    ok: true,
    rows: filtered,
    cohort,
    cohortLabel: cohort ? COHORT_LABELS[cohort] : null,
  });
}

export async function POST(req: Request) {
  await ensureTables();
  const body = (await req.json()) as Record<string, unknown>;
  const customerName = String(body.customerName || '').trim();
  const phone = normalizePhone(String(body.phone || ''));
  const saleDate = parseSaleDate(String(body.saleDate || ''));
  if (!customerName || !isValidPhone(phone) || !saleDate) {
    return NextResponse.json({ ok: false, error: 'Invalid name, phone, or sale date' }, { status: 400 });
  }
  const now = isoNow();
  const id = newId();
  await db.insert(legacySales).values({
    id,
    customerName,
    phone,
    reference: String(body.reference || '').trim() || null,
    address: String(body.address || '').trim() || null,
    saleDate,
    centerId: String(body.centerId || '').trim() || null,
    notes: String(body.notes || '').trim() || null,
    source: 'manual',
    status: 'active',
    milestonesSentJson: '{}',
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ ok: true, id });
}
