import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { buildClientIntakeReply, processDocumentSubmission } from '@/lib/intake-service';
import { ensureSeeded } from '@/lib/seed';
import { appendMessage, getMessages, getRequest } from '@/lib/storage';
import type { IntakeChannel } from '@/lib/types';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureSeeded();
  const { id } = await context.params;
  const existing = await getRequest(id);
  if (!existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form-data upload' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }

  const itemId = formData.get('itemId')?.toString() || null;
  const rawChannel = formData.get('channel')?.toString() || 'portal';
  const channel: IntakeChannel =
    rawChannel === 'whatsapp' || rawChannel === 'sms' || rawChannel === 'email'
      ? rawChannel
      : 'portal';

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await processDocumentSubmission({
    requestId: id,
    itemId,
    fileName: file.name || 'upload.png',
    mimeType: file.type || 'application/octet-stream',
    buffer,
    channel,
  });

  const replyText = buildClientIntakeReply(
    result.request,
    result.verification,
    result.targetItem,
  );

  const now = new Date().toISOString();
  await appendMessage(id, {
    id: `msg_${crypto.randomBytes(5).toString('hex')}`,
    direction: 'inbound',
    channel: channel === 'email' ? 'portal' : channel,
    senderLabel: result.request.clientName,
    body: `Uploaded "${file.name}" for ${result.targetItem.title}`,
    mediaFileName: file.name,
    mediaUrl: `/api/files/${result.submission.storageKey}`,
    verification: result.verification,
    createdAt: now,
  });

  await appendMessage(id, {
    id: `msg_${crypto.randomBytes(5).toString('hex')}`,
    direction: 'outbound',
    channel: channel === 'email' ? 'portal' : channel,
    senderLabel: 'SnapCollect AI',
    body: replyText,
    verification: result.verification,
    createdAt: new Date(Date.now() + 200).toISOString(),
  });

  const messages = await getMessages(id);
  const statusCode = result.verification.passed ? 200 : 422;

  return NextResponse.json(
    {
      ...result,
      replyText,
      messages,
    },
    { status: statusCode },
  );
}
