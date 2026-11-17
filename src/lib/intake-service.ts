import crypto from 'node:crypto';
import {
  appendMessage,
  getFirmBranding,
  getRequest,
  listOutbox,
  listRequests,
  putBinary,
  saveOutboxDispatch,
  saveRequest,
} from './storage';
import { ensureSeeded } from './seed';
import { formatDocLabel, verifyDocumentServer } from './server-verify';
import type {
  ChatMessage,
  ChecklistItemState,
  ClientRequest,
  DashboardMetrics,
  IntakeChannel,
  ItemStatus,
  OutboxDispatch,
  RequestStatus,
  SubmissionRecord,
  VerificationResult,
} from './types';

export function recomputeRequestStatus(request: ClientRequest): RequestStatus {
  const anyNeedsReshoot = request.items.some((item) => item.status === 'needs_reshoot');
  if (anyNeedsReshoot) return 'needs_reshoot';

  const requiredItems = request.items.filter((item) => item.required);
  const allRequiredDone =
    requiredItems.length > 0 &&
    requiredItems.every(
      (item) => item.status === 'verified' || item.status === 'approved_override',
    );
  if (allRequiredDone) return 'complete';

  const anyVerified = request.items.some(
    (item) => item.status === 'verified' || item.status === 'approved_override',
  );
  return anyVerified ? 'in_progress' : 'pending';
}

export function selectTargetItemForUpload(
  request: ClientRequest,
  explicitItemId?: string | null,
  detectedDocType?: string | null,
): ChecklistItemState | null {
  if (explicitItemId) {
    const exact = request.items.find((it) => it.id === explicitItemId);
    if (exact) return exact;
  }
  if (detectedDocType && detectedDocType !== 'any') {
    const openMatch = request.items.find(
      (it) =>
        it.expectedDocType === detectedDocType &&
        it.status !== 'verified' &&
        it.status !== 'approved_override',
    );
    if (openMatch) return openMatch;

    const anyMatch = request.items.find((it) => it.expectedDocType === detectedDocType);
    if (anyMatch) return anyMatch;
  }
  return (
    request.items.find((it) => it.status === 'needs_reshoot') ??
    request.items.find((it) => it.status === 'pending') ??
    request.items[0] ??
    null
  );
}

export async function processDocumentSubmission(params: {
  requestId: string;
  itemId?: string | null;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  channel: IntakeChannel;
}): Promise<{
  request: ClientRequest;
  targetItem: ChecklistItemState;
  submission: SubmissionRecord;
  verification: VerificationResult;
}> {
  await ensureSeeded();
  const request = await getRequest(params.requestId);
  if (!request) {
    throw new Error(`Request not found: ${params.requestId}`);
  }

  // First pick provisional item (or let semantic classifier guide auto-routing when no itemId passed)
  const initialItem = selectTargetItemForUpload(request, params.itemId, null);
  if (!initialItem) {
    throw new Error('Request has no checklist items');
  }

  // Run initial verification; if no itemId was forced (e.g. WhatsApp/SMS), auto-route to matching slot
  let targetItem = initialItem;
  let verification = await verifyDocumentServer({
    buffer: params.buffer,
    fileName: params.fileName,
    mimeType: params.mimeType,
    item: targetItem,
  });

  if (!params.itemId && verification.detectedDocType !== 'any') {
    const rerouted = selectTargetItemForUpload(request, null, verification.detectedDocType);
    if (rerouted && rerouted.id !== targetItem.id) {
      targetItem = rerouted;
      verification = await verifyDocumentServer({
        buffer: params.buffer,
        fileName: params.fileName,
        mimeType: params.mimeType,
        item: targetItem,
      });
    }
  }

  const subId = `sub_${crypto.randomBytes(6).toString('hex')}`;
  const cleanName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `uploads/${request.id}/${targetItem.id}/${subId}_${cleanName}`;
  await putBinary(storageKey, params.buffer, params.mimeType || 'application/octet-stream');

  const submission: SubmissionRecord = {
    id: subId,
    itemId: targetItem.id,
    fileName: params.fileName,
    mimeType: params.mimeType,
    sizeBytes: params.buffer.length,
    storageKey,
    channel: params.channel,
    uploadedAt: verification.checkedAt,
    verification,
  };

  let aiCatchesDelta = 0;
  const updatedItems = request.items.map((item) => {
    if (item.id !== targetItem.id) return item;
    const nextStatus: ItemStatus = verification.passed ? 'verified' : 'needs_reshoot';
    if (!verification.passed) aiCatchesDelta = 1;
    return {
      ...item,
      status: nextStatus,
      submissions: [submission, ...item.submissions],
      latestVerification: verification,
    };
  });

  const updatedRequest: ClientRequest = {
    ...request,
    items: updatedItems,
    aiCatchesCount: request.aiCatchesCount + aiCatchesDelta,
    updatedAt: new Date().toISOString(),
  };
  updatedRequest.status = recomputeRequestStatus(updatedRequest);

  await saveRequest(updatedRequest);

  const refreshedTarget = updatedRequest.items.find((it) => it.id === targetItem.id)!;
  return {
    request: updatedRequest,
    targetItem: refreshedTarget,
    submission,
    verification,
  };
}

