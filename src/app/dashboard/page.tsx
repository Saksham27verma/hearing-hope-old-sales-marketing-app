'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import CohortSection from '@/components/CohortSection';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  List,
  ListItem,
  ListItemText,
  Button,
  Stack,
  CircularProgress,
  Paper,
  alpha,
} from '@mui/material';
import Link from 'next/link';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CakeIcon from '@mui/icons-material/Cake';
import GroupsIcon from '@mui/icons-material/Groups';
import InventoryIcon from '@mui/icons-material/Inventory2';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import type { LifecycleNotification } from '@/db/schema';
import type { AnniversaryDashboard } from '@/lib/anniversaryAnalytics';

type Stats = {
  dueToday: number;
  dueByMilestone: Record<string, number>;
  upcoming7: number;
  whatsappSentToday: number;
  totalSales: number;
  today?: string;
  currentMonthLabel?: string;
  anniversary?: AnniversaryDashboard;
};

const STAT_ICONS = [EventAvailableIcon, CakeIcon, GroupsIcon, InventoryIcon];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [notifications, setNotifications] = useState<LifecycleNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [s, n] = await Promise.all([fetch('/api/stats/dashboard'), fetch('/api/notifications')]);
    if (s.ok) setStats(await s.json());
    if (n.ok) {
      const data = await n.json();
      setNotifications(data.rows || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const ann = stats?.anniversary;

  const statusColor = (s: string): 'default' | 'success' | 'warning' | 'error' => {
    if (s === 'whatsapp_sent' || s === 'done') return 'success';
    if (s === 'whatsapp_failed') return 'error';
    if (s === 'crm_notified') return 'warning';
    return 'default';
  };

  const cards = [
    { label: 'Due today (milestones)', value: stats?.dueToday ?? 0, accent: '#0d7377' },
    { label: '1yr anniversary today', value: ann?.anniversaryToday.oneYear.count ?? 0, accent: '#c45c26' },
    {
      label: `${ann?.sameMonthCohort.oneYearBack.label ?? 'Same month'} (1yr back)`,
      value: ann?.sameMonthCohort.oneYearBack.count ?? 0,
      accent: '#1b7a4e',
    },
    { label: 'Total sales', value: stats?.totalSales ?? 0, accent: '#3d5a80' },
  ];

  return (
    <AppShell>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 0.5 }}>
          Dashboard
        </Typography>
        {stats?.today && (
          <Typography variant="body2" color="text.secondary">
            Today (IST): {stats.today}
            {stats.currentMonthLabel ? ` · Current month: ${stats.currentMonthLabel}` : ''}
          </Typography>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 2,
              mb: 3.5,
            }}
          >
            {cards.map((c, i) => {
              const Icon = STAT_ICONS[i];
              return (
                <Card
                  key={c.label}
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 8px 24px ${alpha(c.accent, 0.15)}`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      bgcolor: c.accent,
                    }}
                  />
                  <CardContent sx={{ pt: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography color="text.secondary" variant="body2" sx={{ mb: 0.75, fontWeight: 500 }}>
                          {c.label}
                        </Typography>
                        <Typography variant="h4" fontWeight={700} sx={{ color: c.accent }}>
                          {c.value}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: alpha(c.accent, 0.1),
                          color: c.accent,
                        }}
                      >
                        <Icon fontSize="small" />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Box>

          {ann && (
            <>
              <CohortSection
                title="Anniversary today"
                subtitle="Customers who bought on this exact date 1, 2, or 3 years ago (IST). Ideal for service calls and upgrade offers."
                buckets={[
                  { key: 'anniversary_1y', bucket: ann.anniversaryToday.oneYear },
                  { key: 'anniversary_2y', bucket: ann.anniversaryToday.twoYear },
                  { key: 'anniversary_3y', bucket: ann.anniversaryToday.threeYear },
                ]}
              />

              <CohortSection
                title={`Same month cohort — ${ann.currentMonthLabel}`}
                subtitle={`Everyone who purchased in ${ann.currentMonthLabel.split(' ')[0]} during prior years. Use for monthly marketing campaigns.`}
                buckets={[
                  { key: 'month_1y', bucket: ann.sameMonthCohort.oneYearBack },
                  { key: 'month_2y', bucket: ann.sameMonthCohort.twoYearBack },
                  { key: 'month_3y', bucket: ann.sameMonthCohort.threeYearBack },
                ]}
              />
            </>
          )}

          {stats?.dueByMilestone && Object.keys(stats.dueByMilestone).length > 0 && (
            <Paper
              elevation={0}
              sx={{
                mb: 3,
                p: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
              }}
            >
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Milestone rules due today
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                {Object.entries(stats.dueByMilestone).map(([k, v]) => (
                  <Chip key={k} label={`${k}: ${v}`} color="primary" variant="outlined" />
                ))}
              </Stack>
              <Button
                component={Link}
                href="/whatsapp/bulk"
                variant="contained"
                color="success"
                startIcon={<WhatsAppIcon />}
              >
                Message all due today
              </Button>
            </Paper>
          )}
        </>
      )}

      <Paper
        elevation={0}
        sx={{
          mt: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ px: 2.5, pt: 2.5, pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Recent notifications
          </Typography>
        </Box>
        <List disablePadding>
          {notifications.slice(0, 15).map((n, idx) => (
            <ListItem
              key={n.id}
              divider={idx < Math.min(notifications.length, 15) - 1}
              secondaryAction={
                <Button size="small" component={Link} href={`/sales?highlight=${n.saleId}`}>
                  View
                </Button>
              }
              sx={{ px: 2.5, py: 1.5 }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography component="span" fontWeight={600}>
                      {n.title}
                    </Typography>
                    <Chip size="small" label={n.status.replace(/_/g, ' ')} color={statusColor(n.status)} />
                  </Stack>
                }
                secondary={n.message}
              />
            </ListItem>
          ))}
          {notifications.length === 0 && !loading && (
            <Box sx={{ px: 2.5, py: 4 }}>
              <Typography color="text.secondary">No notifications yet.</Typography>
            </Box>
          )}
        </List>
      </Paper>
    </AppShell>
  );
}
