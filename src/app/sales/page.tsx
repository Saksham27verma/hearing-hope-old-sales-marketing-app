'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import WhatsAppSendDialog from '@/components/WhatsAppSendDialog';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
  Tooltip,
  InputAdornment,
  alpha,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import Link from 'next/link';
import type { LegacySale } from '@/db/schema';
import { COHORT_LABELS, isCohortKey } from '@/lib/cohortFilter';
import { formatSaleDateDisplay } from '@/lib/dates';
import { formatPhoneDisplay, telHref } from '@/lib/phone';

function SalesPageInner() {
  const params = useSearchParams();
  const highlight = params.get('highlight');
  const cohortParam = params.get('cohort');
  const cohort = isCohortKey(cohortParam) ? cohortParam : null;
  const [rows, setRows] = useState<LegacySale[]>([]);
  const [cohortLabel, setCohortLabel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LegacySale | null>(null);
  const [waSale, setWaSale] = useState<LegacySale | null>(null);
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    reference: '',
    address: '',
    saleDate: '',
    notes: '',
    status: 'active',
  });
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = async () => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (cohort) qs.set('cohort', cohort);
    const res = await fetch(`/api/sales?${qs.toString()}`);
    const data = await res.json();
    setRows(data.rows || []);
    setCohortLabel(data.cohortLabel || (cohort ? COHORT_LABELS[cohort] : null));
  };

  useEffect(() => {
    void load();
  }, [q, cohort]);

  const openNew = () => {
    setEditing(null);
    setForm({ customerName: '', phone: '', reference: '', address: '', saleDate: '', notes: '', status: 'active' });
    setOpen(true);
  };

  const openEdit = (row: LegacySale) => {
    setEditing(row);
    setForm({
      customerName: row.customerName,
      phone: row.phone,
      reference: row.reference || '',
      address: row.address || '',
      saleDate: row.saleDate,
      notes: row.notes || '',
      status: row.status,
    });
    setOpen(true);
  };

  const save = async () => {
    const url = editing ? `/api/sales/${editing.id}` : '/api/sales';
    const method = editing ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ text: data.error || 'Save failed', ok: false });
      return;
    }
    setOpen(false);
    setMsg(null);
    void load();
  };

  const statusChip = (s: string) => {
    const color =
      s === 'active' ? 'success' : s === 'do_not_contact' ? 'error' : s === 'serviced' ? 'primary' : 'default';
    return <Chip size="small" label={s.replace(/_/g, ' ')} color={color} variant="outlined" />;
  };

  return (
    <AppShell>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Typography variant="h5" gutterBottom sx={{ mb: 0.5 }}>
            Legacy Sales
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Search customers, call, or WhatsApp with a selected template.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          Add sale
        </Button>
      </Stack>

      {msg && (
        <Alert severity={msg.ok ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {cohortLabel && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <Chip label={cohortLabel} color="primary" />
          <Typography variant="body2" color="text.secondary">
            {rows.length} customer{rows.length === 1 ? '' : 's'}
          </Typography>
          <Button size="small" component={Link} href="/sales">
            Clear filter
          </Button>
        </Stack>
      )}

      <TextField
        fullWidth
        size="small"
        placeholder="Search name, phone, reference…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
      />

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Sale date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                hover
                sx={
                  highlight === row.id
                    ? { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) }
                    : undefined
                }
              >
                <TableCell sx={{ fontWeight: 600 }}>{row.customerName}</TableCell>
                <TableCell>{formatPhoneDisplay(row.phone)}</TableCell>
                <TableCell>{row.reference || '—'}</TableCell>
                <TableCell>{formatSaleDateDisplay(row.saleDate)}</TableCell>
                <TableCell>{statusChip(row.status)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Call">
                    <IconButton component="a" href={telHref(row.phone)} size="small" color="primary">
                      <PhoneIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="WhatsApp — choose template">
                    <IconButton size="small" color="success" onClick={() => setWaSale(row)}>
                      <WhatsAppIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(row)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">No sales found.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editing ? 'Edit sale' : 'Add sale'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Customer name"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              fullWidth
            />
            <TextField
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              fullWidth
            />
            <TextField
              label="Reference"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              fullWidth
            />
            <TextField
              label="Sale date (YYYY-MM-DD)"
              value={form.saleDate}
              onChange={(e) => setForm({ ...form, saleDate: e.target.value })}
              fullWidth
            />
            <TextField
              label="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              fullWidth
              multiline
            />
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              fullWidth
            />
            {editing && (
              <TextField
                select
                label="Status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                fullWidth
              >
                <MenuItem value="active">active</MenuItem>
                <MenuItem value="contacted">contacted</MenuItem>
                <MenuItem value="serviced">serviced</MenuItem>
                <MenuItem value="do_not_contact">do_not_contact</MenuItem>
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void save()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <WhatsAppSendDialog
        open={Boolean(waSale)}
        sale={waSale}
        onClose={() => setWaSale(null)}
        onSent={(ok, text) => setMsg({ text, ok })}
      />
    </AppShell>
  );
}

export default function SalesPage() {
  return (
    <Suspense>
      <SalesPageInner />
    </Suspense>
  );
}
