import { NextResponse } from 'next/server';
import {
  dispatchReminderForRequest,
  getRecentOutbox,
  runDueRemindersBatch,
} from '@/lib/intake-service';
import { ensureSeeded } from '@/lib/seed';

export async function GET() {
  await ensureSeeded();
  const outbox = await getRecentOutbox(40);
  return NextResponse.json({ outbox });
}

export async function POST(req: Request) {
  await ensureSeeded();
  let body: { requestId?: string; ruleId?: string; customBody?: string } = {};
  try {
    body = (await req.json()) as { requestId?: string; ruleId?: string; customBody?: string };
  } catch {
    body = {};
  }

  const origin = new URL(req.url).origin;

  if (body.requestId) {
    try {
      const result = await dispatchReminderForRequest({
        requestId: body.requestId,
        ruleId: body.ruleId,
        customBody: body.customBody,
        originUrl: origin,
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Reminder dispatch failed' },
        { status: 404 },
      );
    }
  }

  const batch = await runDueRemindersBatch(origin);
  const outbox = await getRecentOutbox(40);
  return NextResponse.json({ ok: true, ...batch, outbox });
}
