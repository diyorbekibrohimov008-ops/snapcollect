import fs from 'node:fs/promises';
import path from 'node:path';
import { put, get, list, del } from '@vercel/blob';
import type {
  ChatMessage,
  ChecklistTemplate,
  ClientRequest,
  FirmBranding,
  OutboxDispatch,
} from './types';

const DEFAULT_LOCAL_DIR = path.join(process.cwd(), '.snapcollect-data');

function getLocalRoot(): string {
  return process.env.SNAPCOLLECT_DATA_DIR || DEFAULT_LOCAL_DIR;
}

function useVercelBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN) && !process.env.SNAPCOLLECT_FORCE_LOCAL;
}

export function sanitizeStorageKey(key: string): string {
  const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.includes('\0')) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return normalized;
}

async function readLocalFile(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const safeKey = sanitizeStorageKey(key);
  const fullPath = path.join(/*turbopackIgnore: true*/ getLocalRoot(), safeKey);
  const metaPath = `${fullPath}.meta.json`;
  try {
    const buffer = await fs.readFile(/*turbopackIgnore: true*/ fullPath);
    let contentType = 'application/octet-stream';
    try {
      const metaRaw = await fs.readFile(/*turbopackIgnore: true*/ metaPath, 'utf-8');
      const meta = JSON.parse(metaRaw) as { contentType?: string };
      if (meta.contentType) contentType = meta.contentType;
    } catch {
      if (safeKey.endsWith('.json')) contentType = 'application/json';
      else if (safeKey.endsWith('.png')) contentType = 'image/png';
      else if (safeKey.endsWith('.jpg') || safeKey.endsWith('.jpeg')) contentType = 'image/jpeg';
      else if (safeKey.endsWith('.pdf')) contentType = 'application/pdf';
    }
    return { buffer, contentType };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return null;
    throw err;
  }
}

async function writeLocalFile(key: string, buffer: Buffer, contentType: string): Promise<void> {
  const safeKey = sanitizeStorageKey(key);
  const fullPath = path.join(/*turbopackIgnore: true*/ getLocalRoot(), safeKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  await fs.writeFile(`${fullPath}.meta.json`, JSON.stringify({ contentType }), 'utf-8');
}

async function listLocalKeys(prefix: string): Promise<string[]> {
  const safePrefix = sanitizeStorageKey(prefix.endsWith('/') ? prefix.slice(0, -1) : prefix);
  const root = getLocalRoot();
  const targetDir = path.join(/*turbopackIgnore: true*/ root, safePrefix);
  const results: string[] = [];

  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return;
      throw err;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (!entry.name.endsWith('.meta.json')) {
        const rel = path.relative(root, full).replace(/\\/g, '/');
        results.push(rel);
      }
    }
  }

  await walk(targetDir);
  return results.sort();
}

export async function putBinary(key: string, buffer: Buffer, contentType: string): Promise<void> {
  const safeKey = sanitizeStorageKey(key);
  if (useVercelBlob()) {
    await put(safeKey, buffer, {
      access: 'private',
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType,
    });
    return;
  }
  await writeLocalFile(safeKey, buffer, contentType);
}

export async function getBinary(
  key: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const safeKey = sanitizeStorageKey(key);
  if (useVercelBlob()) {
    try {
      const result = await get(safeKey, { access: 'private', useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) {
        return null;
      }
      const arrayBuf = await new Response(result.stream).arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuf),
        contentType: result.blob.contentType || 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }
  return readLocalFile(safeKey);
}

export async function putJson<T>(key: string, data: T): Promise<void> {
  const payload = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
  await putBinary(key, payload, 'application/json');
}

export async function getJson<T>(key: string): Promise<T | null> {
  const file = await getBinary(key);
  if (!file) return null;
  try {
    return JSON.parse(file.buffer.toString('utf-8')) as T;
  } catch {
    return null;
  }
}

export async function listKeys(prefix: string): Promise<string[]> {
  const safePrefix = sanitizeStorageKey(prefix);
  if (useVercelBlob()) {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: safePrefix, cursor });
      for (const blob of page.blobs) {
        keys.push(blob.pathname);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return keys.sort();
  }
  return listLocalKeys(safePrefix);
}