export function buildClientIntakeReply(
  request: ClientRequest,
  verification: VerificationResult,
  targetItem: ChecklistItemState,
): string {
  const remaining = request.items.filter(
    (it) => it.required && it.status !== 'verified' && it.status !== 'approved_override',
  );

  if (!verification.passed) {
    return `${verification.headline} Please snap and text a clearer ${targetItem.expectedYear ? `${targetItem.expectedYear} ` : ''}${formatDocLabel(targetItem.expectedDocType)} to replace it.`;
  }

  if (remaining.length === 0) {
    return `${verification.headline} — All required documents are now verified and complete! Thank you, ${request.clientName.split(' ')[0]}.`;
  }

  const nextList = remaining.map((it) => it.title).join(', ');
  return `${verification.headline} — Checked off! ${remaining.length} required item(s) left: ${nextList}.`;
}

export async function dispatchReminderForRequest(params: {
  requestId: string;
  ruleId?: string;
  customBody?: string;
  originUrl?: string;
}): Promise<{
  request: ClientRequest;
  dispatch: OutboxDispatch;
}> {
  await ensureSeeded();
  const request = await getRequest(params.requestId);
  if (!request) throw new Error(`Request not found: ${params.requestId}`);
  const firm = await getFirmBranding();

  const pendingItems = request.items.filter(
    (it) => it.status !== 'verified' && it.status !== 'approved_override',
  );
  const nextRule =
    (params.ruleId
      ? request.reminderRules.find((r) => r.id === params.ruleId)
      : request.reminderRules.find((r) => !r.sent)) ?? request.reminderRules[0];

  const portalBase = params.originUrl || 'https://snapcollect.vercel.app';
  const portalUrl = `${portalBase}/c/${request.token}`;
  const firmName = firm?.firmName || 'Summit Tax & Advisory';
  const dedicatedNumber = firm?.dedicatedNumber || '+1 (555) 019-2834';

  const interpolate = (tpl: string) =>
    tpl
      .replaceAll('{{clientName}}', request.clientName.split(' ')[0])
      .replaceAll('{{firmName}}', firmName)
      .replaceAll('{{pendingCount}}', String(Math.max(1, pendingItems.length)))
      .replaceAll('{{requestTitle}}', request.title)
      .replaceAll('{{portalUrl}}', portalUrl)
      .replaceAll('{{dedicatedNumber}}', dedicatedNumber);

  const channel = nextRule?.channel ?? 'sms';
  const subject = interpolate(
    nextRule?.subject || `Reminder: ${request.title} (${pendingItems.length} left)`,
  );
  const body =
    params.customBody ||
    interpolate(
      nextRule?.messageTemplate ||
        `Hi ${request.clientName.split(' ')[0]}, ${firmName} still needs ${pendingItems.length} item(s). Text photos to ${dedicatedNumber} or upload at ${portalUrl}.`,
    );

  let deliveryProvider: OutboxDispatch['deliveryProvider'] = 'simulated-outbox';

  // Real Resend email dispatch when RESEND_API_KEY is configured
  if (channel === 'email' && process.env.RESEND_API_KEY) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || `${firmName} <onboarding@resend.dev>`,
          to: [request.clientEmail],
          subject,
          text: body,
        }),
      });
      if (resp.ok) deliveryProvider = 'resend';
    } catch {
      // Fallback to outbox log cleanly
    }
  }

  // Real Twilio SMS/WhatsApp dispatch when Twilio credentials are configured
  if (
    (channel === 'sms' || channel === 'whatsapp') &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  ) {
    try {
      const to =
        channel === 'whatsapp' ? `whatsapp:${request.clientPhone}` : request.clientPhone;
      const from =
        channel === 'whatsapp'
          ? `whatsapp:${process.env.TWILIO_FROM_NUMBER}`
          : process.env.TWILIO_FROM_NUMBER;
      const form = new URLSearchParams({ To: to, From: from, Body: body });
      const auth = Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
      ).toString('base64');
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        },
      );
      if (resp.ok) deliveryProvider = 'twilio';
    } catch {
      // Fallback to outbox log cleanly
    }
  }

  const now = new Date().toISOString();
  const dispatch: OutboxDispatch = {
    id: `out_${crypto.randomBytes(5).toString('hex')}`,
    requestId: request.id,
    clientName: request.clientName,
    channel,
    recipient: channel === 'email' ? request.clientEmail : request.clientPhone,
    subject,
    body,
    deliveryProvider,
    status: 'sent',
    createdAt: now,
  };
  await saveOutboxDispatch(dispatch);

  const updatedRules = request.reminderRules.map((rule) =>
    nextRule && rule.id === nextRule.id ? { ...rule, sent: true, sentAt: now } : rule,
  );
  const updatedRequest: ClientRequest = {
    ...request,
    reminderRules: updatedRules,
    updatedAt: now,
  };
  await saveRequest(updatedRequest);

  if (channel === 'sms' || channel === 'whatsapp') {
    const chatMsg: ChatMessage = {
      id: `msg_${crypto.randomBytes(5).toString('hex')}`,
      direction: 'outbound',
      channel,
      senderLabel: firm?.senderName || firmName,
      body,
      createdAt: now,
    };
    await appendMessage(request.id, chatMsg);
  }

  return { request: updatedRequest, dispatch };
}

