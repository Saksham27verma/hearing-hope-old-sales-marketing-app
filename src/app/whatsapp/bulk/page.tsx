'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  LinearProgress,
  Paper,
  Stack,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import type { MilestoneRule } from '@/db/schema';
import { WHATSAPP_TEMPLATE_OPTIONS } from '@/lib/whatsappTemplates';

export default function BulkWhatsAppPage() {
  const [rules, setRules] = useState<MilestoneRule[]>([]);
  const [milestoneDays, setMilestoneDays] = useState<number | ''>('');
  const [templateKey, setTemplateKey] = useState('service_6mo');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
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
  }, []);

  const templateOptions = useMemo(() => {
    const fromRules = rules.map((r) => ({
      key: r.templateKey,
      label: `${r.label} · ${r.templateKey}`,
    }));
    const keys = new Set(fromRules.map((o) => o.key));
    const extras = WHATSAPP_TEMPLATE_OPTIONS.filter((o) => !keys.has(o.key)).map((o) => ({
      key: o.key,
      label: `${o.label} · ${o.key}`,
    }));
    return [...fromRules, ...extras];
  }, [rules]);

  const sendAll = async () => {
    if (!window.confirm('Send WhatsApp template to all customers due today for this milestone?')) return;
    setLoading(true);
    setResult('');
    const res = await fetch('/api/whatsapp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestoneDays: milestoneDays === '' ? undefined : milestoneDays,
        templateKey,
        delayMs: 1500,
      }),
    });
    const data = await res.json();
    setLoading(false);
    setResult(`Sent: ${data.sent ?? 0} · Failed: ${data.failed ?? 0} · Total: ${data.total ?? 0}`);
  };

  return (
    <AppShell>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 0.5 }}>
          Bulk WhatsApp
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Uses approved Pinnacle templates via hearing-hope-crm. Rate-limited ~1.5s between messages.
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          maxWidth: 520,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        <Stack spacing={2.5}>
          <FormControl fullWidth>
            <InputLabel>Milestone (optional)</InputLabel>
            <Select
              value={milestoneDays}
              label="Milestone (optional)"
              onChange={(e) => {
                const v = e.target.value as number | '';
                setMilestoneDays(v);
                if (v !== '') {
                  const rule = rules.find((r) => r.daysAfterSale === v);
                  if (rule) setTemplateKey(rule.templateKey);
                }
              }}
            >
              <MenuItem value="">All due today</MenuItem>
              {rules.map((r) => (
                <MenuItem key={r.id} value={r.daysAfterSale}>
                  {r.label} ({r.daysAfterSale} days)
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Template</InputLabel>
            <Select
              value={templateKey}
              label="Template"
              onChange={(e) => setTemplateKey(e.target.value)}
            >
              {templateOptions.map((o) => (
                <MenuItem key={o.key} value={o.key}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            color="success"
            size="large"
            disabled={loading}
            startIcon={<WhatsAppIcon />}
            onClick={() => void sendAll()}
          >
            Message all due today
          </Button>

          {loading && <LinearProgress color="success" />}
          {result && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {result}
            </Alert>
          )}
        </Stack>
      </Paper>
    </AppShell>
  );
}
