import { NextResponse } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
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

  const conditions = [];
  if (status) {
    conditions.push(eq(legacySales.status, status));
  }
  if (q) {
    // Strip LIKE wildcards from user input; wrap as contains match.
    const pattern = `%${q.replace(/[%_]/g, '')}%`;
    conditions.push(
      sql`(
        lower(${legacySales.customerName}) like ${pattern}
        or ${legacySales.phone} like ${pattern}
        or lower(coalesce(${legacySales.reference}, '')) like ${pattern}
      )`,
    );
  }

  const base = db.select().from(legacySales).orderBy(desc(legacySales.saleDate));
  const rows =
    conditions.length > 0
      ? await base.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : await base;

  const filtered = filterSalesByCohort(rows, cohort);

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
