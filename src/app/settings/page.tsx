'use client';

import React, { useEffect, useRef, useState } from 'react';
import AppShell from '@/components/AppShell';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Switch,
  Chip,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import type { MilestoneRule, WhatsAppTemplateSetting } from '@/db/schema';

type EditableTemplate = {
  templateKey: string;
  label: string;
  pinnacleTemplateName: string;
  headerImageUrl: string;
};

export default function SettingsPage() {
  const [rows, setRows] = useState<MilestoneRule[]>([]);
  const [templates, setTemplates] = useState<EditableTemplate[]>([]);
  const [crmUrl, setCrmUrl] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    const [milestonesRes, templatesRes] = await Promise.all([
      fetch('/api/milestones'),
      fetch('/api/whatsapp-settings'),
    ]);
    const milestonesData = await milestonesRes.json();
    const templatesData = await templatesRes.json();
    setRows(milestonesData.rows || []);
    setTemplates(
      ((templatesData.rows || []) as WhatsAppTemplateSetting[]).map((r) => ({
        templateKey: r.templateKey,
        label: r.label,
        pinnacleTemplateName: r.pinnacleTemplateName,
        headerImageUrl: r.headerImageUrl || '',
      })),
    );
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
    setSaved('Milestone rule saved');
    setTimeout(() => setSaved(''), 2000);
  };

  const saveTemplates = async () => {
    setSavingTemplates(true);
    setError('');
    try {
      const res = await fetch('/api/whatsapp-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: templates.map((t) => ({
            templateKey: t.templateKey,
            label: t.label,
            pinnacleTemplateName: t.pinnacleTemplateName,
            headerImageUrl: t.headerImageUrl || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Failed to save WhatsApp templates');
        return;
      }
      setTemplates(
        ((data.rows || []) as WhatsAppTemplateSetting[]).map((r) => ({
          templateKey: r.templateKey,
          label: r.label,
          pinnacleTemplateName: r.pinnacleTemplateName,
          headerImageUrl: r.headerImageUrl || '',
        })),
      );
      setSaved('WhatsApp templates & images saved');
      setTimeout(() => setSaved(''), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingTemplates(false);
    }
  };

  const uploadImage = async (templateKey: string, file: File) => {
    setUploadingKey(templateKey);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('templateKey', templateKey);
      const res = await fetch('/api/whatsapp-settings/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.url) {
        setError(data.error || 'Image upload failed');
        return;
      }
      setTemplates((prev) =>
        prev.map((t) => (t.templateKey === templateKey ? { ...t, headerImageUrl: data.url } : t)),
      );
      setSaved(`Image uploaded for ${templateKey} — click Save templates to persist`);
      setTimeout(() => setSaved(''), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingKey(null);
    }
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
          Control WhatsApp template names, header images, and milestone rules from here.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
        Sends go through CRM → Pinnacle. CRM webhook: {crmUrl}. Template names must match Meta /
        Pinnacle exactly. Header images must be public <code>https://</code> JPG/PNG URLs.
      </Alert>
      {saved && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
          {saved}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden',
          mb: 3,
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
              WhatsApp templates & images
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Edit the exact Pinnacle template name and header image used for each send type.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="contained"
            startIcon={savingTemplates ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
            disabled={savingTemplates}
            onClick={() => void saveTemplates()}
          >
            Save templates
          </Button>
        </Stack>

        <Stack spacing={2.5} sx={{ p: 2.5 }}>
          {templates.map((t) => (
            <Box
              key={t.templateKey}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2,
              }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'stretch', md: 'flex-start' }}
              >
                <Box
                  sx={{
                    width: { xs: '100%', md: 140 },
                    height: 100,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'action.hover',
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {t.headerImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.headerImageUrl}
                      alt={`${t.label} header`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      No image
                    </Typography>
                  )}
                </Box>

                <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography fontWeight={700}>{t.label}</Typography>
                    <Chip size="small" label={t.templateKey} variant="outlined" />
                  </Stack>
                  <TextField
                    size="small"
                    label="Pinnacle / Meta template name"
                    value={t.pinnacleTemplateName}
                    onChange={(e) =>
                      setTemplates((prev) =>
                        prev.map((x) =>
                          x.templateKey === t.templateKey
                            ? { ...x, pinnacleTemplateName: e.target.value }
                            : x,
                        ),
                      )
                    }
                    fullWidth
                    helperText="Must match the approved template name in Meta Business Manager"
                  />
                  <TextField
                    size="small"
                    label="Header image URL (https)"
                    value={t.headerImageUrl}
                    onChange={(e) =>
                      setTemplates((prev) =>
                        prev.map((x) =>
                          x.templateKey === t.templateKey
                            ? { ...x, headerImageUrl: e.target.value }
                            : x,
                        ),
                      )
                    }
                    fullWidth
                    placeholder="https://…"
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <input
                      ref={(el) => {
                        fileInputs.current[t.templateKey] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void uploadImage(t.templateKey, file);
                      }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={
                        uploadingKey === t.templateKey ? (
                          <CircularProgress size={14} />
                        ) : (
                          <UploadIcon />
                        )
                      }
                      disabled={uploadingKey === t.templateKey}
                      onClick={() => fileInputs.current[t.templateKey]?.click()}
                    >
                      Upload image
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      JPG/PNG/WebP up to 4MB — uploaded to CRM Firebase Storage
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </Box>
          ))}
          {templates.length === 0 && (
            <Typography color="text.secondary">Loading templates…</Typography>
          )}
        </Stack>
      </Paper>

      <Divider sx={{ mb: 3 }} />

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
              Includes 6-month service, 1-year service, and 2-year upgrade by default. Template key
              must match one of the WhatsApp templates above.
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
