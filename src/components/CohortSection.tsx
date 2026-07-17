'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PhoneIcon from '@mui/icons-material/Phone';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import type { CohortBucket } from '@/lib/anniversaryAnalytics';
import { telHref } from '@/lib/phone';
import WhatsAppSendDialog from '@/components/WhatsAppSendDialog';

function CohortPanel({ bucket, filterKey }: { bucket: CohortBucket; filterKey: string }) {
  const [open, setOpen] = useState(bucket.count > 0 && bucket.count <= 15);
  const [waRow, setWaRow] = useState<(typeof bucket.rows)[0] | null>(null);

  return (
    <Card variant="outlined" sx={{ mb: 2, borderRadius: 3 }}>
      <CardContent sx={{ pb: open ? 1 : 2 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle1" fontWeight={700}>
                {bucket.label}
              </Typography>
              <Chip label={bucket.count} color={bucket.count > 0 ? 'primary' : 'default'} size="small" />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {bucket.description}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {bucket.count > 0 && (
              <Button
                size="small"
                component={Link}
                href={`/sales?cohort=${encodeURIComponent(filterKey)}`}
              >
                View all
              </Button>
            )}
            <IconButton
              size="small"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              disabled={bucket.count === 0}
            >
              <ExpandMoreIcon
                sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }}
              />
            </IconButton>
          </Stack>
        </Stack>
        <Collapse in={open}>
          {bucket.count === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              No customers in this group.
            </Typography>
          ) : (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ mt: 2, maxHeight: 360, borderRadius: 2 }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell>Sale date</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bucket.rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{row.customerName}</TableCell>
                      <TableCell>{row.phoneDisplay}</TableCell>
                      <TableCell>{row.reference || '—'}</TableCell>
                      <TableCell>{row.saleDateDisplay}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Call">
                          <IconButton
                            size="small"
                            component="a"
                            href={telHref(row.phone)}
                            aria-label="Call"
                            color="primary"
                          >
                            <PhoneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="WhatsApp — choose template">
                          <IconButton size="small" color="success" onClick={() => setWaRow(row)}>
                            <WhatsAppIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Button size="small" component={Link} href={`/sales?highlight=${row.id}`}>
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {bucket.count > bucket.rows.length && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Showing first {bucket.rows.length} of {bucket.count}. Use View all for the full list.
            </Typography>
          )}
        </Collapse>
      </CardContent>

      <WhatsAppSendDialog
        open={Boolean(waRow)}
        sale={
          waRow
            ? {
                id: waRow.id,
                customerName: waRow.customerName,
                phone: waRow.phone,
                reference: waRow.reference,
                saleDate: waRow.saleDate,
              }
            : null
        }
        onClose={() => setWaRow(null)}
      />
    </Card>
  );
}

export default function CohortSection({
  title,
  subtitle,
  buckets,
}: {
  title: string;
  subtitle: string;
  buckets: Array<{ key: string; bucket: CohortBucket }>;
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {subtitle}
      </Typography>
      {buckets.map(({ key, bucket }) => (
        <CohortPanel key={key} bucket={bucket} filterKey={key} />
      ))}
    </Box>
  );
}
