import { eq, ne } from 'drizzle-orm';
import { db, ensureTables } from '@/db';
import { legacySales, type LegacySale } from '@/db/schema';
import {
  formatMonthYear,
  formatSaleDateDisplay,
  getIstYmdParts,
  saleDateYearsBefore,
  saleInCalendarMonth,
} from '@/lib/dates';
import { formatPhoneDisplay } from '@/lib/phone';

export type SaleSummary = {
  id: string;
  customerName: string;
  phone: string;
  phoneDisplay: string;
  reference: string | null;
  saleDate: string;
  saleDateDisplay: string;
  address: string | null;
  status: string;
};

export type CohortBucket = {
  label: string;
  description: string;
  targetDate?: string;
  targetMonth?: string;
  count: number;
  rows: SaleSummary[];
};

export type AnniversaryDashboard = {
  today: string;
  currentMonthLabel: string;
  /** Exact anniversary today (bought on this date 1/2/3 years ago). */
  anniversaryToday: {
    oneYear: CohortBucket;
    twoYear: CohortBucket;
    threeYear: CohortBucket;
  };
  /** All sales in the current calendar month, N years ago. */
  sameMonthCohort: {
    oneYearBack: CohortBucket;
    twoYearBack: CohortBucket;
    threeYearBack: CohortBucket;
  };
};

const LIST_LIMIT = 100;

function toSummary(sale: LegacySale): SaleSummary {
  return {
    id: sale.id,
    customerName: sale.customerName,
    phone: sale.phone,
    phoneDisplay: formatPhoneDisplay(sale.phone),
    reference: sale.reference,
    saleDate: sale.saleDate,
    saleDateDisplay: formatSaleDateDisplay(sale.saleDate),
    address: sale.address,
    status: sale.status,
  };
}

function bucket(
  label: string,
  description: string,
  rows: SaleSummary[],
  extra?: { targetDate?: string; targetMonth?: string },
): CohortBucket {
  return {
    label,
    description,
    count: rows.length,
    rows: rows.slice(0, LIST_LIMIT),
    ...extra,
  };
}

export async function getAnniversaryDashboard(): Promise<AnniversaryDashboard> {
  await ensureTables();
  const { year, month, day, ymd: today } = getIstYmdParts();
  const currentMonthLabel = formatMonthYear(year, month);

  const sales = await db
    .select()
    .from(legacySales)
    .where(ne(legacySales.status, 'do_not_contact'));

  const oneYearAgoDate = saleDateYearsBefore(today, 1);
  const twoYearAgoDate = saleDateYearsBefore(today, 2);
  const threeYearAgoDate = saleDateYearsBefore(today, 3);

  const anniversary1: SaleSummary[] = [];
  const anniversary2: SaleSummary[] = [];
  const anniversary3: SaleSummary[] = [];
  const month1: SaleSummary[] = [];
  const month2: SaleSummary[] = [];
  const month3: SaleSummary[] = [];

  for (const sale of sales) {
    const s = toSummary(sale);
    if (sale.saleDate === oneYearAgoDate) anniversary1.push(s);
    if (sale.saleDate === twoYearAgoDate) anniversary2.push(s);
    if (sale.saleDate === threeYearAgoDate) anniversary3.push(s);

    if (saleInCalendarMonth(sale.saleDate, year - 1, month)) month1.push(s);
    if (saleInCalendarMonth(sale.saleDate, year - 2, month)) month2.push(s);
    if (saleInCalendarMonth(sale.saleDate, year - 3, month)) month3.push(s);
  }

  const sortByDate = (a: SaleSummary, b: SaleSummary) => a.saleDate.localeCompare(b.saleDate);
  anniversary1.sort(sortByDate);
  anniversary2.sort(sortByDate);
  anniversary3.sort(sortByDate);
  month1.sort(sortByDate);
  month2.sort(sortByDate);
  month3.sort(sortByDate);

  return {
    today,
    currentMonthLabel,
    anniversaryToday: {
      oneYear: bucket(
        '1 year ago today',
        `Purchased on ${formatSaleDateDisplay(oneYearAgoDate)} — service / follow-up due`,
        anniversary1,
        { targetDate: oneYearAgoDate },
      ),
      twoYear: bucket(
        '2 years ago today',
        `Purchased on ${formatSaleDateDisplay(twoYearAgoDate)} — upgrade / offer due`,
        anniversary2,
        { targetDate: twoYearAgoDate },
      ),
      threeYear: bucket(
        '3 years ago today',
        `Purchased on ${formatSaleDateDisplay(threeYearAgoDate)} — retention check-in`,
        anniversary3,
        { targetDate: threeYearAgoDate },
      ),
    },
    sameMonthCohort: {
      oneYearBack: bucket(
        `${formatMonthYear(year - 1, month)}`,
        `All customers who bought in ${formatMonthYear(year - 1, month)} (1 year back)`,
        month1,
        { targetMonth: `${year - 1}-${String(month).padStart(2, '0')}` },
      ),
      twoYearBack: bucket(
        `${formatMonthYear(year - 2, month)}`,
        `All customers who bought in ${formatMonthYear(year - 2, month)} (2 years back)`,
        month2,
        { targetMonth: `${year - 2}-${String(month).padStart(2, '0')}` },
      ),
      threeYearBack: bucket(
        `${formatMonthYear(year - 3, month)}`,
        `All customers who bought in ${formatMonthYear(year - 3, month)} (3 years back)`,
        month3,
        { targetMonth: `${year - 3}-${String(month).padStart(2, '0')}` },
      ),
    },
  };
}
