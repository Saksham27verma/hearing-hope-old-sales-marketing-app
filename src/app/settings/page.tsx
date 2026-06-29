'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import type { MilestoneRule } from '@/db/schema';

export default function SettingsPage() {
  const [rows, setRows] = useState<MilestoneRule[]>([]);
  const [crmUrl, setCrmUrl] = useState('');
  const [saved, setSaved] = useState('');

  const load = async () => {
    const res = await fetch('/api/milestones');
    const data = await res.json();
    setRows(data.rows || []);
    setCrmUrl(process.env.NEXT_PUBLIC_CRM_BASE_URL || 'Configured server-side');
  };

  useEffect(() => {
    void load();
  }, []);

  const saveRule = async (rule: MilestoneRule) => {
    await fetch('/api/milestones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    setSaved('Saved');
    setTimeout(() => setSaved(''), 2000);
  };

  return (
    <AppShell>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Settings
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        CRM webhook: {crmUrl} · Pinnacle keys live in hearing-hope-crm only.
      </Alert>
      {saved && <Alert severity="success">{saved}</Alert>}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Milestone rules
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Days</TableCell>
              <TableCell>Label</TableCell>
              <TableCell>Template key</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={r.daysAfterSale}
                    onChange={(e) =>
                      setRows(rows.map((x) => (x.id === r.id ? { ...x, daysAfterSale: Number(e.target.value) } : x)))
                    }
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={r.label}
                    onChange={(e) =>
                      setRows(rows.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)))
                    }
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={r.templateKey}
                    onChange={(e) =>
                      setRows(rows.map((x) => (x.id === r.id ? { ...x, templateKey: e.target.value } : x)))
                    }
                  />
                </TableCell>
                <TableCell>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={r.enabled}
                        onChange={(e) =>
                          setRows(rows.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x)))
                        }
                      />
                    }
                    label=""
                  />
                </TableCell>
                <TableCell>
                  <Button size="small" onClick={() => void saveRule(r)}>
                    Save
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </AppShell>
  );
}
