import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024; // 4MB

/**
 * Upload a header image via CRM → Firebase Storage, then return the public HTTPS URL.
 * Settings UI uses this so images can be managed entirely from the lifecycle app.
 */
export async function POST(req: Request) {
  try {
    const base = (process.env.CRM_BASE_URL || '').replace(/\/$/, '');
    const secret = (process.env.CRM_WEBHOOK_SECRET || '').trim();
    if (!base || !secret) {
      return NextResponse.json(
        { ok: false, error: 'CRM_BASE_URL / CRM_WEBHOOK_SECRET not configured' },
        { status: 500 },
      );
    }

    const form = await req.formData();
    const file = form.get('file');
    const templateKey = String(form.get('templateKey') || 'shared').trim() || 'shared';

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file required' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Image must be between 1 byte and 4MB' },
        { status: 400 },
      );
    }
    const type = (file.type || '').toLowerCase();
    if (!type.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'File must be an image (JPG/PNG)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const payload = {
      templateKey,
      contentType: type || 'image/jpeg',
      filename: file.name || `${templateKey}.jpg`,
      base64: buffer.toString('base64'),
    };

    const res = await fetch(`${base}/api/lifecycle/upload-header-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      url?: string;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.url) {
      return NextResponse.json(
        { ok: false, error: data.error || `CRM upload failed (${res.status})` },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, url: data.url });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
