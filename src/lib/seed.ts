import {
  getFirmBranding,
  getJson,
  listRequests,
  putJson,
  saveFirmBranding,
  saveMessages,
  saveOutboxDispatch,
  saveRequest,
  saveTemplate,
} from './storage';
import type {
  ChatMessage,
  ChecklistItemState,
  ChecklistTemplate,
  ClientRequest,
  FirmBranding,
  ReminderRule,
  VerticalType,
} from './types';

let seedPromise: Promise<void> | null = null;

export function buildDefaultCadence(baseIso: string): ReminderRule[] {
  return [
    {
      id: 'rem_day1',
      dayOffset: 1,
      channel: 'whatsapp',
      subject: 'Instant document intake link & WhatsApp option',
      messageTemplate:
        'Hi {{clientName}}, {{firmName}} needs {{pendingCount}} quick document(s) for {{requestTitle}}. Reply to this text with photos or tap {{portalUrl}} — no login required.',
      sent: true,
      sentAt: baseIso,
    },
    {
      id: 'rem_day3',
      dayOffset: 3,
      channel: 'sms',
      subject: 'Friendly reminder: {{pendingCount}} items remaining',
      messageTemplate:
        'Quick nudge from {{firmName}}: snap & text your remaining {{pendingCount}} item(s) straight to this number to keep your filing on schedule.',
      sent: false,
      sentAt: null,
    },
    {
      id: 'rem_day7',
      dayOffset: 7,
      channel: 'email',
      subject: 'Action needed: complete your {{requestTitle}} checklist',
      messageTemplate:
        'Hello {{clientName}}, your {{requestTitle}} checklist still has {{pendingCount}} pending item(s). Upload from your phone in under 2 minutes at {{portalUrl}} or text photos to {{dedicatedNumber}}.',
      sent: false,
      sentAt: null,
    },
  ];
}

export const DEFAULT_FIRM_BRANDING: FirmBranding = {
  id: 'firm_default',
  firmName: 'Summit Tax & Advisory',
  tagline: 'Zero-login mobile & WhatsApp document intake with instant AI verification',
  verticalFocus: 'tax',
  logoText: 'ST',
  logoUrl: '',
  primaryColor: '#0F172A',
  accentColor: '#10B981',
  customDomain: 'intake.summittax.com',
  senderName: 'Summit Tax Desk',
  dedicatedNumber: '+1 (555) 019-2834',
  whatsappEnabled: true,
  hidePoweredBy: false,
  planName: 'Seasonal Unlimited',
  monthlyPriceUsd: 25,
  concurrentLimit: null,
  updatedAt: '2026-11-11T12:00:00.000Z',
};

