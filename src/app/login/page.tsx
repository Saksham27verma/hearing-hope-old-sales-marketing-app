'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Button, Paper, TextField, Typography, Alert, alpha } from '@mui/material';
import HearingIcon from '@mui/icons-material/Hearing';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError('Invalid password');
      return;
    }
    router.push(params.get('next') || '/dashboard');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        backgroundImage:
          'radial-gradient(ellipse 70% 50% at 20% 10%, rgba(13, 115, 119, 0.14), transparent), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(196, 92, 38, 0.1), transparent), linear-gradient(160deg, #f3f6f5 0%, #e8f0ef 100%)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          maxWidth: 420,
          width: '100%',
          borderRadius: 3,
          border: '1px solid',
          borderColor: alpha('#0d7377', 0.12),
          boxShadow: `0 16px 48px ${alpha('#0d7377', 0.12)}`,
        }}
      >
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            mb: 2,
            boxShadow: `0 6px 16px ${alpha('#0d7377', 0.35)}`,
          }}
        >
          <HearingIcon />
        </Box>
        <Typography
          variant="h5"
          sx={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontWeight: 700,
            mb: 0.5,
          }}
        >
          Hearing Hope
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Customer Lifecycle — post-sale marketing
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}
        <form onSubmit={submit}>
          <TextField
            fullWidth
            type="password"
            label="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 2 }}
            autoFocus
          />
          <Button fullWidth variant="contained" type="submit" size="large" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
