import type { LegacySale } from '@/db/schema';
import {
  getIstYmdParts,
  saleDateYearsBefore,
  saleInCalendarMonth,
} from '@/lib/dates';

export const COHORT_KEYS = [
  'anniversary_1y',
  'anniversary_2y',
  'anniversary_3y',
  'month_1y',
  'month_2y',
  'month_3y',
] as const;

export type CohortKey = (typeof COHORT_KEYS)[number];

export const COHORT_LABELS: Record<CohortKey, string> = {
  anniversary_1y: '1 year ago today',
  anniversary_2y: '2 years ago today',
  anniversary_3y: '3 years ago today',
  month_1y: 'Same month — 1 year back',
  month_2y: 'Same month — 2 years back',
  month_3y: 'Same month — 3 years back',
};

export function isCohortKey(value: string | null): value is CohortKey {
  return Boolean(value && (COHORT_KEYS as readonly string[]).includes(value));
}

export function saleMatchesCohort(sale: Pick<LegacySale, 'saleDate' | 'status'>, cohort: CohortKey): boolean {
  if (sale.status === 'do_not_contact') return false;
  const { year, month, ymd: today } = getIstYmdParts();

  switch (cohort) {
    case 'anniversary_1y':
      return sale.saleDate === saleDateYearsBefore(today, 1);
    case 'anniversary_2y':
      return sale.saleDate === saleDateYearsBefore(today, 2);
    case 'anniversary_3y':
      return sale.saleDate === saleDateYearsBefore(today, 3);
    case 'month_1y':
      return saleInCalendarMonth(sale.saleDate, year - 1, month);
    case 'month_2y':
      return saleInCalendarMonth(sale.saleDate, year - 2, month);
    case 'month_3y':
      return saleInCalendarMonth(sale.saleDate, year - 3, month);
    default:
      return true;
  }
}

export function filterSalesByCohort<T extends Pick<LegacySale, 'saleDate' | 'status'>>(
  sales: T[],
  cohort: CohortKey | null,
): T[] {
  if (!cohort) return sales;
  return sales.filter((s) => saleMatchesCohort(s, cohort));
}
