import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, ensureTables } from '@/db';
import { legacySales, lifecycleNotifications, whatsappSendLog, whatsappBatchJobs } from '@/db/schema';
import { isoNow } from '@/lib/dates';
import { sendCrmWhatsAppOne, sendCrmWhatsAppBatch } from '@/lib/crmClient';
import { newId, parseMilestonesSent } from '@/lib/templates';
import { getDueTodayRecipients } from '@/lib/milestones';

/**
 * Service reminders go through CRM → Pinnacle using the same DOCUMENT/utility
 * path as Sales & Invoicing (PDF on Firebase). That is what actually delivers.
 */
export async function POST(req: Request) {
  try {
    await ensureTables();
    const body = (await req.json().catch(() => null)) as {
      saleId?: string;
      templateKey?: string;
      bodyParams?: string[];
    } | null;

    if (!body?.saleId) {
      return NextResponse.json({ ok: false, error: 'saleId required' }, { status: 400 });
    }

    const sale = await db.select().from(legacySales).where(eq(legacySales.id, body.saleId)).limit(1);
    if (!sale[0]) return NextResponse.json({ ok: false, error: 'Sale not found' }, { status: 404 });
    if (sale[0].status === 'do_not_contact') {
      return NextResponse.json({ ok: false, error: 'Customer is do-not-contact' }, { status: 400 });
    }

    const templateKey = String(body.templateKey || 'service_1yr');
    const bodyParams = Array.isArray(body.bodyParams) ? body.bodyParams.map(String) : [];

    const crm = await sendCrmWhatsAppOne({
      externalSaleId: sale[0].id,
      phone: sale[0].phone,
      customerName: sale[0].customerName,
      templateKey,
      bodyParams,
    });

    const confirmed = Boolean(crm.ok && crm.messageId);
    const now = isoNow();
    await db.insert(whatsappSendLog).values({
      id: newId(),
      saleId: sale[0].id,
      phone: sale[0].phone,
      templateKey,
      templateName: crm.templateName || templateKey,
      pinnacleResponseJson: JSON.stringify({ ...crm, via: 'crm_document_utility' }),
      status: confirmed ? 'sent' : 'failed',
      sentAt: now,
    });

    if (confirmed) {
      await db
        .update(lifecycleNotifications)
        .set({ status: 'whatsapp_sent', whatsappSentAt: now })
        .where(eq(lifecycleNotifications.saleId, sale[0].id));
    }

    return NextResponse.json(
      confirmed
        ? {
            ok: true,
            messageId: crm.messageId,
            templateName: crm.templateName,
            to: crm.to,
            via: 'crm_document_utility',
          }
        : {
            ok: false,
            error:
              crm.error ||
              'WhatsApp send was not confirmed. Ensure CRM is running and PINNACLE_* is set.',
            raw: crm.raw,
          },
      { status: confirmed ? 200 : 502 },
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'WhatsApp send failed',
      },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    await ensureTables();
    const body = (await req.json().catch(() => null)) as {
      milestoneDays?: number;
      templateKey?: string;
      delayMs?: number;
    } | null;
    const milestoneDays = body?.milestoneDays;
    const templateKey = String(body?.templateKey || 'service_1yr');
    const recipients = await getDueTodayRecipients(milestoneDays);

    const eligible = recipients.filter((r) => r.sale.status === 'active');
    if (eligible.length === 0) {
      return NextResponse.json({ ok: true, jobId: null, total: 0, sent: 0, failed: 0, results: [] });
    }

    const jobId = newId();
    const now = isoNow();
    await db.insert(whatsappBatchJobs).values({
      id: jobId,
      templateKey,
      filterDate: now.slice(0, 10),
      total: eligible.length,
      sent: 0,
      failed: 0,
      status: 'running',
      startedAt: now,
    });

    const batchRecipients = eligible.map((r) => ({
      externalSaleId: r.sale.id,
      phone: r.sale.phone,
      customerName: r.sale.customerName,
      bodyParams: [] as string[],
    }));

    const batch = await sendCrmWhatsAppBatch({
      templateKey,
      recipients: batchRecipients,
      delayMs: body?.delayMs ?? 1500,
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
        status: batch.ok === false ? 'failed' : 'done',
        finishedAt: isoNow(),
        error: batch.error || null,
      })
      .where(eq(whatsappBatchJobs.id, jobId));

    return NextResponse.json({
      ok: batch.ok !== false,
      jobId,
      total: eligible.length,
      sent,
      failed,
      results: batch.results,
      error: batch.error,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'Bulk WhatsApp failed',
      },
      { status: 500 },
    );
  }
}
