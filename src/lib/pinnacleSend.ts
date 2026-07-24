/**
 * Direct Pinnacle / Pinbot WhatsApp send — same partnersv1 endpoint and auth
 * as hearing-hope-crm invoice WhatsApp (apikey header).
 */

export function normalizePhoneForWhatsApp(raw: string): string {
  const digits = (raw || '').toString().replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

function pinnacleConfig() {
  const phoneId = (process.env.PINNACLE_PHONE_ID || '').trim();
  const apiKey = (process.env.PINNACLE_API_KEY || '').trim();
  const templateLanguage = (process.env.PINNACLE_TEMPLATE_LANGUAGE || 'en').trim();
  if (!phoneId || !apiKey) {
    throw new Error('Pinnacle is not configured (PINNACLE_PHONE_ID / PINNACLE_API_KEY).');
  }
  return { phoneId, apiKey, templateLanguage };
}

const TEMPLATE_ENV_MAP: Record<string, string> = {
  service_6mo: 'PINNACLE_LIFECYCLE_TEMPLATE_SERVICE_6MO',
  service_1yr: 'PINNACLE_LIFECYCLE_TEMPLATE_SERVICE',
  upgrade_2yr: 'PINNACLE_LIFECYCLE_TEMPLATE_UPGRADE',
  general_followup: 'PINNACLE_LIFECYCLE_TEMPLATE_GENERAL',
};

const TEMPLATE_DEFAULTS: Record<string, string> = {
  service_6mo: 'service_reminder_6mo',
  service_1yr: 'service_reminder_1yr',
  upgrade_2yr: 'upgrade_offer_2yr',
  general_followup: 'general_followup',
};

export function resolveTemplateName(templateKey: string): string {
  const key = String(templateKey || '').trim();
  const envName = TEMPLATE_ENV_MAP[key];
  if (envName) {
    const v = (process.env[envName] || '').trim();
    if (v) return v;
  }
  return TEMPLATE_DEFAULTS[key] || key;
}

export function isPinnacleConfigured(): boolean {
  return Boolean(
    (process.env.PINNACLE_PHONE_ID || '').trim() && (process.env.PINNACLE_API_KEY || '').trim(),
  );
}

function headerImageLink(): string {
  const link = (process.env.PINNACLE_LIFECYCLE_HEADER_IMAGE_URL || '').trim();
  if (!/^https:\/\//i.test(link)) {
    throw new Error(
      'PINNACLE_LIFECYCLE_HEADER_IMAGE_URL must be a public https:// JPG/PNG (prefer Firebase Storage URL).',
    );
  }
  return link;
}

export function buildLifecycleTemplatePayload(params: {
  to: string;
  templateName: string;
  languageCode: string;
  bodyParams?: string[];
}) {
  const components: Array<Record<string, unknown>> = [
    {
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: { link: headerImageLink() },
        },
      ],
    },
  ];
  const bodyParams = Array.isArray(params.bodyParams) ? params.bodyParams : [];
  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({ type: 'text', text: String(text || ' ') })),
    });
  }
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: params.to,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.languageCode },
      components,
    },
  };
}

