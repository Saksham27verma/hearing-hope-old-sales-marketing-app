import { NextResponse } from 'next/server';
import { runDailyMilestones } from '@/lib/milestones';

export async function GET() {
  const result = await runDailyMilestones();
  return NextResponse.json({ ok: true, ...result });
}
