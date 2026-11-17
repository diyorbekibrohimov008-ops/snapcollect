import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildDefaultCadence, ensureSeeded } from '@/lib/seed';
import { listTemplates, saveTemplate } from '@/lib/storage';

const CreateTemplateSchema = z.object({
  name: z.string().min(2).max(100),
  vertical: z.enum(['tax', 'mortgage', 'creative', 'general']),
  description: z.string().max(300).default(''),
  steps: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().min(1),
        description: z.string().default(''),
        order: z.number().int().min(1),
      }),
    )
    .min(1),
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
    .min(1),
});

export async function GET() {
  await ensureSeeded();
  const templates = await listTemplates();
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  await ensureSeeded();
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = CreateTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid template data', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const template = await saveTemplate({
    id: `tpl_${crypto.randomBytes(5).toString('hex')}`,
    ...parsed.data,
    defaultCadence: buildDefaultCadence(now),
    createdAt: now,
  });

  return NextResponse.json({ template }, { status: 201 });
}