export async function postToPinnacle(body: Record<string, unknown>): Promise<unknown> {
  const { phoneId, apiKey } = pinnacleConfig();
  const url = `https://partnersv1.pinbot.ai/v3/${phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let responseJson: unknown = null;
  try {
    responseJson = text ? JSON.parse(text) : null;
  } catch {
    responseJson = { raw: text };
  }
  if (!res.ok) {
    const root =
      typeof responseJson === 'object' && responseJson
        ? (responseJson as Record<string, unknown>)
        : null;
    const detail = root ? JSON.stringify(root.error || root) : text || res.statusText;
    throw new Error(`Pinnacle API error (${res.status}): ${detail}`);
  }
  return responseJson;
}

/** Channel test using the same invoice template that already delivers in CRM. */
export async function sendInvoiceTemplateProbe(params: {
  phone: string;
  customerName?: string;
}): Promise<
  | { ok: true; messageId: string; to: string; response: unknown }
  | { ok: false; error: string }
> {
  try {
    const to = normalizePhoneForWhatsApp(params.phone);
    if (!to || to.length < 10) return { ok: false, error: 'Invalid phone number' };
    const { templateLanguage } = pinnacleConfig();
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: (process.env.PINNACLE_TEMPLATE_NAME || 'invoice_from_crm_testing_template').trim(),
        language: { code: templateLanguage || 'en' },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'document',
                document: {
                  link: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                  filename: 'HearingHope_channel_test.pdf',
                },
              },
            ],
          },
          {
            type: 'body',
            parameters: [{ type: 'text', text: params.customerName?.trim() || 'Customer' }],
          },
        ],
      },
    };
    const response = await postToPinnacle(payload);
    const messageId = extractMessageId(response);
    if (!messageId) {
      return {
        ok: false,
        error: `Pinnacle returned no message id: ${JSON.stringify(response).slice(0, 300)}`,
      };
    }
    return { ok: true, messageId, to, response };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invoice probe failed' };
  }
}

export function extractMessageId(response: unknown): string | undefined {
  if (!response || typeof response !== 'object') return undefined;
  const messages = (response as Record<string, unknown>).messages;
  if (Array.isArray(messages) && messages[0] && typeof messages[0] === 'object') {
    const id = (messages[0] as Record<string, unknown>).id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

function isTemplateNotFoundError(message: string): boolean {
  return (
    message.includes('132001') ||
    message.includes('template not found') ||
    message.includes('does not exist in the translation')
  );
}

function isParamMismatchError(message: string): boolean {
  return (
    message.includes('132000') ||
    message.includes('Number of parameters') ||
    (message.toLowerCase().includes('param') && message.toLowerCase().includes('mismatch'))
  );
}

/**
 * Send an approved lifecycle template via Pinnacle (same API as CRM invoices).
 */
export async function sendLifecycleWhatsAppDirect(params: {
  phone: string;
  templateKey: string;
  customerName?: string;
  bodyParams?: string[];
}): Promise<
  | { ok: true; messageId: string; templateName: string; to: string; response: unknown }
  | { ok: false; error: string }
> {
  try {
    const to = normalizePhoneForWhatsApp(params.phone);
    if (!to || to.length < 10) return { ok: false, error: 'Invalid phone number' };

    const { templateLanguage } = pinnacleConfig();
    const templateName = resolveTemplateName(params.templateKey);
    const languages = Array.from(
      new Set([templateLanguage, 'en', 'en_US'].map((x) => String(x || '').trim()).filter(Boolean)),
    );

    const bodyAttempts: string[][] = [];
    if (Array.isArray(params.bodyParams) && params.bodyParams.length > 0) {
      bodyAttempts.push(params.bodyParams.map(String));
    }
    bodyAttempts.push([]);
    if (params.customerName?.trim()) {
      bodyAttempts.push([params.customerName.trim()]);
    }

    // Dedupe identical attempts
    const seen = new Set<string>();
    const uniqueBodyAttempts = bodyAttempts.filter((b) => {
      const k = JSON.stringify(b);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    let lastError = '';

    for (const languageCode of languages) {
      for (const bodyParams of uniqueBodyAttempts) {
        try {
          const payload = buildLifecycleTemplatePayload({
            to,
            templateName,
            languageCode,
            bodyParams,
          });
          const response = await postToPinnacle(payload);
          const messageId = extractMessageId(response);
          if (!messageId) {
            throw new Error(
              `Pinnacle returned no message id: ${JSON.stringify(response).slice(0, 300)}`,
            );
          }
          return { ok: true, messageId, templateName, to, response };
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'Pinnacle send failed';
          if (isTemplateNotFoundError(lastError)) {
            // try next language
            break;
          }
          if (isParamMismatchError(lastError)) {
            // try next body shape
            continue;
          }
          // Non-recoverable for this language (e.g. IMAGE header / auth)
          return { ok: false, error: `${lastError} (template=${templateName})` };
        }
      }
    }

    return { ok: false, error: `${lastError} (template=${templateName})` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Pinnacle send failed',
    };
  }
}
