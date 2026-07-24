'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import {
  Alert,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Switch,
  Stack,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { MilestoneRule } from '@/db/schema';

export default function SettingsPage() {
  const [rows, setRows] = useState<MilestoneRule[]>([]);
  const [crmUrl, setCrmUrl] = useState('');
  const [saved, setSaved] = useState('');
  const [adding, setAdding] = useState(false);

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

  const addSixMonthIfMissing = async () => {
    setAdding(true);
    const has = rows.some((r) => r.daysAfterSale === 180 || r.templateKey === 'service_6mo');
    if (has) {
      setSaved('6-month rule already exists');
      setAdding(false);
      setTimeout(() => setSaved(''), 2000);
      return;
    }
    await fetch('/api/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        daysAfterSale: 180,
        label: '6-month service',
        templateKey: 'service_6mo',
        titleTemplate: '{{milestoneLabel}} due — {{customerName}}',
        messageTemplate:
          'Hi {{customerName}}, your Hearing Hope device purchased on {{saleDate}} ({{reference}}) is due for a 6-month service checkup. Please call us to book your appointment.',
        enabled: true,
        sortOrder: 0,
      }),
    });
    setAdding(false);
    setSaved('6-month service rule added');
    setTimeout(() => setSaved(''), 2000);
    void load();
  };

  return (
    <AppShell>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 0.5 }}>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure milestone rules for service reminders and upgrade campaigns.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
        Service reminders send through CRM → Pinnacle using the same utility/document path as
        invoices. CRM webhook: {crmUrl}.
      </Alert>
      {saved && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
          {saved}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={1.5}
          sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Milestone rules
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Includes 6-month service, 1-year service, and 2-year upgrade by default.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            disabled={adding}
            onClick={() => void addSixMonthIfMissing()}
          >
            Ensure 6-month rule
          </Button>
        </Stack>

        <TableContainer>
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
              {rows
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder || a.daysAfterSale - b.daysAfterSale)
                .map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ minWidth: 100 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={r.daysAfterSale}
                        onChange={(e) =>
                          setRows(
                            rows.map((x) =>
                              x.id === r.id ? { ...x, daysAfterSale: Number(e.target.value) } : x,
                            ),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 160 }}>
                      <TextField
                        size="small"
                        value={r.label}
                        onChange={(e) =>
                          setRows(rows.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)))
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          size="small"
                          value={r.templateKey}
                          onChange={(e) =>
                            setRows(
                              rows.map((x) => (x.id === r.id ? { ...x, templateKey: e.target.value } : x)),
                            )
                          }
                        />
                        {r.daysAfterSale === 180 && <Chip size="small" label="6mo" color="primary" />}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={r.enabled}
                        onChange={(e) =>
                          setRows(
                            rows.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x)),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="small" variant="contained" onClick={() => void saveRule(r)}>
                        Save
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </AppShell>
  );
}
