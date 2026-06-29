import { parseSaleDate } from '@/lib/dates';
import { isValidPhone, normalizePhone } from '@/lib/phone';

export type MappedSaleRow = {
  customerName: string;
  phone: string;
  reference: string;
  saleDate: string;
  address: string;
  centerId: string;
  notes: string;
};

const FIELD_ALIASES: Record<keyof MappedSaleRow, string[]> = {
  customerName: [
    'customername',
    'name',
    'contactname',
    'customer',
    'dealname',
    'accountname',
    'patientname',
    'fullname',
    'contact',
    'leadname',
  ],
  phone: [
    'phone',
    'phonenumber',
    'phoneno',
    'mobile',
    'mobilenumber',
    'mobileno',
    'contactnumber',
    'phone1',
    'mobilephone',
    'primaryphone',
  ],
  reference: [
    'reference',
    'source',
    'referral',
    'doctor',
    'referencedoctor',
    'leadsource',
    'campaignsource',
    'referredby',
  ],
  saleDate: [
    'saledate',
    'date',
    'dateofsale',
    'closingdate',
    'invoicedate',
    'purchasedate',
    'dealclosingdate',
    'createdtime',
    'createddate',
    'sale date',
    'date of sale',
  ],
  address: ['address', 'mailingaddress', 'billingaddress', 'street', 'mailingstreet'],
  centerId: ['centerid', 'branch', 'center', 'location', 'branchname'],
  notes: ['notes', 'description', 'remarks', 'comment'],
};

function normalizeHeaderKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[^a-z0-9]/g, '');
}

function detectDelimiter(headerLine: string): string {
  const tabs = (headerLine.match(/\t/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function splitCsvLine(line: string, delimiter: string): string[] {
  if (delimiter === ',') {
    const cols = line.match(/("([^"]|"")*"|[^,]*)/g) || [];
    return cols.map((c) => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  }
  if (delimiter === '\t') {
    return line.split('\t').map((c) => c.trim().replace(/^"|"$/g, ''));
  }
  return line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
}

export function parseCsvText(text: string): { rows: Record<string, string>[]; headers: string[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], headers: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] || '').trim();
    });
    rows.push(obj);
  }

  return { rows, headers };
}

function buildHeaderMap(headers: string[]): Partial<Record<keyof MappedSaleRow, string>> {
  const normalized = headers.map((h) => ({ raw: h, key: normalizeHeaderKey(h) }));
  const map: Partial<Record<keyof MappedSaleRow, string>> = {};

  for (const field of Object.keys(FIELD_ALIASES) as (keyof MappedSaleRow)[]) {
    const aliases = FIELD_ALIASES[field];
    const hit = normalized.find((h) => aliases.includes(h.key) || h.key === field);
    if (hit) map[field] = hit.raw;
  }

  return map;
}

export function mapRawRow(
  row: Record<string, string>,
  headerMap: Partial<Record<keyof MappedSaleRow, string>>,
): MappedSaleRow {
  const pick = (field: keyof MappedSaleRow) => {
    const header = headerMap[field];
    if (header && row[header] != null) return String(row[header]).trim();
    return '';
  };

  return {
    customerName: pick('customerName'),
    phone: pick('phone'),
    reference: pick('reference'),
    saleDate: pick('saleDate'),
    address: pick('address'),
    centerId: pick('centerId'),
    notes: pick('notes'),
  };
}

export type RowValidation = {
  ok: boolean;
  mapped: MappedSaleRow;
  normalizedPhone: string;
  parsedDate: string | null;
  issues: string[];
};

export function validateMappedRow(mapped: MappedSaleRow): RowValidation {
  const issues: string[] = [];
  const normalizedPhone = normalizePhone(mapped.phone);
  const parsedDate = parseSaleDate(mapped.saleDate);

  if (!mapped.customerName) issues.push('missing name');
  if (!mapped.phone) issues.push('missing phone');
  else if (!isValidPhone(normalizedPhone)) issues.push(`invalid phone "${mapped.phone}"`);
  if (!mapped.saleDate) issues.push('missing date');
  else if (!parsedDate) issues.push(`invalid date "${mapped.saleDate}"`);

  return {
    ok: issues.length === 0,
    mapped,
    normalizedPhone,
    parsedDate,
    issues,
  };
}

export function analyzeCsvHeaders(headers: string[]) {
  const headerMap = buildHeaderMap(headers);
  return {
    headers,
    mappedFields: headerMap,
    missingRequired: (['customerName', 'phone', 'saleDate'] as const).filter((f) => !headerMap[f]),
  };
}

export { buildHeaderMap };
