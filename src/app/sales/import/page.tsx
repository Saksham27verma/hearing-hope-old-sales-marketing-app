'use client';

import React, { useState } from 'react';
import AppShell from '@/components/AppShell';
import { Box, Button, Paper, Typography, Alert, LinearProgress } from '@mui/material';

export default function ImportPage() {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<{
    imported?: number;
    skipped?: number;
    errors?: string[];
    error?: string;
    ok?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ''));
    reader.readAsText(f);
  };

  const importCsv = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/sales/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, dedupe: true }),
      });
      const text = await res.text();
      let data: { ok?: boolean; error?: string; imported?: number; skipped?: number; errors?: string[] } = {};
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        data = { ok: false, error: text || res.statusText || 'Import failed' };
      }
      if (!res.ok || data.ok === false) {
        setResult({
          ok: false,
          error: data.error || `Import failed (${res.status})`,
          imported: data.imported ?? 0,
          skipped: data.skipped ?? 0,
          errors: data.errors,
        });
        return;
      }
      setResult(data);
    } catch (e) {
      setResult({
        ok: false,
        error: e instanceof Error ? e.message : 'Import failed',
        imported: 0,
        skipped: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Import CSV
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Headers: customerName, phone, reference, saleDate, address, centerId, notes
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Button variant="outlined" component="label">
          Choose CSV file
          <input type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        </Button>
        {csv && (
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            {csv.split('\n').length - 1} data rows loaded
          </Typography>
        )}
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" disabled={!csv || loading} onClick={() => void importCsv()}>
            Import
          </Button>
        </Box>
        {loading && <LinearProgress sx={{ mt: 2 }} />}
        {result && (
          <Alert
            severity={result.error || (result.errors?.length && !result.imported) ? 'error' : result.errors?.length ? 'warning' : 'success'}
            sx={{ mt: 2 }}
          >
            {result.error ? (
              result.error
            ) : (
              <>
                Imported: {result.imported} · Skipped: {result.skipped}
              </>
            )}
            {result.errors?.length ? (
              <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                {result.errors.slice(0, 10).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </Box>
            ) : null}
          </Alert>
        )}
      </Paper>
    </AppShell>
  );
}
