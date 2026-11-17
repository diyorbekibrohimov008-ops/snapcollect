import { NextResponse } from 'next/server';
import { computeDashboardMetrics } from '@/lib/intake-service';
import { isBlobStorageActive } from '@/lib/storage';

export async function GET() {
  const metrics = await computeDashboardMetrics();
  return NextResponse.json({
    ok: true,
    service: 'snapcollect',
    storage: isBlobStorageActive() ? 'vercel-blob-private' : 'local-fs',
    aiVisionConfigured: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    metrics,
    timestamp: new Date().toISOString(),
  });
}
