'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import AppShell from '@/components/AppShell';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
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
  IconButton,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { MilestoneRule, WhatsAppTemplateSetting } from '@/db/schema';

type EditableTemplate = {
  /** Stable React key while editing (survives key renames). */
  uid: string;
  /** Key currently stored in DB (empty for brand-new unsaved rows). */
  originalKey: string;
  templateKey: string;
  label: string;
  pinnacleTemplateName: string;
  headerImageUrl: string;
};

function slugPreview(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

export default function SettingsPage() {
  const uidPrefix = useId();
  const uidCounter = useRef(0);
  const nextUid = () => `${uidPrefix}-${++uidCounter.current}`;

  const [rows, setRows] = useState<MilestoneRule[]>([]);
  const [templates, setTemplates] = useState<EditableTemplate[]>([]);
  const [crmUrl, setCrmUrl] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [uploadingUid, setUploadingUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    label: '',
    templateKey: '',
    pinnacleTemplateName: '',
    headerImageUrl: '',
  });
  const [creating, setCreating] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const mapRows = (list: WhatsAppTemplateSetting[]): EditableTemplate[] =>
    list.map((r) => ({
      uid: nextUid(),
      originalKey: r.templateKey,
      templateKey: r.templateKey,
      label: r.label,
      pinnacleTemplateName: r.pinnacleTemplateName,
      headerImageUrl: r.headerImageUrl || '',
    }));

  const load = async () => {
    const [milestonesRes, templatesRes] = await Promise.all([
      fetch('/api/milestones'),
      fetch('/api/whatsapp-settings'),
    ]);
    const milestonesData = await milestonesRes.json();
    const templatesData = await templatesRes.json();
    setRows(milestonesData.rows || []);
    setTemplates(mapRows((templatesData.rows || []) as WhatsAppTemplateSetting[]));
    setCrmUrl(process.env.NEXT_PUBLIC_CRM_BASE_URL || 'Configured server-side');
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            previousKey: t.originalKey || undefined,
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
      setTemplates(mapRows((data.rows || []) as WhatsAppTemplateSetting[]));
      setSaved('WhatsApp templates & images saved');
      setTimeout(() => setSaved(''), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingTemplates(false);
    }
  };

  const createTemplate = async () => {
    setCreating(true);
    setError('');
    try {
      const label = newForm.label.trim();
      const pinnacleTemplateName = newForm.pinnacleTemplateName.trim();
      if (!label || !pinnacleTemplateName) {
        setError('Label and Pinnacle template name are required');
        return;
      }
      const res = await fetch('/api/whatsapp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          templateKey: newForm.templateKey.trim() || label,
          pinnacleTemplateName,
          headerImageUrl: newForm.headerImageUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Failed to create template');
        return;
      }
      setAddOpen(false);
      setNewForm({ label: '', templateKey: '', pinnacleTemplateName: '', headerImageUrl: '' });
      setSaved('New template created');
      setTimeout(() => setSaved(''), 2500);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const deleteTemplate = async (t: EditableTemplate) => {
    if (!t.originalKey) {
      setTemplates((prev) => prev.filter((x) => x.uid !== t.uid));
      return;
    }
    if (
      !window.confirm(
        `Delete template “${t.label}” (${t.originalKey})? Milestone rules using this key will need updating.`,
      )
    ) {
      return;
    }
    setDeletingUid(t.uid);
    setError('');
    try {
      const res = await fetch(
        `/api/whatsapp-settings?templateKey=${encodeURIComponent(t.originalKey)}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Failed to delete template');
        return;
      }
      setTemplates(mapRows((data.rows || []) as WhatsAppTemplateSetting[]));
      setSaved('Template deleted');
      setTimeout(() => setSaved(''), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingUid(null);
    }
  };

  const uploadImage = async (t: EditableTemplate, file: File) => {
    setUploadingUid(t.uid);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('templateKey', t.templateKey || t.originalKey || 'shared');
      const res = await fetch('/api/whatsapp-settings/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.url) {
        setError(data.error || 'Image upload failed');
        return;
      }
      setTemplates((prev) =>
        prev.map((x) => (x.uid === t.uid ? { ...x, headerImageUrl: data.url } : x)),
      );
      setSaved(`Image uploaded for ${t.label || t.templateKey} — click Save templates to persist`);
      setTimeout(() => setSaved(''), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingUid(null);
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

  const templateKeyOptions = templates.map((t) => t.originalKey || t.templateKey).filter(Boolean);

  return (
    <AppShell>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 0.5 }}>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create and edit WhatsApp templates, rename keys, set Meta template names, and manage
          header images — all from here.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
        Sends go through CRM → Pinnacle. CRM webhook: {crmUrl}. The <strong>Pinnacle / Meta template
        name</strong> must match an approved template in Meta Business Manager. Header images must
        be public <code>https://</code> JPG/PNG URLs.
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
              Add new templates, rename keys, change Meta names, and upload header images.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
            >
              New template
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={
                savingTemplates ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />
              }
              disabled={savingTemplates}
              onClick={() => void saveTemplates()}
            >
              Save templates
            </Button>
          </Stack>
        </Stack>

        <Stack spacing={2.5} sx={{ p: 2.5 }}>
          {templates.map((t) => (
            <Box
              key={t.uid}
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
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography fontWeight={700}>{t.label || 'Untitled'}</Typography>
                      <Chip size="small" label={t.templateKey || '—'} variant="outlined" />
                      {t.originalKey && t.originalKey !== slugPreview(t.templateKey) && (
                        <Chip size="small" color="warning" label={`was ${t.originalKey}`} />
                      )}
                    </Stack>
                    <Tooltip title="Delete template">
                      <IconButton
                        size="small"
                        color="error"
                        disabled={deletingUid === t.uid}
                        onClick={() => void deleteTemplate(t)}
                      >
                        {deletingUid === t.uid ? (
                          <CircularProgress size={16} />
                        ) : (
                          <DeleteOutlineIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      size="small"
                      label="Display label"
                      value={t.label}
                      onChange={(e) =>
                        setTemplates((prev) =>
                          prev.map((x) => (x.uid === t.uid ? { ...x, label: e.target.value } : x)),
                        )
                      }
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="Internal key"
                      value={t.templateKey}
                      onChange={(e) =>
                        setTemplates((prev) =>
                          prev.map((x) =>
                            x.uid === t.uid ? { ...x, templateKey: slugPreview(e.target.value) } : x,
                          ),
                        )
                      }
                      fullWidth
                      helperText="Used by milestone rules & send picker (a-z, 0-9, _)"
                    />
                  </Stack>
                  <TextField
                    size="small"
                    label="Pinnacle / Meta template name"
                    value={t.pinnacleTemplateName}
                    onChange={(e) =>
                      setTemplates((prev) =>
                        prev.map((x) =>
                          x.uid === t.uid ? { ...x, pinnacleTemplateName: e.target.value } : x,
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
                          x.uid === t.uid ? { ...x, headerImageUrl: e.target.value } : x,
                        ),
                      )
                    }
                    fullWidth
                    placeholder="https://…"
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <input
                      ref={(el) => {
                        fileInputs.current[t.uid] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void uploadImage(t, file);
                      }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={
                        uploadingUid === t.uid ? <CircularProgress size={14} /> : <UploadIcon />
                      }
                      disabled={uploadingUid === t.uid}
                      onClick={() => fileInputs.current[t.uid]?.click()}
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
              Pick any WhatsApp template key from the list above for each milestone.
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
                          setRows(
                            rows.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <TextField
                        select
                        size="small"
                        value={
                          templateKeyOptions.includes(r.templateKey)
                            ? r.templateKey
                            : r.templateKey
                        }
                        onChange={(e) =>
                          setRows(
                            rows.map((x) =>
                              x.id === r.id ? { ...x, templateKey: e.target.value } : x,
                            ),
                          )
                        }
                        fullWidth
                      >
                        {!templateKeyOptions.includes(r.templateKey) && r.templateKey && (
                          <MenuItem value={r.templateKey}>{r.templateKey} (missing)</MenuItem>
                        )}
                        {templateKeyOptions.map((key) => (
                          <MenuItem key={key} value={key}>
                            {key}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={r.enabled}
                        onChange={(e) =>
                          setRows(
                            rows.map((x) =>
                              x.id === r.id ? { ...x, enabled: e.target.checked } : x,
                            ),
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

      <Dialog open={addOpen} onClose={() => !creating && setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>New WhatsApp template</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Display label"
              value={newForm.label}
              onChange={(e) => {
                const label = e.target.value;
                setNewForm((f) => ({
                  ...f,
                  label,
                  templateKey: f.templateKey || slugPreview(label),
                }));
              }}
              fullWidth
              autoFocus
              placeholder="e.g. 3-month checkup"
            />
            <TextField
              label="Internal key"
              value={newForm.templateKey}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, templateKey: slugPreview(e.target.value) }))
              }
              fullWidth
              helperText={`Will save as: ${slugPreview(newForm.templateKey || newForm.label) || '—'}`}
            />
            <TextField
              label="Pinnacle / Meta template name"
              value={newForm.pinnacleTemplateName}
              onChange={(e) => setNewForm((f) => ({ ...f, pinnacleTemplateName: e.target.value }))}
              fullWidth
              required
              placeholder="exact_name_from_meta"
            />
            <TextField
              label="Header image URL (optional)"
              value={newForm.headerImageUrl}
              onChange={(e) => setNewForm((f) => ({ ...f, headerImageUrl: e.target.value }))}
              fullWidth
              placeholder="https://…"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={creating ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
            disabled={creating}
            onClick={() => void createTemplate()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
