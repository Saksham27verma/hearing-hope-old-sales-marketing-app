import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, ensureTables } from '@/db';
import { legacySales, lifecycleNotifications, whatsappSendLog, whatsappBatchJobs } from '@/db/schema';
import { isoNow } from '@/lib/dates';
import { sendCrmWhatsAppOne } from '@/lib/crmClient';
import { newId, parseMilestonesSent } from '@/lib/templates';
import { getDueTodayRecipients } from '@/lib/milestones';

export async function POST(req: Request) {
  await ensureTables();
  const body = (await req.json()) as {
    saleId?: string;
    templateKey?: string;
    bodyParams?: string[];
    milestoneDays?: number;
  };

  if (body.saleId) {
    const sale = await db.select().from(legacySales).where(eq(legacySales.id, body.saleId)).limit(1);
    if (!sale[0]) return NextResponse.json({ ok: false, error: 'Sale not found' }, { status: 404 });
    if (sale[0].status === 'do_not_contact') {
      return NextResponse.json({ ok: false, error: 'Customer is do-not-contact' }, { status: 400 });
    }
    const templateKey = String(body.templateKey || 'service_1yr');
    const bodyParams = body.bodyParams || [sale[0].customerName, 'Hearing Hope'];
    const result = await sendCrmWhatsAppOne({
      externalSaleId: sale[0].id,
      phone: sale[0].phone,
      customerName: sale[0].customerName,
      templateKey,
      bodyParams,
    });
    const now = isoNow();
    await db.insert(whatsappSendLog).values({
      id: newId(),
      saleId: sale[0].id,
      phone: sale[0].phone,
      templateKey,
      templateName: templateKey,
      pinnacleResponseJson: JSON.stringify(result),
      status: result.ok ? 'sent' : 'failed',
      sentAt: now,
    });
    if (result.ok) {
      await db
        .update(lifecycleNotifications)
        .set({ status: 'whatsapp_sent', whatsappSentAt: now })
        .where(eq(lifecycleNotifications.saleId, sale[0].id));
    }
    return NextResponse.json(result);
  }

  return NextResponse.json({ ok: false, error: 'saleId required' }, { status: 400 });
}

export async function PUT(req: Request) {
  await ensureTables();
  const body = (await req.json()) as { milestoneDays?: number; templateKey?: string; delayMs?: number };
  const milestoneDays = body.milestoneDays;
  const templateKey = String(body.templateKey || 'service_1yr');
  const recipients = await getDueTodayRecipients(milestoneDays);

  const eligible = recipients.filter((r) => r.sale.status === 'active');
  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, jobId: null, total: 0, results: [] });
  }

  const { sendCrmWhatsAppBatch } = await import('@/lib/crmClient');
  const batchRecipients = eligible.map((r) => ({
    externalSaleId: r.sale.id,
    phone: r.sale.phone,
    customerName: r.sale.customerName,
    bodyParams: [r.sale.customerName, 'Hearing Hope'],
  }));

  const jobId = newId();
  const now = isoNow();
  await db.insert(whatsappBatchJobs).values({
    id: jobId,
    templateKey,
    filterDate: now.slice(0, 10),
    total: batchRecipients.length,
    sent: 0,
    failed: 0,
    status: 'running',
    startedAt: now,
  });

  const batch = await sendCrmWhatsAppBatch({
    templateKey,
    recipients: batchRecipients,
    delayMs: body.delayMs ?? 1500,
  });

  let sent = 0;
  let failed = 0;
  for (const r of batch.results || []) {
    const rec = eligible.find((e) => e.sale.id === r.externalSaleId);
    if (!rec) continue;
    await db.insert(whatsappSendLog).values({
      id: newId(),
      saleId: r.externalSaleId,
      phone: rec.sale.phone,
      templateKey,
      status: r.ok ? 'sent' : 'failed',
      pinnacleResponseJson: JSON.stringify(r),
      batchJobId: jobId,
      sentAt: isoNow(),
    });
    if (r.ok) {
      sent += 1;
      const sentMap = parseMilestonesSent(rec.sale.milestonesSentJson);
      sentMap[`wa_${rec.rule.daysAfterSale}`] = now.slice(0, 10);
      await db
        .update(legacySales)
        .set({ milestonesSentJson: JSON.stringify(sentMap), updatedAt: isoNow() })
        .where(eq(legacySales.id, r.externalSaleId));
    } else {
      failed += 1;
    }
  }

  await db
    .update(whatsappBatchJobs)
    .set({
      sent,
      failed,
      status: batch.ok ? 'done' : 'failed',
      finishedAt: isoNow(),
      error: batch.error || null,
    })
    .where(eq(whatsappBatchJobs.id, jobId));

  return NextResponse.json({ ok: true, jobId, total: batchRecipients.length, sent, failed, results: batch.results });
}
