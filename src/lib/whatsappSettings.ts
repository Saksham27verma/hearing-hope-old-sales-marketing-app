import { eq } from 'drizzle-orm';
import { db, ensureTables } from '@/db';
import { whatsappTemplateSettings, type WhatsAppTemplateSetting } from '@/db/schema';
import { isoNow } from '@/lib/dates';
import { WHATSAPP_TEMPLATE_OPTIONS } from '@/lib/whatsappTemplates';

export type WhatsAppTemplateSettingInput = {
  templateKey: string;
  label: string;
  pinnacleTemplateName: string;
  headerImageUrl?: string | null;
};

const ENV_NAME_MAP: Record<string, string> = {
  service_6mo: 'PINNACLE_LIFECYCLE_TEMPLATE_SERVICE_6MO',
  service_1yr: 'PINNACLE_LIFECYCLE_TEMPLATE_SERVICE',
  upgrade_2yr: 'PINNACLE_LIFECYCLE_TEMPLATE_UPGRADE',
  general_followup: 'PINNACLE_LIFECYCLE_TEMPLATE_GENERAL',
};

const ENV_IMAGE_MAP: Record<string, string> = {
  service_6mo: 'PINNACLE_LIFECYCLE_IMAGE_SERVICE_6MO',
  service_1yr: 'PINNACLE_LIFECYCLE_IMAGE_SERVICE_1YR',
  upgrade_2yr: 'PINNACLE_LIFECYCLE_IMAGE_UPGRADE_2YR',
  general_followup: 'PINNACLE_LIFECYCLE_IMAGE_GENERAL_FOLLOWUP',
};

const FALLBACK_NAMES: Record<string, string> = {
  service_6mo: 'service_reminder_6mo_second',
  service_1yr: 'service_reminder_1yr_second',
  upgrade_2yr: 'upgrade_offer_2yr',
  general_followup: 'general_followup',
};

function defaultNameForKey(key: string): string {
  const envKey = ENV_NAME_MAP[key];
  const fromEnv = envKey ? (process.env[envKey] || '').trim() : '';
  return fromEnv || FALLBACK_NAMES[key] || key;
}

function defaultImageForKey(key: string): string {
  const envKey = ENV_IMAGE_MAP[key];
  const per = envKey ? (process.env[envKey] || '').trim() : '';
  if (per) return per;
  return (process.env.PINNACLE_LIFECYCLE_HEADER_IMAGE_URL || '').trim();
}

export function defaultWhatsAppTemplateSettings(): WhatsAppTemplateSettingInput[] {
  return WHATSAPP_TEMPLATE_OPTIONS.map((opt) => ({
    templateKey: opt.key,
    label: opt.label,
    pinnacleTemplateName: defaultNameForKey(opt.key),
    headerImageUrl: defaultImageForKey(opt.key) || null,
  }));
}

/** Ensure one row per known template key; seed from env on first run. */
export async function ensureWhatsAppTemplateSettings(): Promise<WhatsAppTemplateSetting[]> {
  await ensureTables();
  const existing = await db.select().from(whatsappTemplateSettings);
  const byKey = new Map(existing.map((r) => [r.templateKey, r]));
  const now = isoNow();
  const defaults = defaultWhatsAppTemplateSettings();

  for (const d of defaults) {
    if (byKey.has(d.templateKey)) continue;
    await db.insert(whatsappTemplateSettings).values({
      templateKey: d.templateKey,
      label: d.label,
      pinnacleTemplateName: d.pinnacleTemplateName,
      headerImageUrl: d.headerImageUrl || null,
      updatedAt: now,
    });
  }

  return db.select().from(whatsappTemplateSettings);
}

export async function getWhatsAppTemplateSetting(
  templateKey: string,
): Promise<WhatsAppTemplateSetting | null> {
  const rows = await ensureWhatsAppTemplateSettings();
  return rows.find((r) => r.templateKey === templateKey) || null;
}

export async function upsertWhatsAppTemplateSettings(
  rows: WhatsAppTemplateSettingInput[],
): Promise<WhatsAppTemplateSetting[]> {
  await ensureTables();
  const now = isoNow();
  for (const row of rows) {
    const templateKey = String(row.templateKey || '').trim();
    if (!templateKey) continue;
    const label = String(row.label || templateKey).trim() || templateKey;
    const pinnacleTemplateName =
      String(row.pinnacleTemplateName || '').trim() || defaultNameForKey(templateKey);
    const headerImageUrl = String(row.headerImageUrl || '').trim() || null;

    const existing = await db
      .select()
      .from(whatsappTemplateSettings)
      .where(eq(whatsappTemplateSettings.templateKey, templateKey))
      .limit(1);

    if (existing[0]) {
      await db
        .update(whatsappTemplateSettings)
        .set({
          label,
          pinnacleTemplateName,
          headerImageUrl,
          updatedAt: now,
        })
        .where(eq(whatsappTemplateSettings.templateKey, templateKey));
    } else {
      await db.insert(whatsappTemplateSettings).values({
        templateKey,
        label,
        pinnacleTemplateName,
        headerImageUrl,
        updatedAt: now,
      });
    }
  }
  return ensureWhatsAppTemplateSettings();
}
