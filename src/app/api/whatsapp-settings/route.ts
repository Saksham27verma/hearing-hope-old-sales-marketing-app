import { NextResponse } from 'next/server';
import {
  createWhatsAppTemplateSetting,
  deleteWhatsAppTemplateSettings,
  ensureWhatsAppTemplateSettings,
  isValidTemplateKey,
  slugifyTemplateKey,
  upsertWhatsAppTemplateSettings,
  type WhatsAppTemplateSettingInput,
} from '@/lib/whatsappSettings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await ensureWhatsAppTemplateSettings();
    return NextResponse.json({
      ok: true,
      rows,
      defaultHeaderImageUrl: (process.env.PINNACLE_LIFECYCLE_HEADER_IMAGE_URL || '').trim() || null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to load settings' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as WhatsAppTemplateSettingInput | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }
    const label = String(body.label || '').trim();
    const pinnacleTemplateName = String(body.pinnacleTemplateName || '').trim();
    if (!label) {
      return NextResponse.json({ ok: false, error: 'label required' }, { status: 400 });
    }
    if (!pinnacleTemplateName) {
      return NextResponse.json(
        { ok: false, error: 'Pinnacle / Meta template name required' },
        { status: 400 },
      );
    }
    const img = String(body.headerImageUrl || '').trim();
    if (img && !/^https:\/\//i.test(img)) {
      return NextResponse.json(
        { ok: false, error: 'Header image must be a public https:// URL' },
        { status: 400 },
      );
    }
    const row = await createWhatsAppTemplateSetting({
      templateKey: body.templateKey || label,
      label,
      pinnacleTemplateName,
      headerImageUrl: img || null,
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to create template' },
      { status: 400 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      rows?: WhatsAppTemplateSettingInput[];
    } | null;
    if (!body?.rows || !Array.isArray(body.rows)) {
      return NextResponse.json({ ok: false, error: 'rows array required' }, { status: 400 });
    }

    for (const row of body.rows) {
      const key = slugifyTemplateKey(row.templateKey);
      if (!isValidTemplateKey(key)) {
        return NextResponse.json(
          { ok: false, error: `Invalid template key: ${row.templateKey}` },
          { status: 400 },
        );
      }
      const name = String(row.pinnacleTemplateName || '').trim();
      if (!name) {
        return NextResponse.json(
          { ok: false, error: `Pinnacle template name required for ${row.templateKey}` },
          { status: 400 },
        );
      }
      const img = String(row.headerImageUrl || '').trim();
      if (img && !/^https:\/\//i.test(img)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Header image for ${row.templateKey} must be a public https:// URL`,
          },
          { status: 400 },
        );
      }
    }

    const rows = await upsertWhatsAppTemplateSettings(body.rows);
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to save settings' },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const keyParam = url.searchParams.get('templateKey') || '';
    const body = (await req.json().catch(() => null)) as { templateKeys?: string[] } | null;
    const keys = [
      ...(keyParam ? [keyParam] : []),
      ...(Array.isArray(body?.templateKeys) ? body!.templateKeys! : []),
    ];
    if (keys.length === 0) {
      return NextResponse.json({ ok: false, error: 'templateKey required' }, { status: 400 });
    }
    const affected = await deleteWhatsAppTemplateSettings(keys);
    const rows = await ensureWhatsAppTemplateSettings();
    return NextResponse.json({ ok: true, affected, rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to delete' },
      { status: 500 },
    );
  }
}
