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

export async function sendCrmWhatsAppOne(body: {
  externalSaleId: string;
  phone: string;
  customerName: string;
  templateKey: string;
  bodyParams: string[];
}): Promise<{ ok: boolean; messageId?: string; error?: string; raw?: unknown }> {
  const base = CRM_BASE();
  const secret = WEBHOOK_SECRET();
  if (!base || !secret) return { ok: false, error: 'CRM not configured' };

  const res = await fetch(`${base}/api/lifecycle/whatsapp/send-one`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    messageId?: string;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || res.statusText };
  return { ok: true, messageId: data.messageId, raw: data };
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

  const res = await fetch(`${base}/api/lifecycle/whatsapp/send-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    jobId?: string;
    total?: number;
    results?: Array<{ externalSaleId: string; ok: boolean; error?: string }>;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || res.statusText };
  return { ok: true, jobId: data.jobId, total: data.total, results: data.results };
}

export function verifyStatsSecret(req: Request): boolean {
  const secret = WEBHOOK_SECRET();
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}
