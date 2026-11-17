import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/seed';
import { getFirmBranding, saveFirmBranding } from '@/lib/storage';

const FirmUpdateSchema = z.object({
  firmName: z.string().min(2).max(80).optional(),
  tagline: z.string().max(180).optional(),
  verticalFocus: z.enum(['tax', 'mortgage', 'creative', 'general']).optional(),
  logoText: z.string().min(1).max(4).optional(),
  logoUrl: z.string().max(400).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  customDomain: z.string().max(120).optional(),
  senderName: z.string().min(2).max(60).optional(),
  dedicatedNumber: z.string().min(5).max(32).optional(),
  whatsappEnabled: z.boolean().optional(),
  hidePoweredBy: z.boolean().optional(),
});

export async function GET() {
  await ensureSeeded();
  const firm = await getFirmBranding();
  return NextResponse.json({ firm });
}

export async function PUT(request: Request) {
  await ensureSeeded();
  const existing = await getFirmBranding();
  if (!existing) {
    return NextResponse.json({ error: 'Firm profile not initialized' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = FirmUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await saveFirmBranding({
    ...existing,
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ firm: updated });
}
