import { NextResponse } from 'next/server';
import { generateSampleDocPng, type SampleDocKind } from '@/lib/sample-docs';

const VALID_KINDS: SampleDocKind[] = [
  'w2_2025_crisp',
  'w2_2025_blurry',
  'w2_2024_wrong_year',
  'bank_2025_crisp',
  'gov_id_crisp',
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawKind = (searchParams.get('kind') || 'w2_2025_crisp') as SampleDocKind;
  const kind = VALID_KINDS.includes(rawKind) ? rawKind : 'w2_2025_crisp';
  const asset = generateSampleDocPng(kind);

  return new NextResponse(new Uint8Array(asset.buffer), {
    status: 200,
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Disposition': `inline; filename="${asset.fileName}"`,
      'X-Sample-Filename': asset.fileName,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
