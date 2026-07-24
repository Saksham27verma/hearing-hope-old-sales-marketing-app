const CRM_BASE = () => (process.env.CRM_BASE_URL || '').replace(/\/$/, '');
const WEBHOOK_SECRET = () => process.env.CRM_WEBHOOK_SECRET?.trim() || '';

export async function notifyCrmSaleMilestone(body: {
  externalSaleId: string;
  customerName: string;
  phone: string;
  reference?: string;
  saleDate: string;
  milestoneDays: number;
  milestoneLabel: string;
  title: string;
  message: string;
  centerId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const base = CRM_BASE();
  const secret = WEBHOOK_SECRET();
  if (!base || !secret) {
    return { ok: false, error: 'CRM_BASE_URL or CRM_WEBHOOK_SECRET not configured' };
  }

  const res = await fetch(`${base}/api/notifications/sale-milestone`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: data.error || res.statusText };
  return { ok: true };
}

async function readJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 200) || res.statusText };
  }
}

export async function sendCrmWhatsAppOne(body: {
  externalSaleId: string;
  phone: string;
  customerName: string;
  templateKey: string;
  bodyParams?: string[];
}): Promise<{
  ok: boolean;
  messageId?: string;
  templateName?: string;
  to?: string;
  error?: string;
  raw?: unknown;
}> {
  const base = CRM_BASE();
  const secret = WEBHOOK_SECRET();
  if (!base || !secret) return { ok: false, error: 'CRM not configured' };

  try {
    const res = await fetch(`${base}/api/lifecycle/whatsapp/send-one`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        ...body,
        bodyParams: Array.isArray(body.bodyParams) ? body.bodyParams : [],
      }),
    });
    const data = await readJsonSafe(res);
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        error: String(data.error || data.message || res.statusText || `CRM error ${res.status}`),
        raw: data,
      };
    }
    const messageId = typeof data.messageId === 'string' ? data.messageId.trim() : '';
    if (!messageId) {
      return {
        ok: false,
        error:
          'CRM reported success but Pinnacle returned no WhatsApp message id — message was not confirmed sent',
        raw: data,
      };
    }
    return {
      ok: true,
      messageId,
      templateName: typeof data.templateName === 'string' ? data.templateName : undefined,
      to: typeof data.to === 'string' ? data.to : undefined,
      raw: data,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Cannot reach CRM at ${base}: ${e.message}`
          : `Cannot reach CRM at ${base}`,
    };
  }
}

export async function sendCrmWhatsAppBatch(body: {
  templateKey: string;
  recipients: Array<{
    externalSaleId: string;
    phone: string;
    customerName: string;
    bodyParams: string[];
  }>;
  delayMs?: number;
}): Promise<{
  ok: boolean;
  jobId?: string;
  total?: number;
  results?: Array<{ externalSaleId: string; ok: boolean; error?: string }>;
  error?: string;
}> {
  const base = CRM_BASE();
  const secret = WEBHOOK_SECRET();
  if (!base || !secret) return { ok: false, error: 'CRM not configured' };

  try {
    const res = await fetch(`${base}/api/lifecycle/whatsapp/send-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    });
    const data = await readJsonSafe(res);
    if (!res.ok) {
      return { ok: false, error: String(data.error || data.message || res.statusText || `CRM error ${res.status}`) };
    }
    return {
      ok: true,
      jobId: typeof data.jobId === 'string' ? data.jobId : undefined,
      total: typeof data.total === 'number' ? data.total : undefined,
      results: Array.isArray(data.results)
        ? (data.results as Array<{ externalSaleId: string; ok: boolean; error?: string }>)
        : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Cannot reach CRM at ${base}: ${e.message}`
          : `Cannot reach CRM at ${base}`,
    };
  }
}

export function verifyStatsSecret(req: Request): boolean {
  const secret = WEBHOOK_SECRET();
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}