export const DEFAULT_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'tpl_tax_2025',
    name: '2025 Individual Tax Return Intake',
    vertical: 'tax',
    description:
      'Multi-step tax client package covering 2025 W-2 wages, 1099s, bank statements, and government photo ID.',
    steps: [
      {
        id: 'step_tax_1',
        title: 'Step 1 · Income & Tax Forms',
        description: 'Snap or upload your 2025 tax forms. Our AI checks tax year & legibility automatically.',
        order: 1,
      },
      {
        id: 'step_tax_2',
        title: 'Step 2 · Identity & Banking',
        description: 'Clear photo ID and year-end bank statement for direct deposit verification.',
        order: 2,
      },
    ],
    items: [
      {
        id: 'item_w2_2025',
        stepId: 'step_tax_1',
        title: '2025 Form W-2 (Wage & Tax Statement)',
        instructions: 'Ensure all 4 corners and tax year "2025" are visible and sharp.',
        expectedDocType: 'w2',
        expectedYear: '2025',
        acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
        minSharpness: 55,
        required: true,
      },
      {
        id: 'item_1099_2025',
        stepId: 'step_tax_1',
        title: '2025 Form 1099-NEC / 1099-INT (if applicable)',
        instructions: 'Upload contractor, brokerage, or bank interest 1099 statements for 2025.',
        expectedDocType: '1099',
        expectedYear: '2025',
        acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
        minSharpness: 55,
        required: false,
      },
      {
        id: 'item_bank_2025',
        stepId: 'step_tax_2',
        title: '2025 Year-End Bank Statement',
        instructions: 'First page showing account holder name, last 4 digits, and statement period.',
        expectedDocType: 'bank_statement',
        expectedYear: '2025',
        acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
        minSharpness: 50,
        required: true,
      },
      {
        id: 'item_gov_id',
        stepId: 'step_tax_2',
        title: 'Government Photo ID (Driver License or Passport)',
        instructions: 'Avoid camera flash glare across the portrait or expiration date.',
        expectedDocType: 'government_id',
        expectedYear: null,
        acceptedFormats: ['image/jpeg', 'image/png'],
        minSharpness: 55,
        required: true,
      },
    ],
    defaultCadence: buildDefaultCadence('2026-11-11T10:00:00.000Z'),
    createdAt: '2026-11-01T09:00:00.000Z',
  },
  {
    id: 'tpl_mortgage_2025',
    name: 'Mortgage Pre-Approval Package',
    vertical: 'mortgage',
    description: 'Rapid borrower document intake for loan officers replacing multi-page portals.',
    steps: [
      {
        id: 'step_mtg_1',
        title: 'Step 1 · Income Proof',
        description: 'Current paystubs and 2025 W-2 statement.',
        order: 1,
      },
      {
        id: 'step_mtg_2',
        title: 'Step 2 · Assets & Borrower ID',
        description: 'Recent bank statements and valid photo ID.',
        order: 2,
      },
    ],
    items: [
      {
        id: 'item_mtg_w2',
        stepId: 'step_mtg_1',
        title: '2025 Form W-2',
        instructions: 'Full-page 2025 W-2 from your primary employer.',
        expectedDocType: 'w2',
        expectedYear: '2025',
        acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
        minSharpness: 55,
        required: true,
      },
      {
        id: 'item_mtg_paystub',
        stepId: 'step_mtg_1',
        title: 'Most Recent 30-Day Paystubs',
        instructions: 'Include YTD gross and net earnings.',
        expectedDocType: 'paystub',
        expectedYear: '2025',
        acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
        minSharpness: 50,
        required: true,
      },
      {
        id: 'item_mtg_bank',
        stepId: 'step_mtg_2',
        title: '2 Months Checking / Savings Statements',
        instructions: 'All pages, clear account summary.',
        expectedDocType: 'bank_statement',
        expectedYear: '2025',
        acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
        minSharpness: 50,
        required: true,
      },
      {
        id: 'item_mtg_id',
        stepId: 'step_mtg_2',
        title: 'Driver License / Government ID',
        instructions: 'Front side crisp photo with no glare.',
        expectedDocType: 'government_id',
        expectedYear: null,
        acceptedFormats: ['image/jpeg', 'image/png'],
        minSharpness: 55,
        required: true,
      },
    ],
    defaultCadence: buildDefaultCadence('2026-11-11T10:00:00.000Z'),
    createdAt: '2026-11-02T09:00:00.000Z',
  },
  {
    id: 'tpl_creative_brand',
    name: 'Creative Agency Brand Onboarding',
    vertical: 'creative',
    description: 'Collect vector logos, typography specs, and high-res photography without email clutter.',
    steps: [
      {
        id: 'step_crt_1',
        title: 'Step 1 · Core Brand Identity',
        description: 'Logos and brand style references.',
        order: 1,
      },
      {
        id: 'step_crt_2',
        title: 'Step 2 · Campaign Media',
        description: 'High-resolution product or team imagery.',
        order: 2,
      },
    ],
    items: [
      {
        id: 'item_crt_logo',
        stepId: 'step_crt_1',
        title: 'Primary Brand Logo',
        instructions: 'High-resolution PNG/SVG or PDF vector file.',
        expectedDocType: 'brand_asset',
        expectedYear: null,
        acceptedFormats: ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'],
        minSharpness: 50,
        required: true,
      },
      {
        id: 'item_crt_guide',
        stepId: 'step_crt_1',
        title: 'Brand Guidelines / Color Sheet',
        instructions: 'PDF or crisp screenshot of brand fonts & hex palette.',
        expectedDocType: 'brand_asset',
        expectedYear: null,
        acceptedFormats: ['application/pdf', 'image/png', 'image/jpeg'],
        minSharpness: 45,
        required: false,
      },
      {
        id: 'item_crt_hero',
        stepId: 'step_crt_2',
        title: 'Hero Photography / Product Shot',
        instructions: 'Minimum 800px crisp shot for website hero banner.',
        expectedDocType: 'brand_asset',
        expectedYear: null,
        acceptedFormats: ['image/jpeg', 'image/png'],
        minSharpness: 60,
        required: true,
      },
    ],
    defaultCadence: buildDefaultCadence('2026-11-11T10:00:00.000Z'),
    createdAt: '2026-11-03T09:00:00.000Z',
  },
];

