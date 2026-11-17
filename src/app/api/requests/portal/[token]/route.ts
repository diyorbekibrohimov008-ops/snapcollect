import { NextResponse } from 'next/server';
import { ensureSeeded } from '@/lib/seed';
import { getFirmBranding, getMessages, getRequestByToken } from '@/lib/storage';

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> },
) {
  await ensureSeeded();
  const { token } = await context.params;
  const request = await getRequestByToken(token);
  if (!request) {
    return NextResponse.json({ error: 'Portal link not found or expired' }, { status: 404 });
  }
  const [firm, messages] = await Promise.all([getFirmBranding(), getMessages(request.id)]);
  return NextResponse.json({ request, firm, messages });
}
