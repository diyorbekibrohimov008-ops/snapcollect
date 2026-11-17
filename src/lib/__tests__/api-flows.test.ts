import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getHealth } from '@/app/api/health/route';
import { PUT as putFirm } from '@/app/api/firm/route';
import { GET as getRequests, POST as postRequests } from '@/app/api/requests/route';
import { POST as postUpload } from '@/app/api/requests/[id]/upload/route';
import { GET as getFile } from '@/app/api/files/[...key]/route';
import { POST as postTwilioWebhook } from '@/app/api/webhooks/twilio/route';
import { POST as postRemindersRun } from '@/app/api/reminders/run/route';
import { generateSampleDocPng } from '@/lib/sample-docs';

let tmpDataDir = '';

beforeAll(async () => {
  tmpDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapcollect-test-'));
  process.env.SNAPCOLLECT_DATA_DIR = tmpDataDir;
  process.env.SNAPCOLLECT_FORCE_LOCAL = '1';
  process.env.SNAPCOLLECT_DISABLE_LIVE_AI = '1';
});

afterAll(async () => {
  if (tmpDataDir) {
    await fs.rm(tmpDataDir, { recursive: true, force: true });
  }
});

describe('SnapCollect API flows', () => {
  it('seeds 24 active requests (exceeding 20-cap) and supports unlimited bulk scaling', async () => {
    const healthResp = await getHealth();
    const healthJson = await healthResp.json();
    expect(healthResp.status).toBe(200);
    expect(healthJson.metrics.totalRequests).toBe(24);
    expect(healthJson.metrics.activeConcurrentRequests).toBeGreaterThanOrEqual(20);

    const bulkReq = new Request('http://localhost:3000/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'bulk', templateId: 'tpl_tax_2025', bulkCount: 5 }),
    });
    const bulkResp = await postRequests(bulkReq);
    const bulkJson = await bulkResp.json();
    expect(bulkResp.status).toBe(201);
    expect(bulkJson.count).toBe(5);
    expect(bulkJson.metrics.totalRequests).toBe(29);
  });

  it('rejects blurry upload and accepts crisp 2025 W-2 via portal upload route', async () => {
    const listResp = await getRequests(new Request('http://localhost:3000/api/requests'));
    const listJson = await listResp.json();
    const target = listJson.requests.find((r: { id: string }) => r.id === 'req_maya_chen');
    expect(target).toBeTruthy();

    const blurry = generateSampleDocPng('w2_2025_blurry');
    const blurryForm = new FormData();
    blurryForm.append(
      'file',
      new File([new Uint8Array(blurry.buffer)], blurry.fileName, { type: blurry.mimeType }),
    );
    blurryForm.append('itemId', target.items[0].id);
    const badResp = await postUpload(
      new Request(`http://localhost:3000/api/requests/${target.id}/upload`, {
        method: 'POST',
        body: blurryForm,
      }),
      { params: Promise.resolve({ id: target.id }) },
    );
    expect(badResp.status).toBe(422);
    const badJson = await badResp.json();
    expect(badJson.verification.status).toBe('rejected_blur');

    const crisp = generateSampleDocPng('w2_2025_crisp');
    const crispForm = new FormData();
    crispForm.append(
      'file',
      new File([new Uint8Array(crisp.buffer)], crisp.fileName, { type: crisp.mimeType }),
    );
    crispForm.append('itemId', target.items[0].id);
    const goodResp = await postUpload(
      new Request(`http://localhost:3000/api/requests/${target.id}/upload`, {
        method: 'POST',
        body: crispForm,
      }),
      { params: Promise.resolve({ id: target.id }) },
    );
    expect(goodResp.status).toBe(200);
    const goodJson = await goodResp.json();
    expect(goodJson.verification.passed).toBe(true);

    // Stored private binary can be streamed safely
    const keyParts = goodJson.submission.storageKey.split('/');
    const fileResp = await getFile(
      new Request(`http://localhost:3000/api/files/${goodJson.submission.storageKey}`),
      { params: Promise.resolve({ key: keyParts }) },
    );
    expect(fileResp.status).toBe(200);
    expect(fileResp.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('blocks path traversal attempts on /api/files', async () => {
    const resp = await getFile(new Request('http://localhost:3000/api/files/uploads/../secret'), {
      params: Promise.resolve({ key: ['uploads', '..', 'secret'] }),
    });
    expect(resp.status).toBe(400);
  });

  it('handles real Twilio urlencoded webhook returning TwiML XML and JSON simulator media', async () => {
    const formBody = new URLSearchParams({
      From: 'whatsapp:+15553910042',
      Body: 'status',
    });
    const xmlResp = await postTwilioWebhook(
      new Request('http://localhost:3000/api/webhooks/twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
      }),
    );
    expect(xmlResp.status).toBe(200);
    expect(xmlResp.headers.get('Content-Type')).toContain('application/xml');
    const xmlText = await xmlResp.text();
    expect(xmlText).toContain('<Response>');
    expect(xmlText).toContain('<Message>');

    // Simulator wrong-year W-2 via WhatsApp webhook
    const simResp = await postTwilioWebhook(
      new Request('http://localhost:3000/api/webhooks/twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          requestId: 'req_marcus_vance',
          channel: 'whatsapp',
          sampleKind: 'w2_2024_wrong_year',
        }),
      }),
    );
    expect(simResp.status).toBe(200);
    const simJson = await simResp.json();
    expect(simJson.verification.passed).toBe(false);
    expect(simJson.replyText).toContain('2024');
    expect(simJson.replyText).toContain('2025');
  });

  it('persists white-label firm branding updates and executes reminder cadence', async () => {
    const firmResp = await putFirm(
      new Request('http://localhost:3000/api/firm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmName: 'Apex CPA Partners',
          primaryColor: '#1E293B',
        }),
      }),
    );
    expect(firmResp.status).toBe(200);
    const firmJson = await firmResp.json();
    expect(firmJson.firm.firmName).toBe('Apex CPA Partners');

    const remResp = await postRemindersRun(
      new Request('http://localhost:3000/api/reminders/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: 'req_marcus_vance' }),
      }),
    );
    expect(remResp.status).toBe(200);
    const remJson = await remResp.json();
    expect(remJson.dispatch.status).toBe('sent');
  });
});