export async function runDueRemindersBatch(originUrl?: string): Promise<{
  processedCount: number;
  dispatches: OutboxDispatch[];
}> {
  await ensureSeeded();
  const requests = await listRequests();
  const dispatches: OutboxDispatch[] = [];

  for (const req of requests) {
    if (req.status === 'complete' && req.autoPauseOnComplete) continue;
    const hasUnsent = req.reminderRules.some((r) => !r.sent);
    if (!hasUnsent) continue;

    // Dispatch up to 5 due reminders per batch run to avoid rate spikes
    if (dispatches.length >= 5) break;
    const { dispatch } = await dispatchReminderForRequest({
      requestId: req.id,
      originUrl,
    });
    dispatches.push(dispatch);
  }

  return { processedCount: dispatches.length, dispatches };
}

export async function computeDashboardMetrics(): Promise<DashboardMetrics> {
  await ensureSeeded();
  const [requests, firm] = await Promise.all([listRequests(), getFirmBranding()]);

  const activeConcurrentRequests = requests.filter((r) => r.status !== 'complete').length;
  const completedRequests = requests.filter((r) => r.status === 'complete').length;
  const needsReshootRequests = requests.filter((r) => r.status === 'needs_reshoot').length;
  const totalAiCatches = requests.reduce((sum, r) => sum + (r.aiCatchesCount || 0), 0);
  const verifiedDocumentsCount = requests.reduce(
    (sum, r) =>
      sum +
      r.items.filter((it) => it.status === 'verified' || it.status === 'approved_override').length,
    0,
  );

  return {
    activeConcurrentRequests,
    totalRequests: requests.length,
    completedRequests,
    needsReshootRequests,
    totalAiCatches,
    verifiedDocumentsCount,
    competitorCapThreshold: 20,
    monthlyPriceUsd: firm?.monthlyPriceUsd ?? 25,
    competitorMonthlyUsd: 39,
  };
}

export async function getRecentOutbox(limit = 30): Promise<OutboxDispatch[]> {
  await ensureSeeded();
  return listOutbox(limit);
}
