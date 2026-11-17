import { NextResponse } from 'next/server';
import { getBinary, sanitizeStorageKey } from '@/lib/storage';

export async function GET(
  _req: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const joined = key.join('/');
  let safeKey: string;
  try {
    safeKey = sanitizeStorageKey(joined);
  } catch {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  if (!safeKey.startsWith('uploads/')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const file = await getBinary(safeKey);
  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.buffer.length),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
