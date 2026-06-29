/** Parse sale date from CSV — many Zoho / Excel formats */
export function parseSaleDate(raw: string): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;

  // 2023-06-15 or 2023-06-15 00:00:00
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // 2023/06/15
  const ymdSlash = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdSlash) {
    const [, y, m, d] = ymdSlash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 15-Jun-2023 or 15 Jun 2023
  const dMonY = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-](\d{4})$/);
  if (dMonY) {
    const [, d, mon, y] = dMonY;
    const t = new Date(`${d} ${mon} ${y}`);
    if (!Number.isNaN(t.getTime())) return t.toISOString().slice(0, 10);
  }

  // Excel serial number (days since 1899-12-30)
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 30000 && Number(s) < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(Number(s)));
    return epoch.toISOString().slice(0, 10);
  }

  const t = new Date(s);
  if (!Number.isNaN(t.getTime())) {
    return t.toISOString().slice(0, 10);
  }
  return null;
}

export function formatSaleDateDisplay(ymd: string): string {
  const t = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(t.getTime())) return ymd;
  return t.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function addDaysYmd(ymd: string, days: number): string {
  const t = new Date(`${ymd}T12:00:00`);
  t.setDate(t.getDate() + days);
  return t.toISOString().slice(0, 10);
}

export function getIstYmd(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function getIstYmdParts(now = new Date()): { year: number; month: number; day: number; ymd: string } {
  const ymd = getIstYmd(now);
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day, ymd };
}

/** Sale date exactly N calendar years before referenceYmd (handles leap years). */
export function saleDateYearsBefore(referenceYmd: string, years: number): string {
  const [y, m, d] = referenceYmd.split('-').map(Number);
  const targetYear = y - years;
  const lastDay = new Date(targetYear, m, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatMonthYear(year: number, month: number): string {
  const t = new Date(year, month - 1, 1);
  return t.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function saleInCalendarMonth(saleDateYmd: string, year: number, month: number): boolean {
  const [y, m] = saleDateYmd.split('-').map(Number);
  return y === year && m === month;
}

export function yearsSinceSale(saleDateYmd: string): number {
  const sale = new Date(`${saleDateYmd}T12:00:00`);
  const now = new Date();
  let years = now.getFullYear() - sale.getFullYear();
  const m = now.getMonth() - sale.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < sale.getDate())) years -= 1;
  return Math.max(0, years);
}
