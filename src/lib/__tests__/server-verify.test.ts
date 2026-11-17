import { describe, expect, it } from 'vitest';
import { generateSampleDocPng } from '../sample-docs';
import { verifyDocumentServer } from '../server-verify';
import type { ChecklistItemDefinition } from '../types';

const W2_2025_ITEM: ChecklistItemDefinition = {
  id: 'item_w2_2025',
  stepId: 'step_1',
  title: '2025 Form W-2',
  instructions: 'Upload crisp 2025 W-2',
  expectedDocType: 'w2',
  expectedYear: '2025',
  acceptedFormats: ['image/png', 'image/jpeg', 'application/pdf'],
  minSharpness: 55,
  required: true,
};

const GOV_ID_ITEM: ChecklistItemDefinition = {
  id: 'item_gov_id',
  stepId: 'step_2',
  title: 'Government Photo ID',
  instructions: 'Driver license or passport',
  expectedDocType: 'government_id',
  expectedYear: null,
  acceptedFormats: ['image/png', 'image/jpeg'],
  minSharpness: 55,
  required: true,
};

describe('verifyDocumentServer', () => {
  it('approves crisp 2025 W-2 PNG with high sharpness score', async () => {
    const sample = generateSampleDocPng('w2_2025_crisp');
    const result = await verifyDocumentServer({
      buffer: sample.buffer,
      fileName: sample.fileName,
      mimeType: sample.mimeType,
      item: W2_2025_ITEM,
    });

    expect(result.passed).toBe(true);
    expect(result.status).toBe('verified');
    expect(result.sharpnessScore).toBeGreaterThanOrEqual(55);
    expect(result.detectedDocType).toBe('w2');
    expect(result.detectedYear).toBe('2025');
  });

  it('rejects genuinely blurred W-2 photo with blurry alert', async () => {
    const sample = generateSampleDocPng('w2_2025_blurry');
    const result = await verifyDocumentServer({
      buffer: sample.buffer,
      fileName: sample.fileName,
      mimeType: sample.mimeType,
      item: W2_2025_ITEM,
    });

    expect(result.passed).toBe(false);
    expect(result.status).toBe('rejected_blur');
    expect(result.sharpnessScore).toBeLessThan(55);
    expect(result.headline).toContain('This photo is blurry');
  });

  it('flags 2024 W-2 uploaded into a 2025 W-2 slot', async () => {
    const sample = generateSampleDocPng('w2_2024_wrong_year');
    const result = await verifyDocumentServer({
      buffer: sample.buffer,
      fileName: sample.fileName,
      mimeType: sample.mimeType,
      item: W2_2025_ITEM,
    });

    expect(result.passed).toBe(false);
    expect(result.status).toBe('rejected_mismatch');
    expect(result.detectedYear).toBe('2024');
    expect(result.headline).toContain('2024');
    expect(result.headline).toContain('instead of 2025');
  });

  it('flags wrong document category when Bank Statement uploaded into Government ID slot', async () => {
    const sample = generateSampleDocPng('bank_2025_crisp');
    const result = await verifyDocumentServer({
      buffer: sample.buffer,
      fileName: sample.fileName,
      mimeType: sample.mimeType,
      item: GOV_ID_ITEM,
    });

    expect(result.passed).toBe(false);
    expect(result.status).toBe('rejected_mismatch');
    expect(result.detectedDocType).toBe('bank_statement');
  });

  it('handles zero-byte and corrupt uploads safely without throwing', async () => {
    const emptyRes = await verifyDocumentServer({
      buffer: Buffer.alloc(0),
      fileName: 'empty.png',
      mimeType: 'image/png',
      item: W2_2025_ITEM,
    });
    expect(emptyRes.passed).toBe(false);
    expect(emptyRes.status).toBe('rejected_format');

    const corruptRes = await verifyDocumentServer({
      buffer: Buffer.from('not-a-real-png'),
      fileName: 'bad.png',
      mimeType: 'image/png',
      item: W2_2025_ITEM,
    });
    expect(corruptRes.passed).toBe(false);
    expect(corruptRes.status).toBe('rejected_format');
  });

  it('verifies valid PDF containing Form W-2 and tax year 2025', async () => {
    const fakePdf = Buffer.from(
      '%PDF-1.4\n1 0 obj << /Title (Form W-2 Wage and Tax Statement 2025) >> endobj\nBT (2025 Form W-2) Tj ET\n%%EOF',
      'latin1',
    );
    const res = await verifyDocumentServer({
      buffer: fakePdf,
      fileName: 'tax_doc.pdf',
      mimeType: 'application/pdf',
      item: W2_2025_ITEM,
    });
    expect(res.passed).toBe(true);
    expect(res.detectedDocType).toBe('w2');
    expect(res.detectedYear).toBe('2025');
  });
});
