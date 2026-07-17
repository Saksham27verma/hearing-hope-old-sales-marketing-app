'use client';

import React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ThemeProvider, createTheme, CssBaseline, alpha } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0d7377',
      light: '#14919b',
      dark: '#0a5c5f',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#c45c26',
      light: '#e07a45',
      dark: '#9a4519',
      contrastText: '#ffffff',
    },
    success: { main: '#1b7a4e' },
    warning: { main: '#c47d1a' },
    error: { main: '#c0392b' },
    background: {
      default: '#f3f6f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a2b2c',
      secondary: '#5a6f70',
    },
    divider: alpha('#0d7377', 0.12),
  },
  typography: {
    fontFamily: 'var(--font-body), "Segoe UI", sans-serif',
    h4: {
      fontFamily: 'var(--font-display), Georgia, serif',
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontFamily: 'var(--font-display), Georgia, serif',
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    h6: {
      fontFamily: 'var(--font-display), Georgia, serif',
      fontWeight: 600,
    },
    subtitle1: { fontWeight: 600 },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.01em',
    },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            'radial-gradient(ellipse 80% 50% at 0% -10%, rgba(13, 115, 119, 0.08), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(196, 92, 38, 0.05), transparent)',
          backgroundAttachment: 'fixed',
          minHeight: '100vh',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        contained: {
          '&:hover': { transform: 'translateY(-1px)' },
          transition: 'transform 0.15s ease, background-color 0.15s ease',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid',
          borderColor: alpha('#0d7377', 0.1),
          boxShadow: '0 2px 12px rgba(26, 43, 44, 0.05)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        outlined: {
          borderColor: alpha('#0d7377', 0.12),
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 700,
            color: '#5a6f70',
            backgroundColor: alpha('#0d7377', 0.04),
            borderBottom: `1px solid ${alpha('#0d7377', 0.1)}`,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: alpha('#0d7377', 0.03),
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16 },
      },
    },
  },
});

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
