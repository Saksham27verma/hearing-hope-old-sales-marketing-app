import { eq, inArray } from 'drizzle-orm';
import { db, ensureTables } from '@/db';
import { whatsappTemplateSettings, type WhatsAppTemplateSetting } from '@/db/schema';
import { isoNow } from '@/lib/dates';
import { WHATSAPP_TEMPLATE_OPTIONS } from '@/lib/whatsappTemplates';

export type WhatsAppTemplateSettingInput = {
  templateKey: string;
  /** When renaming an existing row, pass the old primary key. */
  previousKey?: string;
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

/** Internal key slug: lowercase letters, digits, underscore. */
export function slugifyTemplateKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

export function isValidTemplateKey(key: string): boolean {
  return /^[a-z0-9][a-z0-9_]{0,63}$/.test(key);
}

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
    const templateKey = slugifyTemplateKey(row.templateKey);
    if (!isValidTemplateKey(templateKey)) {
      throw new Error(`Invalid template key: ${row.templateKey}`);
    }
    const previousKey = row.previousKey ? slugifyTemplateKey(row.previousKey) : templateKey;
    const label = String(row.label || templateKey).trim() || templateKey;
    const pinnacleTemplateName =
      String(row.pinnacleTemplateName || '').trim() || defaultNameForKey(templateKey);
    const headerImageUrl = String(row.headerImageUrl || '').trim() || null;

    if (previousKey && previousKey !== templateKey) {
      // Rename: insert/update new key, then remove old key.
      const conflict = await db
        .select()
        .from(whatsappTemplateSettings)
        .where(eq(whatsappTemplateSettings.templateKey, templateKey))
        .limit(1);
      if (conflict[0] && previousKey !== templateKey) {
        throw new Error(`Template key already exists: ${templateKey}`);
      }
      const old = await db
        .select()
        .from(whatsappTemplateSettings)
        .where(eq(whatsappTemplateSettings.templateKey, previousKey))
        .limit(1);
      if (old[0]) {
        await db.insert(whatsappTemplateSettings).values({
          templateKey,
          label,
          pinnacleTemplateName,
          headerImageUrl,
          updatedAt: now,
        });
        await db
          .delete(whatsappTemplateSettings)
          .where(eq(whatsappTemplateSettings.templateKey, previousKey));
        continue;
      }
    }

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

export async function createWhatsAppTemplateSetting(
  input: WhatsAppTemplateSettingInput,
): Promise<WhatsAppTemplateSetting> {
  await ensureTables();
  const templateKey = slugifyTemplateKey(input.templateKey || input.label);
  if (!isValidTemplateKey(templateKey)) {
    throw new Error('Template key must start with a letter/number and use only a-z, 0-9, _');
  }
  const existing = await db
    .select()
    .from(whatsappTemplateSettings)
    .where(eq(whatsappTemplateSettings.templateKey, templateKey))
    .limit(1);
  if (existing[0]) {
    throw new Error(`Template key already exists: ${templateKey}`);
  }
  const now = isoNow();
  const label = String(input.label || templateKey).trim() || templateKey;
  const pinnacleTemplateName = String(input.pinnacleTemplateName || '').trim() || templateKey;
  const headerImageUrl =
    String(input.headerImageUrl || '').trim() || defaultImageForKey(templateKey) || null;

  await db.insert(whatsappTemplateSettings).values({
    templateKey,
    label,
    pinnacleTemplateName,
    headerImageUrl,
    updatedAt: now,
  });
  const rows = await db
    .select()
    .from(whatsappTemplateSettings)
    .where(eq(whatsappTemplateSettings.templateKey, templateKey))
    .limit(1);
  return rows[0]!;
}

export async function deleteWhatsAppTemplateSettings(keys: string[]): Promise<number> {
  await ensureTables();
  const cleaned = keys.map(slugifyTemplateKey).filter(isValidTemplateKey);
  if (cleaned.length === 0) return 0;
  await db
    .delete(whatsappTemplateSettings)
    .where(inArray(whatsappTemplateSettings.templateKey, cleaned));
  return cleaned.length;
}
