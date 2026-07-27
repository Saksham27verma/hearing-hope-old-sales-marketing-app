'use client';

import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  Suspense,
  startTransition,
} from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import WhatsAppSendDialog from '@/components/WhatsAppSendDialog';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
  TablePagination,
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
import ClearIcon from '@mui/icons-material/Clear';
import Link from 'next/link';
import type { LegacySale } from '@/db/schema';
import { COHORT_LABELS, isCohortKey } from '@/lib/cohortFilter';
import { formatSaleDateDisplay } from '@/lib/dates';
import { formatPhoneDisplay, telHref } from '@/lib/phone';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

type IndexedSale = LegacySale & {
  _name: string;
  _phone: string;
  _ref: string;
};

function indexSales(rows: LegacySale[]): IndexedSale[] {
  return rows.map((row) => ({
    ...row,
    _name: row.customerName.toLowerCase(),
    _phone: row.phone.replace(/\D/g, ''),
    _ref: (row.reference || '').toLowerCase(),
  }));
}

function matchesSaleSearch(row: IndexedSale, needle: string, digits: string): boolean {
  if (!needle) return true;
  if (row._name.includes(needle) || row._ref.includes(needle)) return true;
  if (digits && row._phone.includes(digits)) return true;
  return row.phone.includes(needle);
}

const SaleRow = memo(function SaleRow({
  row,
  highlight,
  onWhatsApp,
  onEdit,
}: {
  row: IndexedSale;
  highlight: boolean;
  onWhatsApp: (row: IndexedSale) => void;
  onEdit: (row: IndexedSale) => void;
}) {
  return (
    <TableRow
      hover
      sx={highlight ? { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) } : undefined}
    >
      <TableCell sx={{ fontWeight: 600 }}>{row.customerName}</TableCell>
      <TableCell>{formatPhoneDisplay(row.phone)}</TableCell>
      <TableCell>{row.reference || '—'}</TableCell>
      <TableCell>{formatSaleDateDisplay(row.saleDate)}</TableCell>
      <TableCell>
        <Chip
          size="small"
          label={row.status.replace(/_/g, ' ')}
          color={
            row.status === 'active'
              ? 'success'
              : row.status === 'do_not_contact'
                ? 'error'
                : row.status === 'serviced'
                  ? 'primary'
                  : 'default'
          }
          variant="outlined"
        />
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Call">
          <IconButton component="a" href={telHref(row.phone)} size="small" color="primary">
            <PhoneIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="WhatsApp — choose template">
          <IconButton size="small" color="success" onClick={() => onWhatsApp(row)}>
            <WhatsAppIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(row)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
});

function SalesPageInner() {
  const params = useSearchParams();
  const highlight = params.get('highlight');
  const cohortParam = params.get('cohort');
  const cohort = isCohortKey(cohortParam) ? cohortParam : null;
  const [allRows, setAllRows] = useState<IndexedSale[]>([]);
  const [cohortLabel, setCohortLabel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [loading, setLoading] = useState(true);
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

  // Load once per cohort — search filters locally so typing stays instant.
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (cohort) qs.set('cohort', cohort);
        const res = await fetch(`/api/sales?${qs.toString()}`, { signal });
        const data = await res.json();
        if (signal?.aborted) return;
        setAllRows(indexSales(data.rows || []));
        setCohortLabel(data.cohortLabel || (cohort ? COHORT_LABELS[cohort] : null));
        setPage(0);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setMsg({ text: 'Failed to load sales', ok: false });
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [cohort],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const filteredRows = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    if (!needle) return allRows;
    const digits = needle.replace(/\D/g, '');
    return allRows.filter((row) => matchesSaleSearch(row, needle, digits));
  }, [allRows, deferredQ]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage) || 1);
  const safePage = Math.min(page, pageCount - 1);
  const rows = useMemo(() => {
    const start = safePage * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, safePage, rowsPerPage]);

  const onSearchChange = useCallback((value: string) => {
    setQ(value);
    startTransition(() => setPage(0));
  }, []);

  const onWhatsApp = useCallback((row: IndexedSale) => setWaSale(row), []);
  const onEdit = useCallback((row: IndexedSale) => {
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
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ customerName: '', phone: '', reference: '', address: '', saleDate: '', notes: '', status: 'active' });
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

  const searching = q.trim().length > 0;
  const filterPending = searching && q !== deferredQ;

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
            {filteredRows.length} customer{filteredRows.length === 1 ? '' : 's'}
            {searching ? ` matching “${q.trim()}”` : ''}
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
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {loading || filterPending ? (
                <CircularProgress size={16} sx={{ mr: q.trim() ? 1 : 0 }} />
              ) : null}
              {q.trim() ? (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    {filteredRows.length} result{filteredRows.length === 1 ? '' : 's'}
                  </Typography>
                  <IconButton size="small" aria-label="Clear search" onClick={() => onSearchChange('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ) : null}
            </InputAdornment>
          ),
        }}
      />

      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden',
          opacity: filterPending ? 0.72 : 1,
          transition: 'opacity 120ms ease',
        }}
      >
        <TableContainer>
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
                <SaleRow
                  key={row.id}
                  row={row}
                  highlight={highlight === row.id}
                  onWhatsApp={onWhatsApp}
                  onEdit={onEdit}
                />
              ))}
              {!loading && filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      {searching ? 'No sales match your search.' : 'No sales found.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {loading && filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredRows.length}
          page={safePage}
          onPageChange={(_, next) => setPage(next)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[...PAGE_SIZE_OPTIONS]}
        />
      </Paper>

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
