'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import UploadIcon from '@mui/icons-material/Upload';
import SettingsIcon from '@mui/icons-material/Settings';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import HearingIcon from '@mui/icons-material/Hearing';

const DRAWER_WIDTH = 260;

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { href: '/sales', label: 'Sales', icon: <PeopleIcon /> },
  { href: '/sales/import', label: 'Import CSV', icon: <UploadIcon /> },
  { href: '/whatsapp/bulk', label: 'Bulk WhatsApp', icon: <WhatsAppIcon /> },
  { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const drawer = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: `linear-gradient(180deg, ${alpha('#0d7377', 0.06)} 0%, transparent 40%)`,
      }}
    >
      <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            mb: 0.5,
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              boxShadow: `0 4px 12px ${alpha('#0d7377', 0.35)}`,
            }}
          >
            <HearingIcon fontSize="small" />
          </Box>
          <Box>
            <Typography
              sx={{
                fontFamily: 'var(--font-display), Georgia, serif',
                fontWeight: 700,
                fontSize: '1.05rem',
                lineHeight: 1.2,
                color: 'text.primary',
              }}
            >
              Hearing Hope
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              Customer Lifecycle
            </Typography>
          </Box>
        </Box>
      </Box>

      <List sx={{ px: 1.5, flex: 1 }}>
        {NAV.map((item) => {
          const selected =
            item.href === '/sales'
              ? pathname === '/sales'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={selected}
              onClick={() => setMobileOpen(false)}
              sx={{
                mb: 0.5,
                borderRadius: 2,
                py: 1.1,
                '&.Mui-selected': {
                  bgcolor: alpha('#0d7377', 0.12),
                  color: 'primary.dark',
                  '& .MuiListItemIcon-root': { color: 'primary.main' },
                  '&:hover': { bgcolor: alpha('#0d7377', 0.16) },
                },
                '&:hover': { bgcolor: alpha('#0d7377', 0.06) },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: selected ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: selected ? 700 : 500, fontSize: '0.925rem' }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          startIcon={<LogoutIcon />}
          onClick={() => void logout()}
          sx={{
            borderColor: alpha('#0d7377', 0.2),
            color: 'text.secondary',
            '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
          }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: alpha('#ffffff', 0.82),
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Menu">
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            sx={{
              flexGrow: 1,
              fontFamily: 'var(--font-display), Georgia, serif',
              fontWeight: 600,
              fontSize: { xs: '1.05rem', sm: '1.2rem' },
            }}
          >
            {NAV.find((n) => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))
              ?.label || 'Lifecycle'}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: { xs: 'none', sm: 'inline' },
              color: 'text.secondary',
              fontWeight: 600,
              px: 1.5,
              py: 0.5,
              borderRadius: 999,
              bgcolor: alpha('#0d7377', 0.08),
            }}
          >
            Post-sale care
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            open
            sx={{
              [`& .MuiDrawer-paper`]: {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                borderRight: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              },
            }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          mt: '64px',
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          maxWidth: 1280,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
