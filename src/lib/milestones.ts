import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { db, ensureTables } from '@/db';
import {
  legacySales,
  milestoneRules,
  lifecycleNotifications,
  whatsappSendLog,
  whatsappBatchJobs,
} from '@/db/schema';
import { addDaysYmd, getIstYmd, isoNow } from '@/lib/dates';
import { buildMilestoneMessages, newId, parseMilestonesSent } from '@/lib/templates';
import { notifyCrmSaleMilestone } from '@/lib/crmClient';

export async function seedDefaultMilestonesIfEmpty(): Promise<void> {
  await ensureTables();
  const existing = await db.select().from(milestoneRules).limit(1);
  if (existing.length > 0) return;

  const defaults = [
    {
      id: newId(),
      daysAfterSale: 365,
      label: '1-year service',
      templateKey: 'service_1yr',
      titleTemplate: '{{milestoneLabel}} due — {{customerName}}',
      messageTemplate:
        'Sale on {{saleDate}} · {{reference}} · Please call for annual servicing',
      enabled: true,
      sortOrder: 1,
    },
    {
      id: newId(),
      daysAfterSale: 730,
      label: '2-year upgrade',
      templateKey: 'upgrade_2yr',
      titleTemplate: '{{milestoneLabel}} — {{customerName}}',
      messageTemplate:
        'Sale on {{saleDate}} · {{reference}} · Offer upgrade / trade-in',
      enabled: true,
      sortOrder: 2,
    },
  ];
  for (const d of defaults) {
    await db.insert(milestoneRules).values(d);
  }
}

export async function runDailyMilestones(): Promise<{
  created: number;
  crmNotified: number;
  errors: string[];
}> {
  await ensureTables();
  await seedDefaultMilestonesIfEmpty();

  const today = getIstYmd();
  const rules = await db.select().from(milestoneRules).where(eq(milestoneRules.enabled, true));
  const sales = await db.select().from(legacySales).where(eq(legacySales.status, 'active'));

  let created = 0;
  let crmNotified = 0;
  const errors: string[] = [];

  for (const sale of sales) {
    const sent = parseMilestonesSent(sale.milestonesSentJson);
    for (const rule of rules) {
      const dueDate = addDaysYmd(sale.saleDate, rule.daysAfterSale);
      if (dueDate !== today) continue;
      const key = String(rule.daysAfterSale);
      if (sent[key]) continue;

      const { title, message } = buildMilestoneMessages(sale, rule);
      const notifId = newId();
      const now = isoNow();

      await db.insert(lifecycleNotifications).values({
        id: notifId,
        saleId: sale.id,
        milestoneDays: rule.daysAfterSale,
        dueDate: today,
        title,
        message,
        status: 'pending',
        createdAt: now,
      });
      created += 1;

      const crm = await notifyCrmSaleMilestone({
        externalSaleId: sale.id,
        customerName: sale.customerName,
        phone: sale.phone,
        reference: sale.reference || undefined,
        saleDate: sale.saleDate,
        milestoneDays: rule.daysAfterSale,
        milestoneLabel: rule.label,
        title,
        message,
        centerId: sale.centerId,
      });

      if (crm.ok) {
        crmNotified += 1;
        sent[key] = today;
        await db
          .update(legacySales)
          .set({
            milestonesSentJson: JSON.stringify(sent),
            updatedAt: now,
          })
          .where(eq(legacySales.id, sale.id));
        await db
          .update(lifecycleNotifications)
          .set({ status: 'crm_notified', crmNotifiedAt: now })
          .where(eq(lifecycleNotifications.id, notifId));
      } else {
        errors.push(`${sale.id}/${rule.daysAfterSale}: ${crm.error}`);
        await db
          .update(lifecycleNotifications)
          .set({ status: 'pending', whatsappError: crm.error })
          .where(eq(lifecycleNotifications.id, notifId));
      }
    }
  }

  return { created, crmNotified, errors };
}

export async function getTodayStats() {
  await ensureTables();
  const today = getIstYmd();
  const rules = await db.select().from(milestoneRules).where(eq(milestoneRules.enabled, true));
  const sales = await db.select().from(legacySales).where(eq(legacySales.status, 'active'));

  const dueByMilestone: Record<string, number> = {};
  let dueToday = 0;

  for (const sale of sales) {
    const sent = parseMilestonesSent(sale.milestonesSentJson);
    for (const rule of rules) {
      const dueDate = addDaysYmd(sale.saleDate, rule.daysAfterSale);
      if (dueDate !== today) continue;
      if (sent[String(rule.daysAfterSale)]) continue;
      dueToday += 1;
      dueByMilestone[rule.label] = (dueByMilestone[rule.label] || 0) + 1;
    }
  }

  const upcomingEnd = addDaysYmd(today, 7);
  let upcoming7 = 0;
  for (const sale of sales) {
    for (const rule of rules) {
      const dueDate = addDaysYmd(sale.saleDate, rule.daysAfterSale);
      if (dueDate > today && dueDate <= upcomingEnd) upcoming7 += 1;
    }
  }

  const waToday = await db
    .select({ count: sql<number>`count(*)` })
    .from(whatsappSendLog)
    .where(and(eq(whatsappSendLog.status, 'sent'), gte(whatsappSendLog.sentAt, `${today}T00:00:00`)));

  const waFailed = await db
    .select({ count: sql<number>`count(*)` })
    .from(lifecycleNotifications)
    .where(eq(lifecycleNotifications.status, 'whatsapp_failed'));

  const totalSales = await db.select({ count: sql<number>`count(*)` }).from(legacySales);
  const milestoneCount = await db.select({ count: sql<number>`count(*)` }).from(milestoneRules);

  const recentWa = await db
    .select()
    .from(whatsappSendLog)
    .orderBy(desc(whatsappSendLog.sentAt))
    .limit(10);

  return {
    today,
    dueToday,
    dueByMilestone,
    upcoming7,
    whatsappSentToday: Number(waToday[0]?.count || 0),
    whatsappFailures: Number(waFailed[0]?.count || 0),
    totalSales: Number(totalSales[0]?.count || 0),
    milestoneRulesCount: Number(milestoneCount[0]?.count || 0),
    recentWhatsApp: recentWa,
  };
}

export async function getDueTodayRecipients(milestoneDays?: number) {
  await ensureTables();
  const today = getIstYmd();
  const rules = await db.select().from(milestoneRules).where(eq(milestoneRules.enabled, true));
  const sales = await db.select().from(legacySales).where(eq(legacySales.status, 'active'));
  const recipients: Array<{
    sale: (typeof sales)[0];
    rule: (typeof rules)[0];
    title: string;
    message: string;
  }> = [];

  for (const sale of sales) {
    const sent = parseMilestonesSent(sale.milestonesSentJson);
    for (const rule of rules) {
      if (milestoneDays != null && rule.daysAfterSale !== milestoneDays) continue;
      const dueDate = addDaysYmd(sale.saleDate, rule.daysAfterSale);
      if (dueDate !== today) continue;
      const waKey = `wa_${rule.daysAfterSale}`;
      if (sent[waKey]) continue;
      recipients.push({
        sale,
        rule,
        ...buildMilestoneMessages(sale, rule),
      });
    }
  }
  return recipients;
}

export { lifecycleNotifications, legacySales, milestoneRules, whatsappSendLog, whatsappBatchJobs };
