import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, ensureTables } from '@/db';
import { milestoneRules } from '@/db/schema';
import { newId } from '@/lib/templates';
import { seedDefaultMilestonesIfEmpty } from '@/lib/milestones';

export async function GET() {
  await ensureTables();
  await seedDefaultMilestonesIfEmpty();
  const rows = await db.select().from(milestoneRules);
  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  await ensureTables();
  const body = (await req.json()) as Record<string, unknown>;
  const id = newId();
  await db.insert(milestoneRules).values({
    id,
    daysAfterSale: Number(body.daysAfterSale) || 365,
    label: String(body.label || 'Milestone'),
    templateKey: String(body.templateKey || 'service_1yr'),
    titleTemplate: String(body.titleTemplate || '{{milestoneLabel}} — {{customerName}}'),
    messageTemplate: String(body.messageTemplate || 'Sale on {{saleDate}}'),
    enabled: body.enabled !== false,
    sortOrder: Number(body.sortOrder) || 0,
  });
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  await ensureTables();
  const body = (await req.json()) as Record<string, unknown> & { id?: string };
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  const patch: Partial<typeof milestoneRules.$inferInsert> = {};
  if (body.daysAfterSale != null) patch.daysAfterSale = Number(body.daysAfterSale);
  if (body.label != null) patch.label = String(body.label);
  if (body.templateKey != null) patch.templateKey = String(body.templateKey);
  if (body.titleTemplate != null) patch.titleTemplate = String(body.titleTemplate);
  if (body.messageTemplate != null) patch.messageTemplate = String(body.messageTemplate);
  if (body.enabled != null) patch.enabled = Boolean(body.enabled);
  if (body.sortOrder != null) patch.sortOrder = Number(body.sortOrder);
  await db.update(milestoneRules).set(patch).where(eq(milestoneRules.id, id));
  return NextResponse.json({ ok: true });
}
