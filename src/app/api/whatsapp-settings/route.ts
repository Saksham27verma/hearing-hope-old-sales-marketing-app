import { NextResponse } from 'next/server';
import {
  ensureWhatsAppTemplateSettings,
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

export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      rows?: WhatsAppTemplateSettingInput[];
    } | null;
    if (!body?.rows || !Array.isArray(body.rows)) {
      return NextResponse.json({ ok: false, error: 'rows array required' }, { status: 400 });
    }

    for (const row of body.rows) {
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
      { status: 500 },
    );
  }
}