function instantiateTemplateItems(
  template: ChecklistTemplate,
  verifiedCount: number,
  needsReshootFirst = false,
): ChecklistItemState[] {
  return template.items.map((item, idx) => {
    const isNeedsReshoot = needsReshootFirst && idx === 0;
    const isVerified = !isNeedsReshoot && idx < verifiedCount;
    return {
      ...item,
      status: isNeedsReshoot ? 'needs_reshoot' : isVerified ? 'verified' : 'pending',
      submissions: [],
      latestVerification: isNeedsReshoot
        ? {
            status: 'rejected_blur',
            passed: false,
            headline: 'This photo is blurry (Sharpness 24/100)',
            detail: 'Motion blur detected across W-2 Wage & Tax Statement fields. Ask client to retake in bright light.',
            sharpnessScore: 24,
            brightnessScore: 44,
            width: 640,
            height: 480,
            detectedDocType: item.expectedDocType,
            detectedYear: item.expectedYear,
            extractedSummary: 'Partial W-2 detected; box 1 unreadable due to camera shake.',
            confidence: 88,
            engine: 'forensic-ocr',
            checkedAt: '2026-11-11T15:10:00.000Z',
          }
        : isVerified
          ? {
              status: 'verified',
              passed: true,
              headline: `Verified ${item.expectedYear ? `${item.expectedYear} ` : ''}${item.title}`,
              detail: 'Crisp resolution and document fields verified automatically.',
              sharpnessScore: 91,
              brightnessScore: 76,
              width: 1400,
              height: 1000,
              detectedDocType: item.expectedDocType,
              detectedYear: item.expectedYear,
              extractedSummary: `Validated ${item.expectedYear ?? ''} ${item.expectedDocType.toUpperCase()} document.`,
              confidence: 96,
              engine: 'forensic-ocr',
              checkedAt: '2026-11-11T14:30:00.000Z',
            }
          : null,
    };
  });
}

export function buildRequestFromTemplate(params: {
  id: string;
  token: string;
  referenceCode: string;
  title: string;
  template: ChecklistTemplate;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  preferredChannel: 'whatsapp' | 'sms' | 'portal';
  verifiedCount: number;
  needsReshootFirst?: boolean;
  aiCatchesCount?: number;
  updatedAt: string;
  dueDate?: string;
}): ClientRequest {
  const items = instantiateTemplateItems(
    params.template,
    params.verifiedCount,
    params.needsReshootFirst,
  );
  const allRequiredDone = items.every(
    (it) => !it.required || it.status === 'verified' || it.status === 'approved_override',
  );
  const status = params.needsReshootFirst
    ? 'needs_reshoot'
    : allRequiredDone
      ? 'complete'
      : params.verifiedCount > 0
        ? 'in_progress'
        : 'pending';

  return {
    id: params.id,
    token: params.token,
    referenceCode: params.referenceCode,
    title: params.title,
    vertical: params.template.vertical,
    clientName: params.clientName,
    clientEmail: params.clientEmail,
    clientPhone: params.clientPhone,
    preferredChannel: params.preferredChannel,
    status,
    dueDate: params.dueDate || '2026-11-25',
    steps: params.template.steps,
    items,
    reminderRules: buildDefaultCadence(params.updatedAt),
    autoPauseOnComplete: true,
    aiCatchesCount: params.aiCatchesCount ?? (params.needsReshootFirst ? 1 : 0),
    createdAt: '2026-11-08T10:00:00.000Z',
    updatedAt: params.updatedAt,
  };
}

