import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recomputeRequestStatus } from '@/lib/intake-service';
import { ensureSeeded } from '@/lib/seed';
import {
  appendMessage,
  deleteRequest,
  getFirmBranding,
  getMessages,
  getRequest,
  saveRequest,
} from '@/lib/storage';

const PatchRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('override_item'),
    itemId: z.string(),
    decision: z.enum(['approve', 'request_reshoot']),
    note: z.string().max(400).optional(),
  }),
  z.object({
    action: z.literal('send_message'),
    body: z.string().min(1).max(1000),
    channel: z.enum(['whatsapp', 'sms', 'portal']).optional(),
  }),
]);

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureSeeded();
  const { id } = await context.params;
  const [request, messages, firm] = await Promise.all([
    getRequest(id),
    getMessages(id),
    getFirmBranding(),
  ]);

  if (!request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  return NextResponse.json({ request, messages, firm });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureSeeded();
  const { id } = await context.params;
  const existing = await getRequest(id);
  if (!existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = PatchRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const now = new Date().toISOString();
  const firm = await getFirmBranding();

  if (data.action === 'send_message') {
    const channel = data.channel ?? (existing.preferredChannel === 'sms' ? 'sms' : 'whatsapp');
    const messages = await appendMessage(existing.id, {
      id: `msg_${crypto.randomBytes(5).toString('hex')}`,
      direction: 'outbound',
      channel,
      senderLabel: firm?.senderName || firm?.firmName || 'Firm Staff',
      body: data.body,
      createdAt: now,
    });
    return NextResponse.json({ request: existing, messages });
  }

  const target = existing.items.find((it) => it.id === data.itemId);
  if (!target) {
    return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
  }

  const updatedItems = existing.items.map((it) => {
    if (it.id !== data.itemId) return it;
    if (data.decision === 'approve') {
      return {
        ...it,
        status: 'approved_override' as const,
        latestVerification: it.latestVerification
          ? {
              ...it.latestVerification,
              passed: true,
              status: 'verified' as const,
              headline: 'Manually approved by firm staff',
              detail: data.note || it.latestVerification.detail,
            }
          : null,
      };
    }
    return {
      ...it,
      status: 'needs_reshoot' as const,
      latestVerification: it.latestVerification
        ? {
            ...it.latestVerification,
            passed: false,
            status: 'rejected_blur' as const,
            headline: data.note || 'Staff requested a clearer photo',
          }
        : null,
    };
  });

  const updated = {
    ...existing,
    items: updatedItems,
    updatedAt: now,
  };
  updated.status = recomputeRequestStatus(updated);
  await saveRequest(updated);

  if (data.decision === 'request_reshoot') {
    await appendMessage(existing.id, {
      id: `msg_${crypto.randomBytes(5).toString('hex')}`,
      direction: 'outbound',
      channel: existing.preferredChannel === 'sms' ? 'sms' : 'whatsapp',
      senderLabel: firm?.senderName || 'Firm Reviewer',
      body:
        data.note ||
        `Quick note on "${target.title}": could you snap and text a clearer copy when you have a moment?`,
      createdAt: now,
    });
  }

  const messages = await getMessages(existing.id);
  return NextResponse.json({ request: updated, messages });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureSeeded();
  const { id } = await context.params;
  const existing = await getRequest(id);
  if (!existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  await deleteRequest(id);
  return NextResponse.json({ deleted: true, id });
}
