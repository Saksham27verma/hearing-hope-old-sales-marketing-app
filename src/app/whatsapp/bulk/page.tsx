'use client';

import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import type { MilestoneRule } from '@/db/schema';

export default function BulkWhatsAppPage() {
  const [rules, setRules] = useState<MilestoneRule[]>([]);
  const [milestoneDays, setMilestoneDays] = useState<number | ''>('');
  const [templateKey, setTemplateKey] = useState('service_1yr');
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  useEffect(() => {
    void fetch('/api/milestones')
      .then((r) => r.json())
      .then((d) => setRules(d.rows || []));
  }, []);

  const preview = async () => {
    const res = await fetch(`/api/whatsapp?preview=1&milestoneDays=${milestoneDays}`);
    // Use getDueTodayRecipients via a simple count endpoint - we'll infer from PUT dry run
    setCount(null);
    setResult('Click Send to message all due today (excludes do-not-contact).');
  };

  const sendAll = async () => {
    if (!window.confirm('Send WhatsApp template to all customers due today for this milestone?')) return;
    setLoading(true);
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
    setCount(data.total ?? 0);
  };

  return (
    <AppShell>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Bulk WhatsApp
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Uses approved Pinnacle templates via hearing-hope-crm. Rate-limited ~1.5s between messages.
      </Typography>
      <Paper sx={{ p: 2, maxWidth: 480 }}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Milestone (optional)</InputLabel>
          <Select
            value={milestoneDays}
            label="Milestone (optional)"
            onChange={(e) => setMilestoneDays(e.target.value as number | '')}
          >
            <MenuItem value="">All due today</MenuItem>
            {rules.map((r) => (
              <MenuItem key={r.id} value={r.daysAfterSale}>
                {r.label} ({r.daysAfterSale} days)
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Template key</InputLabel>
          <Select value={templateKey} label="Template key" onChange={(e) => setTemplateKey(e.target.value)}>
            <MenuItem value="service_1yr">service_1yr</MenuItem>
            <MenuItem value="upgrade_2yr">upgrade_2yr</MenuItem>
            <MenuItem value="general_followup">general_followup</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" color="success" disabled={loading} onClick={() => void sendAll()}>
          Message all due today
        </Button>
        {loading && <LinearProgress sx={{ mt: 2 }} />}
        {result && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {result}
          </Alert>
        )}
      </Paper>
    </AppShell>
  );
}