interface SeedClientSpec {
  id: string;
  token: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  vertical: VerticalType;
  title: string;
  channel: 'whatsapp' | 'sms' | 'portal';
  verifiedCount: number;
  needsReshoot?: boolean;
  aiCatches?: number;
  minutesAgo: number;
}

const SEED_CLIENTS: SeedClientSpec[] = [
  {
    id: 'req_marcus_vance',
    token: 'marcus-2025-tax',
    code: 'TAX-2088',
    name: 'Marcus Vance',
    email: 'marcus.vance@example.com',
    phone: '+15553910042',
    vertical: 'tax',
    title: '2025 Individual Tax Return',
    channel: 'whatsapp',
    verifiedCount: 1,
    aiCatches: 1,
    minutesAgo: 6,
  },
  {
    id: 'req_maya_chen',
    token: 'maya-2025-tax',
    code: 'TAX-1040',
    name: 'Maya Chen',
    email: 'maya.chen@example.com',
    phone: '+15552348891',
    vertical: 'tax',
    title: '2025 W-2 & Brokerage Filing',
    channel: 'sms',
    verifiedCount: 1,
    needsReshoot: true,
    aiCatches: 2,
    minutesAgo: 14,
  },
  {
    id: 'req_elena_rostova',
    token: 'elena-mortgage',
    code: 'MTG-7741',
    name: 'Elena Rostova',
    email: 'elena.r@example.com',
    phone: '+15558124409',
    vertical: 'mortgage',
    title: 'Conventional Refinance Package',
    channel: 'whatsapp',
    verifiedCount: 2,
    aiCatches: 1,
    minutesAgo: 28,
  },
  {
    id: 'req_atlas_roasters',
    token: 'atlas-brand-kit',
    code: 'CRT-3190',
    name: 'Atlas Coffee Roasters',
    email: 'ops@atlasroasters.example.com',
    phone: '+15556401128',
    vertical: 'creative',
    title: 'Q1 Rebrand Asset Drop',
    channel: 'portal',
    verifiedCount: 2,
    aiCatches: 0,
    minutesAgo: 45,
  },
  {
    id: 'req_david_kim',
    token: 'david-2025-tax',
    code: 'TAX-3301',
    name: 'David Kim',
    email: 'dkim@example.com',
    phone: '+15554021901',
    vertical: 'tax',
    title: '2025 Joint Tax Filing',
    channel: 'whatsapp',
    verifiedCount: 4,
    aiCatches: 1,
    minutesAgo: 70,
  },
  {
    id: 'req_priya_patel',
    token: 'priya-2025-tax',
    code: 'TAX-3302',
    name: 'Priya Patel',
    email: 'priya.patel@example.com',
    phone: '+15554021902',
    vertical: 'tax',
    title: '2025 Tax & 1099 Package',
    channel: 'whatsapp',
    verifiedCount: 2,
    aiCatches: 1,
    minutesAgo: 95,
  },
  {
    id: 'req_carlos_mendez',
    token: 'carlos-2025-tax',
    code: 'TAX-3303',
    name: 'Carlos Mendez',
    email: 'cmendez@example.com',
    phone: '+15554021903',
    vertical: 'tax',
    title: '2025 Contractor Tax Intake',
    channel: 'sms',
    verifiedCount: 0,
    needsReshoot: true,
    aiCatches: 1,
    minutesAgo: 120,
  },
  {
    id: 'req_hannah_brooks',
    token: 'hannah-mortgage',
    code: 'MTG-4412',
    name: 'Hannah Brooks',
    email: 'hannah.brooks@example.com',
    phone: '+15554021904',
    vertical: 'mortgage',
    title: 'FHA First-Time Buyer File',
    channel: 'whatsapp',
    verifiedCount: 3,
    aiCatches: 1,
    minutesAgo: 150,
  },
  {
    id: 'req_noah_goldstein',
    token: 'noah-2025-tax',
    code: 'TAX-3304',
    name: 'Noah Goldstein',
    email: 'noah.g@example.com',
    phone: '+15554021905',
    vertical: 'tax',
    title: '2025 Executive Compensation Return',
    channel: 'portal',
    verifiedCount: 2,
    aiCatches: 0,
    minutesAgo: 190,
  },
  {
    id: 'req_sophia_alvarez',
    token: 'sophia-2025-tax',
    code: 'TAX-3305',
    name: 'Sophia Alvarez',
    email: 'sophia.a@example.com',
    phone: '+15554021906',
    vertical: 'tax',
    title: '2025 Multi-W2 Return',
    channel: 'whatsapp',
    verifiedCount: 1,
    aiCatches: 1,
    minutesAgo: 230,
  },
  {
    id: 'req_liam_oconnor',
    token: 'liam-mortgage',
    code: 'MTG-4415',
    name: "Liam O'Connor",
    email: 'liam.oc@example.com',
    phone: '+15554021907',
    vertical: 'mortgage',
    title: 'Jumbo Loan Underwriting',
    channel: 'sms',
    verifiedCount: 2,
    aiCatches: 0,
    minutesAgo: 260,
  },
  {
    id: 'req_northstar_studio',
    token: 'northstar-assets',
    code: 'CRT-5520',
    name: 'Northstar Wellness',
    email: 'brand@northstar.example.com',
    phone: '+15554021908',
    vertical: 'creative',
    title: 'Website Launch Asset Kit',
    channel: 'portal',
    verifiedCount: 1,
    aiCatches: 0,
    minutesAgo: 310,
  },
  {
    id: 'req_aisha_mohammed',
    token: 'aisha-2025-tax',
    code: 'TAX-3306',
    name: 'Aisha Mohammed',
    email: 'aisha.m@example.com',
    phone: '+15554021909',
    vertical: 'tax',
    title: '2025 Individual + Rental Schedule E',
    channel: 'whatsapp',
    verifiedCount: 2,
    aiCatches: 1,
    minutesAgo: 340,
  },
  {
    id: 'req_ethan_wright',
    token: 'ethan-2025-tax',
    code: 'TAX-3307',
    name: 'Ethan Wright',
    email: 'ewright@example.com',
    phone: '+15554021910',
    vertical: 'tax',
    title: '2025 Tax Return Checklist',
    channel: 'sms',
    verifiedCount: 0,
    aiCatches: 0,
    minutesAgo: 380,
  },
  {
    id: 'req_chloe_bennett',
    token: 'chloe-mortgage',
    code: 'MTG-4418',
    name: 'Chloe Bennett',
    email: 'chloe.b@example.com',
    phone: '+15554021911',
    vertical: 'mortgage',
    title: 'Bridge Loan Verification',
    channel: 'whatsapp',
    verifiedCount: 1,
    needsReshoot: true,
    aiCatches: 1,
    minutesAgo: 420,
  },
  {
    id: 'req_omar_hassan',
    token: 'omar-2025-tax',
    code: 'TAX-3308',
    name: 'Omar Hassan',
    email: 'omar.h@example.com',
    phone: '+15554021912',
    vertical: 'tax',
    title: '2025 S-Corp & Personal Return',
    channel: 'whatsapp',
    verifiedCount: 2,
    aiCatches: 1,
    minutesAgo: 460,
  },
  {
    id: 'req_rachel_greenwald',
    token: 'rachel-2025-tax',
    code: 'TAX-3309',
    name: 'Rachel Greenwald',
    email: 'rachel.g@example.com',
    phone: '+15554021913',
    vertical: 'tax',
    title: '2025 Tax Prep Intake',
    channel: 'portal',
    verifiedCount: 2,
    aiCatches: 0,
    minutesAgo: 500,
  },
  {
    id: 'req_verdant_foods',
    token: 'verdant-brand',
    code: 'CRT-5524',
    name: 'Verdant Foods Co.',
    email: 'hello@verdant.example.com',
    phone: '+15554021914',
    vertical: 'creative',
    title: 'Packaging Redesign Assets',
    channel: 'whatsapp',
    verifiedCount: 1,
    aiCatches: 0,
    minutesAgo: 540,
  },
  {
    id: 'req_jordan_taylor',
    token: 'jordan-2025-tax',
    code: 'TAX-3310',
    name: 'Jordan Taylor',
    email: 'jtaylor@example.com',
    phone: '+15554021915',
    vertical: 'tax',
    title: '2025 Freelance 1099 Return',
    channel: 'sms',
    verifiedCount: 2,
    aiCatches: 1,
    minutesAgo: 600,
  },
  {
    id: 'req_nina_kovacs',
    token: 'nina-mortgage',
    code: 'MTG-4422',
    name: 'Nina Kovacs',
    email: 'nina.k@example.com',
    phone: '+15554021916',
    vertical: 'mortgage',
    title: 'Condo Pre-Approval Intake',
    channel: 'whatsapp',
    verifiedCount: 4,
    aiCatches: 1,
    minutesAgo: 650,
  },
  {
    id: 'req_benjamin_foster',
    token: 'ben-2025-tax',
    code: 'TAX-3311',
    name: 'Benjamin Foster',
    email: 'bfoster@example.com',
    phone: '+15554021917',
    vertical: 'tax',
    title: '2025 Family Tax Filing',
    channel: 'whatsapp',
    verifiedCount: 1,
    aiCatches: 0,
    minutesAgo: 700,
  },
  {
    id: 'req_kestrel_architecture',
    token: 'kestrel-brand',
    code: 'CRT-5529',
    name: 'Kestrel Architecture',
    email: 'studio@kestrel.example.com',
    phone: '+15554021918',
    vertical: 'creative',
    title: 'Portfolio Press Kit Collection',
    channel: 'portal',
    verifiedCount: 2,
    aiCatches: 0,
    minutesAgo: 750,
  },
  {
    id: 'req_grace_park',
    token: 'grace-2025-tax',
    code: 'TAX-3312',
    name: 'Grace Park',
    email: 'gpark@example.com',
    phone: '+15554021919',
    vertical: 'tax',
    title: '2025 Household W-2 Intake',
    channel: 'sms',
    verifiedCount: 2,
    aiCatches: 1,
    minutesAgo: 800,
  },
  {
    id: 'req_trevor_hughes',
    token: 'trevor-mortgage',
    code: 'MTG-4429',
    name: 'Trevor Hughes',
    email: 'thughes@example.com',
    phone: '+15554021920',
    vertical: 'mortgage',
    title: 'VA Purchase Loan Package',
    channel: 'whatsapp',
    verifiedCount: 0,
    aiCatches: 0,
    minutesAgo: 850,
  },
];

