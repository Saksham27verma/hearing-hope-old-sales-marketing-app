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
import type { LegacySale, MilestoneRule, WhatsAppTemplateSetting } from '@/db/schema';
import { applyTemplate } from '@/lib/templates';
import { whatsAppHref } from '@/lib/phone';
import { WHATSAPP_TEMPLATE_OPTIONS } from '@/lib/whatsappTemplates';

type Props = {
  open: boolean;
  sale: Pick<LegacySale, 'id' | 'customerName' | 'phone' | 'reference' | 'saleDate'> | null;
  onClose: () => void;
  onSent?: (ok: boolean, message: string) => void;
};

export default function WhatsAppSendDialog({ open, sale, onClose, onSent }: Props) {
  const [rules, setRules] = useState<MilestoneRule[]>([]);
  const [templateSettings, setTemplateSettings] = useState<Record<string, string>>({});
  const [templateKey, setTemplateKey] = useState('service_6mo');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setSuccess('');
    void Promise.all([
      fetch('/api/milestones').then((r) => r.json()),
      fetch('/api/whatsapp-settings').then((r) => r.json()),
    ]).then(([milestones, settings]) => {
      const rows = (milestones.rows || []) as MilestoneRule[];
      setRules(rows);
      const map: Record<string, string> = {};
      for (const s of (settings.rows || []) as WhatsAppTemplateSetting[]) {
        map[s.templateKey] = s.pinnacleTemplateName;
      }
      setTemplateSettings(map);
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
  const templateName = templateSettings[templateKey] || templateKey;

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
      const sentLabel = data.templateName || templateName;
      const msg = `Sent Meta-approved template ${sentLabel} to ${to}. If it does not appear on that WhatsApp within a minute, the template is likely MARKETING-category and Meta silently drops it — recreate it as UTILITY in Pinnacle, or set PINNACLE_LIFECYCLE_DELIVERY_MODE=document in CRM as a fallback.`;
      setSuccess(msg);
      onSent?.(true, `WhatsApp accepted → ${to} (${sentLabel})`);
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
            Sends the approved Meta template <strong>{templateName}</strong> (IMAGE header +
            approved body text) to <strong>{displayPhone || 'unknown phone'}</strong> via Pinnacle.
            The preview below is not sent; Meta delivers exactly the approved template copy.
          </Alert>
          <FormControl fullWidth size="small">
            <InputLabel>Template</InputLabel>
            <Select
              label="Template"
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
              Preview for “Open WhatsApp” only — NOT the Pinnacle template body
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
