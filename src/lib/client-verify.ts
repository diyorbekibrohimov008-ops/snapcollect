import type { ChecklistItemDefinition, DocumentCategory, VerificationResult } from './types';

const DOC_LABELS: Record<DocumentCategory, string> = {
  w2: 'Form W-2',
  '1099': 'Form 1099',
  bank_statement: 'Bank Statement',
  government_id: 'Government ID',
  paystub: 'Paystub',
  tax_return: 'Tax Return',
  brand_asset: 'Brand Asset',
  any: 'Document',
};

function inferClientSemantics(text: string): {
  detectedDocType: DocumentCategory;
  detectedYear: string | null;
} {
  const lower = text.toLowerCase();
  let detectedDocType: DocumentCategory = 'any';
  if (/\bw[\s_-]?2\b|wage\s+and\s+tax/.test(lower)) detectedDocType = 'w2';
  else if (/\b1099\b/.test(lower)) detectedDocType = '1099';
  else if (/bank|statement|checking|savings/.test(lower)) detectedDocType = 'bank_statement';
  else if (/driver|license|passport|gov(?:ernment)?[\s_-]?id|\bid\b/.test(lower))
    detectedDocType = 'government_id';
  else if (/paystub|pay[\s_-]?stub|payroll/.test(lower)) detectedDocType = 'paystub';
  else if (/logo|brand|hero|svg/.test(lower)) detectedDocType = 'brand_asset';

  const match =
    lower.match(/(?:tax\s*year|year|fy|dec|jan|period)[^\d]{0,12}(202[0-7])\b/) ||
    lower.match(/\b(202[0-7])\b/);

  return {
    detectedDocType,
    detectedYear: match ? match[1] : null,
  };
}

async function readHeadAsciiHints(file: File): Promise<string> {
  try {
    const slice = file.slice(0, 65536);
    const buf = await slice.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      out += b >= 32 && b <= 126 ? String.fromCharCode(b) : ' ';
    }
    return out;
  } catch {
    return '';
  }
}

