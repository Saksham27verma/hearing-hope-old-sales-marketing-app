import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const legacySales = sqliteTable('legacy_sales', {
  id: text('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  phone: text('phone').notNull(),
  reference: text('reference'),
  address: text('address'),
  saleDate: text('sale_date').notNull(),
  centerId: text('center_id'),
  notes: text('notes'),
  source: text('source').notNull().default('manual'),
  status: text('status').notNull().default('active'),
  milestonesSentJson: text('milestones_sent_json').notNull().default('{}'),
  crmSaleId: text('crm_sale_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const milestoneRules = sqliteTable('milestone_rules', {
  id: text('id').primaryKey(),
  daysAfterSale: integer('days_after_sale').notNull(),
  label: text('label').notNull(),
  templateKey: text('template_key').notNull(),
  titleTemplate: text('title_template').notNull(),
  messageTemplate: text('message_template').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const lifecycleNotifications = sqliteTable('lifecycle_notifications', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull(),
  milestoneDays: integer('milestone_days').notNull(),
  dueDate: text('due_date').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('pending'),
  crmNotifiedAt: text('crm_notified_at'),
  whatsappSentAt: text('whatsapp_sent_at'),
  whatsappError: text('whatsapp_error'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
});

export const whatsappSendLog = sqliteTable('whatsapp_send_log', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull(),
  phone: text('phone').notNull(),
  templateKey: text('template_key').notNull(),
  templateName: text('template_name'),
  pinnacleResponseJson: text('pinnacle_response_json'),
  status: text('status').notNull(),
  batchJobId: text('batch_job_id'),
  sentAt: text('sent_at').notNull(),
});

export const whatsappBatchJobs = sqliteTable('whatsapp_batch_jobs', {
  id: text('id').primaryKey(),
  templateKey: text('template_key').notNull(),
  filterDate: text('filter_date').notNull(),
  total: integer('total').notNull().default(0),
  sent: integer('sent').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  status: text('status').notNull().default('queued'),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
  error: text('error'),
});

/** Per-template Pinnacle name + header image URL (editable from Settings UI). */
export const whatsappTemplateSettings = sqliteTable('whatsapp_template_settings', {
  templateKey: text('template_key').primaryKey(),
  label: text('label').notNull(),
  pinnacleTemplateName: text('pinnacle_template_name').notNull(),
  headerImageUrl: text('header_image_url'),
  updatedAt: text('updated_at').notNull(),
});

export type LegacySale = typeof legacySales.$inferSelect;
export type MilestoneRule = typeof milestoneRules.$inferSelect;
export type LifecycleNotification = typeof lifecycleNotifications.$inferSelect;
export type WhatsAppTemplateSetting = typeof whatsappTemplateSettings.$inferSelect;
