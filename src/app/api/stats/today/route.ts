import { NextResponse } from 'next/server';
import { getTodayStats } from '@/lib/milestones';

export async function GET(req: Request) {
  const secret = process.env.CRM_WEBHOOK_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  const stats = await getTodayStats();
  return NextResponse.json({ ok: true, ...stats });
}
