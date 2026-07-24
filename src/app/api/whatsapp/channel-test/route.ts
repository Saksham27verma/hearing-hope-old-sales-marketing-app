import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, ensureTables } from '@/db';
import { legacySales, whatsappSendLog } from '@/db/schema';
import { isoNow } from '@/lib/dates';
import { isPinnacleConfigured, sendInvoiceTemplateProbe } from '@/lib/pinnacleSend';
import { newId } from '@/lib/templates';

/**
 * Sends the known-working CRM invoice template to this sale's phone.
 * Use to verify the WhatsApp channel independently of lifecycle templates.
 */
export async function POST(req: Request) {
  try {
    await ensureTables();
    if (!isPinnacleConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'Pinnacle is not configured on the lifecycle app' },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => null)) as { saleId?: string } | null;
    if (!body?.saleId) {
      return NextResponse.json({ ok: false, error: 'saleId required' }, { status: 400 });
    }

    const sale = await db.select().from(legacySales).where(eq(legacySales.id, body.saleId)).limit(1);
    if (!sale[0]) return NextResponse.json({ ok: false, error: 'Sale not found' }, { status: 404 });

    const result = await sendInvoiceTemplateProbe({
      phone: sale[0].phone,
      customerName: sale[0].customerName,
    });

    await db.insert(whatsappSendLog).values({
      id: newId(),
      saleId: sale[0].id,
      phone: sale[0].phone,
      templateKey: 'invoice_channel_test',
      templateName: 'invoice_from_crm_testing_template',
      pinnacleResponseJson: JSON.stringify(result),
      status: result.ok ? 'sent' : 'failed',
      sentAt: isoNow(),
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      to: result.to,
      templateName: 'invoice_from_crm_testing_template',
      hint: 'Check WhatsApp on this number for a PDF invoice test message from Hearing Hope.',
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Channel test failed' },
      { status: 500 },
    );
  }
}