export async function deleteKey(key: string): Promise<void> {
  const safeKey = sanitizeStorageKey(key);
  if (useVercelBlob()) {
    await del(safeKey);
    return;
  }
  const fullPath = path.join(/*turbopackIgnore: true*/ getLocalRoot(), safeKey);
  await fs.rm(fullPath, { force: true });
  await fs.rm(`${fullPath}.meta.json`, { force: true });
}

export async function getFirmBranding(): Promise<FirmBranding | null> {
  return getJson<FirmBranding>('db/firm.json');
}

export async function saveFirmBranding(firm: FirmBranding): Promise<FirmBranding> {
  await putJson('db/firm.json', firm);
  return firm;
}

export async function listTemplates(): Promise<ChecklistTemplate[]> {
  const keys = await listKeys('db/templates/');
  const items = await Promise.all(keys.map((k) => getJson<ChecklistTemplate>(k)));
  return items
    .filter((item): item is ChecklistTemplate => Boolean(item))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getTemplate(id: string): Promise<ChecklistTemplate | null> {
  return getJson<ChecklistTemplate>(`db/templates/${id}.json`);
}

export async function saveTemplate(template: ChecklistTemplate): Promise<ChecklistTemplate> {
  await putJson(`db/templates/${template.id}.json`, template);
  return template;
}

export async function listRequests(): Promise<ClientRequest[]> {
  const keys = await listKeys('db/requests/');
  const items = await Promise.all(keys.map((k) => getJson<ClientRequest>(k)));
  return items
    .filter((item): item is ClientRequest => Boolean(item))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getRequest(id: string): Promise<ClientRequest | null> {
  return getJson<ClientRequest>(`db/requests/${id}.json`);
}

export async function getRequestByToken(token: string): Promise<ClientRequest | null> {
  const all = await listRequests();
  return all.find((req) => req.token === token) ?? null;
}

export async function findRequestByPhoneOrCode(
  phone?: string,
  text?: string,
): Promise<ClientRequest | null> {
  const all = await listRequests();
  const normalizedPhone = (phone || '').replace(/[^\d]/g, '');
  const upperText = (text || '').toUpperCase();

  // Match explicit reference code like TAX-2088 or MTG-7741 first
  for (const req of all) {
    if (req.referenceCode && upperText.includes(req.referenceCode.toUpperCase())) {
      return req;
    }
  }

  // Match normalized phone number (last 10 digits)
  if (normalizedPhone.length >= 7) {
    const tail = normalizedPhone.slice(-10);
    const byPhone = all.find((req) => req.clientPhone.replace(/[^\d]/g, '').endsWith(tail));
    if (byPhone) return byPhone;
  }

  return all.find((req) => req.status !== 'complete') ?? all[0] ?? null;
}

export async function saveRequest(request: ClientRequest): Promise<ClientRequest> {
  await putJson(`db/requests/${request.id}.json`, request);
  return request;
}

export async function deleteRequest(id: string): Promise<void> {
  await deleteKey(`db/requests/${id}.json`);
  await deleteKey(`db/threads/${id}.json`);
}

export async function getMessages(requestId: string): Promise<ChatMessage[]> {
  return (await getJson<ChatMessage[]>(`db/threads/${requestId}.json`)) ?? [];
}

export async function saveMessages(requestId: string, messages: ChatMessage[]): Promise<ChatMessage[]> {
  await putJson(`db/threads/${requestId}.json`, messages);
  return messages;
}

export async function appendMessage(requestId: string, message: ChatMessage): Promise<ChatMessage[]> {
  const existing = await getMessages(requestId);
  const updated = [...existing, message];
  await saveMessages(requestId, updated);
  return updated;
}

export async function listOutbox(limit = 50): Promise<OutboxDispatch[]> {
  const keys = await listKeys('db/outbox/');
  const sliced = keys.slice(-limit);
  const items = await Promise.all(sliced.map((k) => getJson<OutboxDispatch>(k)));
  return items
    .filter((item): item is OutboxDispatch => Boolean(item))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveOutboxDispatch(dispatch: OutboxDispatch): Promise<OutboxDispatch> {
  const sortPrefix = dispatch.createdAt.replace(/[:.]/g, '-');
  await putJson(`db/outbox/${sortPrefix}_${dispatch.id}.json`, dispatch);
  return dispatch;
}

export function isBlobStorageActive(): boolean {
  return useVercelBlob();
}
