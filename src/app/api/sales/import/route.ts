import { NextResponse } from 'next/server';
import { db, ensureTables } from '@/db';
import { legacySales } from '@/db/schema';
import { isoNow } from '@/lib/dates';
import { newId } from '@/lib/templates';
import { formatDbError } from '@/lib/dbErrors';
import {
  analyzeCsvHeaders,
  buildHeaderMap,
  mapRawRow,
  parseCsvText,
  validateMappedRow,
} from '@/lib/csvImport';

const HEADERS = ['customerName', 'phone', 'reference', 'saleDate', 'address', 'centerId', 'notes'];

export async function POST(req: Request) {
  try {
    await ensureTables();
    const body = (await req.json()) as { csv?: string; dedupe?: boolean };
    const csv = String(body.csv || '');
    const dedupe = body.dedupe !== false;
    const { rows: parsed, headers } = parseCsvText(csv);
    const headerMap = buildHeaderMap(headers);
    const analysis = analyzeCsvHeaders(headers);

    if (analysis.missingRequired.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Could not match required columns: ${analysis.missingRequired.join(', ')}. Found headers: ${headers.join(', ')}`,
          imported: 0,
          skipped: parsed.length,
          errors: [],
          detectedHeaders: headers,
          mappedFields: headerMap,
        },
        { status: 400 },
      );
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const existing = dedupe ? await db.select().from(legacySales) : [];
    const keySet = new Set(existing.map((r) => `${r.phone}|${r.saleDate}`));

    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      const line = i + 2;
      const mapped = mapRawRow(row, headerMap);
      const v = validateMappedRow(mapped);

      if (!v.ok) {
        errors.push(`Line ${line}: ${v.issues.join(', ')}`);
        skipped += 1;
        continue;
      }

      const phone = v.normalizedPhone;
      const saleDate = v.parsedDate!;
      const dk = `${phone}|${saleDate}`;
      if (dedupe && keySet.has(dk)) {
        skipped += 1;
        continue;
      }

      const now = isoNow();
      const id = newId();
      await db.insert(legacySales).values({
        id,
        customerName: mapped.customerName,
        phone,
        reference: mapped.reference || null,
        address: mapped.address || null,
        saleDate,
        centerId: mapped.centerId || null,
        notes: mapped.notes || null,
        source: 'zoho_import',
        status: 'active',
        milestonesSentJson: '{}',
        createdAt: now,
        updatedAt: now,
      });
      keySet.add(dk);
      imported += 1;
    }

    return NextResponse.json({
      ok: true,
      imported,
      skipped,
      errors: errors.slice(0, 50),
      previewCount: parsed.length,
      detectedHeaders: headers,
      mappedFields: headerMap,
    });
  } catch (e) {
    console.error('POST /api/sales/import:', e);
    return NextResponse.json(
      { ok: false, error: formatDbError(e), imported: 0, skipped: 0, errors: [] },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    expectedHeaders: HEADERS,
    acceptedAliases: {
      name: 'customerName, name, contact name, deal name…',
      phone: 'phone, phone number, mobile, contact number…',
      date: 'saleDate, date of sale, closing date, invoice date…',
    },
    sample:
      'customerName,phone,reference,saleDate,address,centerId,notes\nRajesh Kumar,9876543210,Dr. Sharma,2023-06-15,Delhi,,',
  });
}