async function analyzeImageCanvas(file: File): Promise<{
  width: number;
  height: number;
  sharpnessScore: number;
  brightnessScore: number;
}> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode image'));
      el.src = url;
    });

    const maxSide = 480;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const sw = Math.max(16, Math.round(img.width * scale));
    const sh = Math.max(16, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { width: img.width, height: img.height, sharpnessScore: 75, brightnessScore: 75 };
    }
    ctx.drawImage(img, 0, 0, sw, sh);
    const { data } = ctx.getImageData(0, 0, sw, sh);
    const gray = new Float32Array(sw * sh);
    let lumSum = 0;

    for (let i = 0; i < sw * sh; i++) {
      const p = i * 4;
      const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      gray[i] = lum;
      lumSum += lum;
    }

    const brightnessScore = Math.round(Math.min(100, Math.max(0, ((lumSum / (sw * sh)) / 255) * 100)));

    let lapSum = 0;
    let lapSqSum = 0;
    let strongEdges = 0;
    let count = 0;
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const idx = y * sw + x;
        const lap = gray[idx - sw] + gray[idx + sw] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx];
        lapSum += lap;
        lapSqSum += lap * lap;
        if (Math.abs(lap) > 22) strongEdges++;
        count++;
      }
    }

    const meanLap = lapSum / Math.max(1, count);
    const variance = Math.max(0, lapSqSum / Math.max(1, count) - meanLap * meanLap);
    const edgeDensity = strongEdges / Math.max(1, count);
    const varComp = Math.min(72, (Math.sqrt(variance) / 55) * 72);
    const edgeComp = Math.min(28, (edgeDensity / 0.04) * 28);
    const sharpnessScore = Math.round(Math.min(100, Math.max(0, varComp + edgeComp)));

    return { width: img.width, height: img.height, sharpnessScore, brightnessScore };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function verifyFileClientSide(
  file: File,
  item: ChecklistItemDefinition,
): Promise<VerificationResult> {
  const checkedAt = new Date().toISOString();
  const mime = (file.type || '').toLowerCase();
  const lowerName = file.name.toLowerCase();

  if (file.size === 0) {
    return {
      status: 'rejected_format',
      passed: false,
      headline: 'Empty file selected',
      detail: 'Please select a valid photo or PDF.',
      sharpnessScore: 0,
      brightnessScore: 0,
      width: 0,
      height: 0,
      detectedDocType: 'any',
      detectedYear: null,
      extractedSummary: '0-byte file rejected in browser',
      confidence: 100,
      engine: 'client-canvas',
      checkedAt,
    };
  }

  const isPdf = mime === 'application/pdf' || lowerName.endsWith('.pdf');
  const isImage = mime.startsWith('image/') || /\.(png|jpe?g|webp|svg|heic)$/.test(lowerName);

  if (!isPdf && !isImage) {
    return {
      status: 'rejected_format',
      passed: false,
      headline: `Unsupported file type (${file.name})`,
      detail: `Please upload an image (JPG, PNG) or PDF for "${item.title}".`,
      sharpnessScore: 0,
      brightnessScore: 0,
      width: 0,
      height: 0,
      detectedDocType: 'any',
      detectedYear: null,
      extractedSummary: 'Rejected unsupported extension in browser',
      confidence: 100,
      engine: 'client-canvas',
      checkedAt,
    };
  }

  const headHints = await readHeadAsciiHints(file);
  const semantics = inferClientSemantics(`${file.name} ${headHints}`);

  let width = 1200;
  let height = 900;
  let sharpnessScore = 92;
  let brightnessScore = 80;

  if (isImage && !lowerName.endsWith('.svg')) {
    const metrics = await analyzeImageCanvas(file);
    width = metrics.width;
    height = metrics.height;
    sharpnessScore = metrics.sharpnessScore;
    brightnessScore = metrics.brightnessScore;

    if (sharpnessScore < item.minSharpness) {
      return {
        status: 'rejected_blur',
        passed: false,
        headline: `This photo is blurry (Sharpness ${sharpnessScore}/100)`,
        detail: `Instant pre-check caught low sharpness before upload. Hold steady in brighter light and retake.`,
        sharpnessScore,
        brightnessScore,
        width,
        height,
        detectedDocType: semantics.detectedDocType,
        detectedYear: semantics.detectedYear,
        extractedSummary: `Blocked blurry capture client-side (${sharpnessScore}/100).`,
        confidence: 94,
        engine: 'client-canvas',
        checkedAt,
      };
    }
  }

  if (item.expectedYear && semantics.detectedYear && semantics.detectedYear !== item.expectedYear) {
    const label =
      DOC_LABELS[
        semantics.detectedDocType !== 'any' ? semantics.detectedDocType : item.expectedDocType
      ];
    return {
      status: 'rejected_mismatch',
      passed: false,
      headline: `You uploaded a ${semantics.detectedYear} ${label} instead of ${item.expectedYear}.`,
      detail: `Instant pre-check noticed ${semantics.detectedYear}, while this item expects ${item.expectedYear}.`,
      sharpnessScore,
      brightnessScore,
      width,
      height,
      detectedDocType: semantics.detectedDocType,
      detectedYear: semantics.detectedYear,
      extractedSummary: `Client check flagged year mismatch (${semantics.detectedYear} vs ${item.expectedYear}).`,
      confidence: 93,
      engine: 'client-canvas',
      checkedAt,
    };
  }

  if (
    item.expectedDocType !== 'any' &&
    semantics.detectedDocType !== 'any' &&
    semantics.detectedDocType !== item.expectedDocType
  ) {
    return {
      status: 'rejected_mismatch',
      passed: false,
      headline: `Looks like a ${DOC_LABELS[semantics.detectedDocType]} instead of ${DOC_LABELS[item.expectedDocType]}.`,
      detail: `Check that you selected the right file for "${item.title}".`,
      sharpnessScore,
      brightnessScore,
      width,
      height,
      detectedDocType: semantics.detectedDocType,
      detectedYear: semantics.detectedYear,
      extractedSummary: `Client check flagged document mismatch.`,
      confidence: 90,
      engine: 'client-canvas',
      checkedAt,
    };
  }

  const label =
    DOC_LABELS[
      semantics.detectedDocType !== 'any' ? semantics.detectedDocType : item.expectedDocType
    ];
  const yr = semantics.detectedYear ?? item.expectedYear;

  return {
    status: 'verified',
    passed: true,
    headline: `Pre-check passed: ${yr ? `${yr} ` : ''}${label} (${sharpnessScore}/100)`,
    detail: 'Sharp image and matching document criteria. Uploading securely...',
    sharpnessScore,
    brightnessScore,
    width,
    height,
    detectedDocType: semantics.detectedDocType,
    detectedYear: semantics.detectedYear,
    extractedSummary: `Client pre-check passed (${width}x${height}px, ${sharpnessScore}/100).`,
    confidence: 92,
    engine: 'client-canvas',
    checkedAt,
  };
}
