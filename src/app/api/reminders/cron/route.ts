import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runDueRemindersBatch } from '@/lib/intake-service';

function isAuthorizedCron(authHeader: string | null, secret: string): boolean {
  const provided = Buffer.from(authHeader || '', 'utf8');
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

async function handleCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && !isAuthorizedCron(auth, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = new URL(req.url).origin;
  const result = await runDueRemindersBatch(origin);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: Request) {
  return handleCron(req);
}

export async function GET(req: Request) {
  return handleCron(req);
}
