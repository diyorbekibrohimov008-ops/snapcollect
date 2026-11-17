import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { computeDashboardMetrics, dispatchReminderForRequest } from '@/lib/intake-service';
import { buildDefaultCadence, buildRequestFromTemplate, ensureSeeded } from '@/lib/seed';
import {
  getFirmBranding,
  getTemplate,
  listRequests,
  listTemplates,
  saveMessages,
  saveRequest,
} from '@/lib/storage';
import type { ClientRequest } from '@/lib/types';

const CreateRequestSchema = z.object({
  mode: z.enum(['single', 'bulk']).optional().default('single'),
  templateId: z.string().optional(),
  title: z.string().min(2).max(120).optional(),
  vertical: z.enum(['tax', 'mortgage', 'creative', 'general']).optional(),
  clientName: z.string().min(2).max(80).optional(),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().min(6).max(30).optional(),
  preferredChannel: z.enum(['whatsapp', 'sms', 'portal']).optional().default('whatsapp'),
  dueDate: z.string().optional(),
  autoPauseOnComplete: z.boolean().optional().default(true),
  sendWelcomeNow: z.boolean().optional().default(true),
  steps: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().min(1),
        description: z.string().default(''),
        order: z.number().int().min(1),
      }),
    )
    .optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        stepId: z.string(),
        title: z.string().min(1),
        instructions: z.string().default(''),
        expectedDocType: z.enum([
          'w2',
          '1099',
          'bank_statement',
          'government_id',
          'paystub',
          'tax_return',
          'brand_asset',
          'any',
        ]),
        expectedYear: z.string().nullable().default(null),
        acceptedFormats: z
          .array(z.string())
          .default(['image/jpeg', 'image/png', 'application/pdf']),
        minSharpness: z.number().int().min(10).max(95).default(55),
        required: z.boolean().default(true),
      }),
    )
    .optional(),
  reminderRules: z
    .array(
      z.object({
        id: z.string(),
        dayOffset: z.number().int().min(0).max(90),
        channel: z.enum(['whatsapp', 'sms', 'email']),
        subject: z.string().min(1),
        messageTemplate: z.string().min(1),
      }),
    )
    .optional(),
  bulkCount: z.number().int().min(1).max(25).optional(),
});

function makeSlugToken(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `${slug || 'client'}-${crypto.randomBytes(3).toString('hex')}`;
}

function makeRefCode(vertical: string): string {
  const prefix =
    vertical === 'tax'
      ? 'TAX'
      : vertical === 'mortgage'
        ? 'MTG'
        : vertical === 'creative'
          ? 'CRT'
          : 'DOC';
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function GET(request: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(request.url);
  const vertical = searchParams.get('vertical');
  const status = searchParams.get('status');
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  let requests = await listRequests();
  if (vertical && vertical !== 'all') {
    requests = requests.filter((r) => r.vertical === vertical);
  }
  if (status && status !== 'all') {
    requests = requests.filter((r) => r.status === status);
  }
  if (q) {
    requests = requests.filter(
      (r) =>
        r.clientName.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.referenceCode.toLowerCase().includes(q) ||
        r.clientPhone.toLowerCase().includes(q),
    );
  }

  const [metrics, firm] = await Promise.all([computeDashboardMetrics(), getFirmBranding()]);
  return NextResponse.json({ requests, metrics, firm });
}

export async function POST(request: Request) {
  await ensureSeeded();
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = CreateRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const origin = new URL(request.url).origin;

  if (data.mode === 'bulk') {
    const templates = await listTemplates();
    const tpl =
      (data.templateId ? await getTemplate(data.templateId) : null) ?? templates[0];
    const count = data.bulkCount ?? 10;
    const now = Date.now();
    const created: ClientRequest[] = [];

    const firstNames = [
      'Olivia',
      'Lucas',
      'Amara',
      'Mateo',
      'Chloe',
      'Samuel',
      'Zoe',
      'Julian',
      'Nadia',
      'Owen',
      'Maya',
      'Daniel',
    ];
    const lastNames = [
      'Ramirez',
      'Patel',
      'Morrison',
      'Nguyen',
      'Okafor',
      'Berger',
      'Keller',
      'Singh',
      'Silva',
      'Dixon',
    ];

    for (let i = 0; i < count; i++) {
      const name = `${firstNames[i % firstNames.length]} ${lastNames[(i * 3) % lastNames.length]}`;
      const id = `req_${crypto.randomBytes(5).toString('hex')}`;
      const phoneTail = String(4100 + Math.floor(Math.random() * 5000));
      const req = buildRequestFromTemplate({
        id,
        token: makeSlugToken(name),
        referenceCode: makeRefCode(tpl.vertical),
        title: `2025 Tax Season Batch · ${tpl.name}`,
        template: tpl,
        clientName: name,
        clientEmail: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        clientPhone: `+1555790${phoneTail}`,
        preferredChannel: i % 2 === 0 ? 'whatsapp' : 'sms',
        verifiedCount: 0,
        updatedAt: new Date(now - i * 1000).toISOString(),
      });
      await saveRequest(req);
      created.push(req);
    }

    const metrics = await computeDashboardMetrics();
    return NextResponse.json({ created, count: created.length, metrics }, { status: 201 });
  }

  if (!data.clientName || !data.clientEmail || !data.clientPhone) {
    return NextResponse.json(
      { error: 'clientName, clientEmail, and clientPhone are required' },
      { status: 400 },
    );
  }

  const template = data.templateId ? await getTemplate(data.templateId) : null;
  const templates = template ? [] : await listTemplates();
  const baseTemplate = template ?? templates[0];

  const steps = data.steps && data.steps.length > 0 ? data.steps : baseTemplate.steps;
  const itemDefs = data.items && data.items.length > 0 ? data.items : baseTemplate.items;
  const now = new Date().toISOString();
  const vertical = data.vertical ?? baseTemplate.vertical;

  const newRequest: ClientRequest = {
    id: `req_${crypto.randomBytes(5).toString('hex')}`,
    token: makeSlugToken(data.clientName),
    referenceCode: makeRefCode(vertical),
    title: data.title || baseTemplate.name,
    vertical,
    clientName: data.clientName,
    clientEmail: data.clientEmail,
    clientPhone: data.clientPhone,
    preferredChannel: data.preferredChannel,
    status: 'pending',
    dueDate: data.dueDate || '2026-11-30',
    steps,
    items: itemDefs.map((it) => ({
      ...it,
      status: 'pending',
      submissions: [],
      latestVerification: null,
    })),
    reminderRules:
      data.reminderRules && data.reminderRules.length > 0
        ? data.reminderRules.map((r) => ({ ...r, sent: false, sentAt: null }))
        : buildDefaultCadence(now),
    autoPauseOnComplete: data.autoPauseOnComplete,
    aiCatchesCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await saveRequest(newRequest);
  await saveMessages(newRequest.id, []);

  if (data.sendWelcomeNow) {
    await dispatchReminderForRequest({
      requestId: newRequest.id,
      ruleId: newRequest.reminderRules[0]?.id,
      originUrl: origin,
    });
  }

  const metrics = await computeDashboardMetrics();
  return NextResponse.json({ request: newRequest, metrics }, { status: 201 });
}
