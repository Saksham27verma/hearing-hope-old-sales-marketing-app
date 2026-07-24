'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { LegacySale, MilestoneRule } from '@/db/schema';
import { applyTemplate } from '@/lib/templates';
import { whatsAppHref } from '@/lib/phone';
import { WHATSAPP_TEMPLATE_OPTIONS } from '@/lib/whatsappTemplates';

type Props = {
  open: boolean;
  sale: Pick<LegacySale, 'id' | 'customerName' | 'phone' | 'reference' | 'saleDate'> | null;
  onClose: () => void;
  onSent?: (ok: boolean, message: string) => void;
};

const REMINDER_LABELS: Record<string, string> = {
  service_6mo: '6-month service reminder PDF',
  service_1yr: '1-year service reminder PDF',
  upgrade_2yr: '2-year upgrade offer PDF',
  general_followup: 'general follow-up PDF',
};

export default function WhatsAppSendDialog({ open, sale, onClose, onSent }: Props) {
  const [rules, setRules] = useState<MilestoneRule[]>([]);
  const [templateKey, setTemplateKey] = useState('service_6mo');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setSuccess('');
    void fetch('/api/milestones')
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.rows || []) as MilestoneRule[];
        setRules(rows);
        if (rows.some((r) => r.templateKey === 'service_6mo')) {
          setTemplateKey('service_6mo');
        } else if (rows[0]?.templateKey) {
          setTemplateKey(rows[0].templateKey);
        }
      });
  }, [open]);

  const options = useMemo(() => {
    const fromRules = rules.map((r) => ({
      key: r.templateKey,
      label: `${r.label} (${r.daysAfterSale}d)`,
      messageTemplate: r.messageTemplate,
      milestoneLabel: r.label,
    }));
    const keys = new Set(fromRules.map((o) => o.key));
    const extras = WHATSAPP_TEMPLATE_OPTIONS.filter((o) => !keys.has(o.key)).map((o) => ({
      key: o.key,
      label: o.label,
      messageTemplate: o.defaultMessage,
      milestoneLabel: o.label,
    }));
    return [...fromRules, ...extras];
  }, [rules]);

  const preview = useMemo(() => {
    if (!sale) return '';
    const opt = options.find((o) => o.key === templateKey);
    const fallback =
      WHATSAPP_TEMPLATE_OPTIONS.find((o) => o.key === templateKey)?.defaultMessage ||
      'Hi {{customerName}}, this is Hearing Hope regarding your purchase on {{saleDate}}.';
    return applyTemplate(opt?.messageTemplate || fallback, {
      customerName: sale.customerName,
      phone: sale.phone,
      reference: sale.reference || undefined,
      saleDate: sale.saleDate,
      milestoneLabel: opt?.milestoneLabel,
    });
  }, [sale, options, templateKey]);

  const displayPhone = (sale?.phone || '').replace(/\D/g, '');
  const reminderLabel = REMINDER_LABELS[templateKey] || 'service reminder PDF';

  const openDirect = () => {
    if (!sale) return;
    const href = whatsAppHref(sale.phone, preview);
    window.open(href, '_blank', 'noopener,noreferrer');
    onSent?.(true, 'Opened WhatsApp');
    onClose();
  };

  const sendApi = async () => {
    if (!sale) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: sale.id,
          templateKey,
          bodyParams: [],
        }),
      });
      const text = await res.text();
      let data: {
        ok?: boolean;
        error?: string;
        messageId?: string;
        templateName?: string;
        to?: string;
      } = {};
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        data = { ok: false, error: text || `Request failed (${res.status})` };
      }
      if (!res.ok || !data.ok || !data.messageId) {
        const msg =
          data.error ||
          (!data.messageId && data.ok
            ? 'Pinnacle did not confirm a message id'
            : `WhatsApp send failed (${res.status})`);
        setError(msg);
        onSent?.(false, msg);
        return;
      }
      const to = data.to || displayPhone;
      const msg = `Sent ${reminderLabel} to ${to} via Pinnacle (same delivery path as invoices). Check WhatsApp on that number for a PDF from Hearing Hope.`;
      setSuccess(msg);
      onSent?.(true, `WhatsApp sent → ${to}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'WhatsApp send failed';
      setError(msg);
      onSent?.(false, msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>WhatsApp {sale?.customerName || ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Sends to <strong>{displayPhone || 'unknown phone'}</strong> using the same Pinnacle
            utility/document path as Sales &amp; Invoicing (service reminder PDF). CRM must be
            running locally on port 3002.
          </Alert>
          <FormControl fullWidth size="small">
            <InputLabel>Reminder</InputLabel>
            <Select
              label="Reminder"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
            >
              {options.map((o) => (
                <MenuItem key={o.key} value={o.key}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'rgba(13, 115, 119, 0.06)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontWeight: 600 }}>
              PDF content (also used for “Open WhatsApp” text)
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {preview}
            </Typography>
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} disabled={sending}>
          Close
        </Button>
        <Button
          variant="outlined"
          color="success"
          startIcon={<OpenInNewIcon />}
          onClick={openDirect}
          disabled={!sale || sending}
        >
          Open WhatsApp
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <WhatsAppIcon />}
          onClick={() => void sendApi()}
          disabled={!sale || sending}
        >
          Send via Pinnacle
        </Button>
      </DialogActions>
    </Dialog>
  );
}
