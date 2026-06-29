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
} from '@mui/material';
import Link from 'next/link';
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

  return (
    <AppShell>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Dashboard
      </Typography>
      {stats?.today && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Today (IST): {stats.today}
          {stats.currentMonthLabel ? ` · Current month: ${stats.currentMonthLabel}` : ''}
        </Typography>
      )}

      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 2,
              mb: 3,
            }}
          >
            {[
              { label: 'Due today (milestones)', value: stats?.dueToday ?? 0 },
              { label: '1yr anniversary today', value: ann?.anniversaryToday.oneYear.count ?? 0 },
              { label: `${ann?.sameMonthCohort.oneYearBack.label ?? 'Same month'} (1yr back)`, value: ann?.sameMonthCohort.oneYearBack.count ?? 0 },
              { label: 'Total sales', value: stats?.totalSales ?? 0 },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">
                    {c.label}
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {c.value}
                  </Typography>
                </CardContent>
              </Card>
            ))}
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
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Milestone rules due today
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {Object.entries(stats.dueByMilestone).map(([k, v]) => (
                  <Chip key={k} label={`${k}: ${v}`} color="primary" variant="outlined" />
                ))}
              </Stack>
              <Button component={Link} href="/whatsapp/bulk" variant="contained" sx={{ mt: 2 }}>
                Message all due today
              </Button>
            </Box>
          )}
        </>
      )}

      <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
        Recent notifications
      </Typography>
      <List>
        {notifications.slice(0, 15).map((n) => (
          <ListItem
            key={n.id}
            secondaryAction={
              <Button size="small" component={Link} href={`/sales?highlight=${n.saleId}`}>
                View
              </Button>
            }
          >
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>{n.title}</span>
                  <Chip size="small" label={n.status} color={statusColor(n.status)} />
                </Stack>
              }
              secondary={n.message}
            />
          </ListItem>
        ))}
        {notifications.length === 0 && !loading && (
          <Typography color="text.secondary">No notifications yet.</Typography>
        )}
      </List>
    </AppShell>
  );
}
