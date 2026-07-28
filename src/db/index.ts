import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const url = process.env.TURSO_DATABASE_URL || 'file:./local.db';
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

const client = createClient({
  url,
  authToken: authToken || undefined,
});

export const db = drizzle(client, { schema });

export async function ensureTables(): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS legacy_sales (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      reference TEXT,
      address TEXT,
      sale_date TEXT NOT NULL,
      center_id TEXT,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'active',
      milestones_sent_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  // Additive migration: crm_sale_id column + unique index for idempotent CRM sync.
  try {
    const cols = await client.execute(`PRAGMA table_info(legacy_sales)`);
    const hasCrmSaleId = (cols.rows || []).some(
      (r: Record<string, unknown>) => String(r.name) === 'crm_sale_id',
    );
    if (!hasCrmSaleId) {
      await client.execute(`ALTER TABLE legacy_sales ADD COLUMN crm_sale_id TEXT`);
    }
    await client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_legacy_sales_crm_sale_id ON legacy_sales(crm_sale_id) WHERE crm_sale_id IS NOT NULL`,
    );
  } catch (err) {
    console.error('[ensureTables] crm_sale_id migration failed', err);
  }
  await client.execute(`
    CREATE TABLE IF NOT EXISTS milestone_rules (
      id TEXT PRIMARY KEY,
      days_after_sale INTEGER NOT NULL,
      label TEXT NOT NULL,
      template_key TEXT NOT NULL,
      title_template TEXT NOT NULL,
      message_template TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS lifecycle_notifications (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      milestone_days INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      crm_notified_at TEXT,
      whatsapp_sent_at TEXT,
      whatsapp_error TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS whatsapp_send_log (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      template_key TEXT NOT NULL,
      template_name TEXT,
      pinnacle_response_json TEXT,
      status TEXT NOT NULL,
      batch_job_id TEXT,
      sent_at TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS whatsapp_batch_jobs (
      id TEXT PRIMARY KEY,
      template_key TEXT NOT NULL,
      filter_date TEXT NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      sent INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      started_at TEXT,
      finished_at TEXT,
      error TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS whatsapp_template_settings (
      template_key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      pinnacle_template_name TEXT NOT NULL,
      header_image_url TEXT,
      updated_at TEXT NOT NULL
    )
  `);
}
