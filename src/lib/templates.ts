import type { LegacySale, MilestoneRule } from '@/db/schema';
import { formatSaleDateDisplay, yearsSinceSale } from './dates';
import { formatPhoneDisplay } from './phone';

export function applyTemplate(
  template: string,
  vars: {
    customerName: string;
    phone: string;
    reference?: string;
    saleDate: string;
    years?: number;
    milestoneLabel?: string;
  },
): string {
  return template
    .replace(/\{\{customerName\}\}/g, vars.customerName || '')
    .replace(/\{\{phone\}\}/g, formatPhoneDisplay(vars.phone))
    .replace(/\{\{reference\}\}/g, vars.reference || '—')
    .replace(/\{\{saleDate\}\}/g, formatSaleDateDisplay(vars.saleDate))
    .replace(/\{\{years\}\}/g, String(vars.years ?? yearsSinceSale(vars.saleDate)))
    .replace(/\{\{milestoneLabel\}\}/g, vars.milestoneLabel || '');
}

export function buildMilestoneMessages(
  sale: Pick<LegacySale, 'customerName' | 'phone' | 'reference' | 'saleDate'>,
  rule: Pick<MilestoneRule, 'label' | 'titleTemplate' | 'messageTemplate' | 'daysAfterSale'>,
): { title: string; message: string } {
  const vars = {
    customerName: sale.customerName,
    phone: sale.phone,
    reference: sale.reference || undefined,
    saleDate: sale.saleDate,
    years: Math.round(rule.daysAfterSale / 365),
    milestoneLabel: rule.label,
  };
  return {
    title: applyTemplate(rule.titleTemplate, vars),
    message: applyTemplate(rule.messageTemplate, vars),
  };
}

export function parseMilestonesSent(json: string): Record<string, string> {
  try {
    const o = JSON.parse(json || '{}');
    return typeof o === 'object' && o ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function newId(): string {
  return crypto.randomUUID();
}
