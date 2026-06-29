import { NextResponse } from 'next/server';
import { getTodayStats } from '@/lib/milestones';
import { getAnniversaryDashboard } from '@/lib/anniversaryAnalytics';

/** Authenticated dashboard stats (session cookie). */
export async function GET() {
  const [stats, anniversary] = await Promise.all([getTodayStats(), getAnniversaryDashboard()]);
  return NextResponse.json({ ok: true, ...stats, anniversary });
}