async function runSeed(): Promise<void> {
  const existingFirm = await getFirmBranding();
  if (!existingFirm) {
    await saveFirmBranding(DEFAULT_FIRM_BRANDING);
  }

  const templateMap = new Map<VerticalType, ChecklistTemplate>();
  for (const tpl of DEFAULT_TEMPLATES) {
    templateMap.set(tpl.vertical, tpl);
    await saveTemplate(tpl);
  }

  const existingRequests = await listRequests();
  if (existingRequests.length === 0) {
    const baseNow = new Date('2026-11-11T16:00:00.000Z').getTime();
    await Promise.all(
      SEED_CLIENTS.map(async (spec) => {
        const tpl = templateMap.get(spec.vertical) ?? DEFAULT_TEMPLATES[0];
        const updatedAt = new Date(baseNow - spec.minutesAgo * 60_000).toISOString();
        const req = buildRequestFromTemplate({
          id: spec.id,
          token: spec.token,
          referenceCode: spec.code,
          title: spec.title,
          template: tpl,
          clientName: spec.name,
          clientEmail: spec.email,
          clientPhone: spec.phone,
          preferredChannel: spec.channel,
          verifiedCount: spec.verifiedCount,
          needsReshootFirst: spec.needsReshoot,
          aiCatchesCount: spec.aiCatches,
          updatedAt,
        });
        await saveRequest(req);

        // Seed realistic WhatsApp/SMS intake threads on the primary showcase requests
        if (spec.id === 'req_maya_chen') {
          const msgs: ChatMessage[] = [
            {
              id: 'msg_maya_1',
              direction: 'outbound',
              channel: 'sms',
              senderLabel: 'Summit Tax Desk',
              body: 'Hi Maya! Summit Tax & Advisory here. Reply to this text with photos of your 2025 W-2, Bank Statement, and ID — no portal login needed.',
              createdAt: '2026-11-11T14:55:00.000Z',
            },
            {
              id: 'msg_maya_2',
              direction: 'inbound',
              channel: 'sms',
              senderLabel: 'Maya Chen',
              body: 'Here is my W2 from my phone',
              mediaFileName: 'w2-kitchen-table.jpg',
              createdAt: '2026-11-11T15:09:00.000Z',
            },
            {
              id: 'msg_maya_3',
              direction: 'outbound',
              channel: 'sms',
              senderLabel: 'SnapCollect AI',
              body: 'This photo is blurry (Sharpness 24/100) — Box 1 wages are unreadable. Please hold steady in brighter light and reply with a clearer snap.',
              createdAt: '2026-11-11T15:09:04.000Z',
            },
          ];
          await saveMessages(req.id, msgs);
        } else if (spec.id === 'req_marcus_vance') {
          const msgs: ChatMessage[] = [
            {
              id: 'msg_marcus_1',
              direction: 'outbound',
              channel: 'whatsapp',
              senderLabel: 'Summit Tax Desk',
              body: 'Hi Marcus! Text your 2025 tax documents straight to this WhatsApp thread (Ref: TAX-2088), or tap your mobile checklist link anytime.',
              createdAt: '2026-11-11T15:30:00.000Z',
            },
            {
              id: 'msg_marcus_2',
              direction: 'inbound',
              channel: 'whatsapp',
              senderLabel: 'Marcus Vance',
              body: 'Sending my 2024 W2 first?',
              mediaFileName: 'W2_2024_scan.png',
              createdAt: '2026-11-11T15:42:00.000Z',
            },
            {
              id: 'msg_marcus_3',
              direction: 'outbound',
              channel: 'whatsapp',
              senderLabel: 'SnapCollect AI',
              body: 'You uploaded a 2024 W-2 instead of 2025. Please reply with your 2025 Form W-2.',
              createdAt: '2026-11-11T15:42:03.000Z',
            },
            {
              id: 'msg_marcus_4',
              direction: 'inbound',
              channel: 'whatsapp',
              senderLabel: 'Marcus Vance',
              body: 'Oops! Here is the 2025 one.',
              mediaFileName: 'W2_2025_crisp.png',
              createdAt: '2026-11-11T15:45:00.000Z',
            },
            {
              id: 'msg_marcus_5',
              direction: 'outbound',
              channel: 'whatsapp',
              senderLabel: 'SnapCollect AI',
              body: 'Verified: 2025 Form W-2 (Sharpness 91/100) — checked off! Remaining: 2025 Year-End Bank Statement and Government Photo ID.',
              createdAt: '2026-11-11T15:45:02.000Z',
            },
          ];
          await saveMessages(req.id, msgs);
        }
      }),
    );

    await saveOutboxDispatch({
      id: 'out_seed_1',
      requestId: 'req_maya_chen',
      clientName: 'Maya Chen',
      channel: 'sms',
      recipient: '+15552348891',
      subject: 'Instant reshoot alert sent automatically',
      body: 'This photo is blurry (Sharpness 24/100) — reply with a clearer snap of your 2025 W-2.',
      deliveryProvider: 'simulated-outbox',
      status: 'sent',
      createdAt: '2026-11-11T15:09:05.000Z',
    });
    await saveOutboxDispatch({
      id: 'out_seed_2',
      requestId: 'req_marcus_vance',
      clientName: 'Marcus Vance',
      channel: 'whatsapp',
      recipient: '+15553910042',
      subject: 'Welcome checklist dispatched via WhatsApp',
      body: 'Hi Marcus! Text your 2025 tax documents straight to this WhatsApp thread (Ref: TAX-2088).',
      deliveryProvider: 'simulated-outbox',
      status: 'sent',
      createdAt: '2026-11-11T15:30:01.000Z',
    });
  }

  await putJson('db/seed-meta.json', { seededAt: new Date().toISOString(), count: 24 });
}

export async function ensureSeeded(): Promise<void> {
  const marker = await getJson<{ seededAt: string }>('db/seed-meta.json');
  if (marker) return;

  if (!seedPromise) {
    seedPromise = runSeed().finally(() => {
      seedPromise = null;
    });
  }
  await seedPromise;
}
