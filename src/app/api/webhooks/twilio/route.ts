import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { buildClientIntakeReply, processDocumentSubmission } from '@/lib/intake-service';
import { generateSampleDocPng, type SampleDocKind } from '@/lib/sample-docs';
import { ensureSeeded } from '@/lib/seed';
import {
  appendMessage,
  findRequestByPhoneOrCode,
  getFirmBranding,
  getMessages,
  getRequest,
} from '@/lib/storage';

const XML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => XML_ESCAPE_MAP[ch] ?? ch);
}

function makeTwiml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Message>${escapeXml(message)}</Message>\n</Response>`;
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export async function POST(req: Request) {
  await ensureSeeded();
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  const wantsJson =
    (req.headers.get('accept') || '').includes('application/json') ||
    contentType.includes('application/json') ||
    contentType.includes('multipart/form-data');

  let requestId: string | null = null;
  let from = '+15553910042';
  let body = '';
  let channel: 'whatsapp' | 'sms' = 'whatsapp';
  let mediaUrl = '';
  let mediaContentType = 'image/png';
  let fileName = '';
  let fileBuffer: Buffer | null = null;
  let sampleKind: SampleDocKind | null = null;
  let itemId: string | null = null;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const rawText = await req.text();
    const params = new URLSearchParams(rawText);
    const rawFrom = params.get('From') || '';
    channel = rawFrom.toLowerCase().startsWith('whatsapp:') ? 'whatsapp' : 'sms';
    from = rawFrom.replace(/^whatsapp:/i, '');
    body = params.get('Body') || '';
    mediaUrl = params.get('MediaUrl0') || '';
    mediaContentType = params.get('MediaContentType0') || 'image/jpeg';
    requestId = params.get('RequestId');
    itemId = params.get('ItemId');
  } else if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    requestId = form.get('requestId')?.toString() || null;
    from = (form.get('from')?.toString() || '').replace(/^whatsapp:/i, '');
    body = form.get('body')?.toString() || '';
    channel = form.get('channel')?.toString() === 'sms' ? 'sms' : 'whatsapp';
    itemId = form.get('itemId')?.toString() || null;
    const uploaded = form.get('file');
    if (uploaded instanceof File) {
      fileName = uploaded.name || 'whatsapp-snap.png';
      mediaContentType = uploaded.type || 'image/png';
      fileBuffer = Buffer.from(await uploaded.arrayBuffer());
    }
  } else {
    let json: Record<string, unknown> = {};
    try {
      json = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }
    requestId = typeof json.requestId === 'string' ? json.requestId : null;
    from = typeof json.from === 'string' ? json.from.replace(/^whatsapp:/i, '') : from;
    body = typeof json.body === 'string' ? json.body : '';
    channel = json.channel === 'sms' ? 'sms' : 'whatsapp';
    itemId = typeof json.itemId === 'string' ? json.itemId : null;
    sampleKind = typeof json.sampleKind === 'string' ? (json.sampleKind as SampleDocKind) : null;
    if (typeof json.mediaDataUrl === 'string') {
      const decoded = decodeDataUrl(json.mediaDataUrl);
      if (decoded) {
        fileBuffer = decoded.buffer;
        mediaContentType = decoded.mimeType;
      }
    }
    if (typeof json.fileName === 'string') fileName = json.fileName;
    if (typeof json.mediaUrl === 'string') mediaUrl = json.mediaUrl;
  }

  const firm = await getFirmBranding();
  const targetRequest =
    (requestId ? await getRequest(requestId) : null) ??
    (await findRequestByPhoneOrCode(from, body));

  if (!targetRequest) {
    const fallbackReply = `Hi! We couldn't match your phone number to an open checklist. Reply with your reference code (like TAX-2088) or contact ${firm?.firmName || 'our office'}.`;
    const twiml = makeTwiml(fallbackReply);
    if (!wantsJson) {
      return new NextResponse(twiml, { status: 200, headers: { 'Content-Type': 'application/xml' } });
    }
    return NextResponse.json({ replyText: fallbackReply, twiml }, { status: 404 });
  }

  // Fetch remote Twilio MediaUrl0 if provided (strict HTTPS + Twilio host SSRF guard)
  if (!fileBuffer && mediaUrl) {
    try {
      const validateTwilioMediaUrl = (raw: string): URL | null => {
        try {
          const parsed = new URL(raw);
          if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
            return null;
          }
          const host = parsed.hostname.toLowerCase();
          if (host !== 'api.twilio.com' && !host.endsWith('.twiliocdn.com')) {
            return null;
          }
          return parsed;
        } catch {
          return null;
        }
      };

      const safeUrl = validateTwilioMediaUrl(mediaUrl);
      if (safeUrl) {
        const headers: Record<string, string> = {};
        if (
          safeUrl.hostname.toLowerCase() === 'api.twilio.com' &&
          process.env.TWILIO_ACCOUNT_SID &&
          process.env.TWILIO_AUTH_TOKEN
        ) {
          const auth = Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
          ).toString('base64');
          headers.Authorization = `Basic ${auth}`;
        }
        let mediaResp = await fetch(safeUrl.toString(), {
          headers,
          redirect: 'manual',
          signal: AbortSignal.timeout(10000),
        });
        if (mediaResp.status >= 300 && mediaResp.status < 400) {
          const location = mediaResp.headers.get('location');
          if (location) {
            const nextUrl = new URL(location, safeUrl);
            const nextHost = nextUrl.hostname.toLowerCase();
            if (
              nextUrl.protocol === 'https:' &&
              !nextUrl.username &&
              !nextUrl.password &&
              (nextHost.endsWith('.twiliocdn.com') || nextHost.endsWith('.amazonaws.com'))
            ) {
              mediaResp = await fetch(nextUrl.toString(), {
                redirect: 'error',
                signal: AbortSignal.timeout(10000),
              });
            }
          }
        }
        const rawType = mediaResp.headers.get('content-type') || '';
        const isAllowedMedia =
          !rawType ||
          rawType.startsWith('image/') ||
          rawType.startsWith('application/pdf');
        if (mediaResp.ok && isAllowedMedia) {
          const buf = Buffer.from(await mediaResp.arrayBuffer());
          if (buf.byteLength <= 10 * 1024 * 1024) {
            fileBuffer = buf;
            mediaContentType = rawType || mediaContentType;
            fileName = fileName || `mms_${Date.now()}.${mediaContentType.includes('pdf') ? 'pdf' : 'jpg'}`;
          }
        }
      }
    } catch {
      // Handle missing media gracefully below
    }
  }

  // Built-in sample snap helper for instant interactive testing
  if (!fileBuffer && sampleKind) {
    const sample = generateSampleDocPng(sampleKind);
    fileBuffer = sample.buffer;
    fileName = fileName || sample.fileName;
    mediaContentType = sample.mimeType;
  }

  const origin = new URL(req.url).origin;
  const portalUrl = `${origin}/c/${targetRequest.token}`;

  // Handle inbound media document submission
  if (fileBuffer) {
    const resolvedName = fileName || `whatsapp_doc_${Date.now()}.png`;
    const result = await processDocumentSubmission({
      requestId: targetRequest.id,
      itemId,
      fileName: resolvedName,
      mimeType: mediaContentType,
      buffer: fileBuffer,
      channel,
    });

    const replyText = buildClientIntakeReply(
      result.request,
      result.verification,
      result.targetItem,
    );

    const now = new Date().toISOString();
    await appendMessage(targetRequest.id, {
      id: `msg_${crypto.randomBytes(5).toString('hex')}`,
      direction: 'inbound',
      channel,
      senderLabel: result.request.clientName,
      body: body || `Sent ${resolvedName}`,
      mediaFileName: resolvedName,
      mediaUrl: `/api/files/${result.submission.storageKey}`,
      verification: result.verification,
      createdAt: now,
    });

    await appendMessage(targetRequest.id, {
      id: `msg_${crypto.randomBytes(5).toString('hex')}`,
      direction: 'outbound',
      channel,
      senderLabel: 'SnapCollect AI',
      body: replyText,
      verification: result.verification,
      createdAt: new Date(Date.now() + 150).toISOString(),
    });

    const messages = await getMessages(targetRequest.id);
    const twiml = makeTwiml(replyText);

    if (!wantsJson) {
      return new NextResponse(twiml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' },
      });
    }

    return NextResponse.json({
      replyText,
      twiml,
      request: result.request,
      targetItem: result.targetItem,
      verification: result.verification,
      submission: result.submission,
      messages,
    });
  }

  // Handle text-only conversational commands ("status", "help", etc.)
  const now = new Date().toISOString();
  await appendMessage(targetRequest.id, {
    id: `msg_${crypto.randomBytes(5).toString('hex')}`,
    direction: 'inbound',
    channel,
    senderLabel: targetRequest.clientName,
    body: body || 'status',
    createdAt: now,
  });

  const remaining = targetRequest.items.filter(
    (it) => it.status !== 'verified' && it.status !== 'approved_override',
  );
  const doneCount = targetRequest.items.length - remaining.length;

  let replyText = '';
  if (remaining.length === 0) {
    replyText = `All ${targetRequest.items.length} documents for ${targetRequest.title} are verified! No further uploads needed.`;
  } else {
    const listText = remaining.map((it, idx) => `${idx + 1}. ${it.title}`).join(' ');
    replyText = `Hi ${targetRequest.clientName.split(' ')[0]} (${targetRequest.referenceCode}): ${doneCount}/${targetRequest.items.length} verified. Snap & reply with photos for: ${listText} — or open ${portalUrl}`;
  }

  await appendMessage(targetRequest.id, {
    id: `msg_${crypto.randomBytes(5).toString('hex')}`,
    direction: 'outbound',
    channel,
    senderLabel: firm?.senderName || 'SnapCollect AI',
    body: replyText,
    createdAt: new Date(Date.now() + 150).toISOString(),
  });

  const messages = await getMessages(targetRequest.id);
  const twiml = makeTwiml(replyText);

  if (!wantsJson) {
    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  }

  return NextResponse.json({
    replyText,
    twiml,
    request: targetRequest,
    messages,
  });
}
