/** Normalize Indian phone for storage/display (digits only, 91 prefix for 10-digit). */
export function normalizePhone(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

export function isValidPhone(raw: string): boolean {
  const n = normalizePhone(raw);
  return n.length >= 12 && n.startsWith('91');
}

export function formatPhoneDisplay(raw: string): string {
  const n = normalizePhone(raw);
  if (n.length === 12 && n.startsWith('91')) return `+${n.slice(0, 2)} ${n.slice(2)}`;
  return raw;
}

export function telHref(raw: string): string {
  const n = normalizePhone(raw);
  return n ? `tel:+${n}` : '#';
}

export function whatsAppHref(raw: string, text?: string): string {
  const n = normalizePhone(raw);
  if (!n) return '#';
  const base = `https://wa.me/${n}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
