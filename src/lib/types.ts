export type VerticalType = 'tax' | 'mortgage' | 'creative' | 'general';

export type DocumentCategory =
  | 'w2'
  | '1099'
  | 'bank_statement'
  | 'government_id'
  | 'paystub'
  | 'tax_return'
  | 'brand_asset'
  | 'any';

export type IntakeChannel = 'whatsapp' | 'sms' | 'portal' | 'email';

export type VerificationStatus =
  | 'verified'
  | 'rejected_blur'
  | 'rejected_mismatch'
  | 'rejected_format'
  | 'pending_review';

export type ItemStatus = 'pending' | 'needs_reshoot' | 'verified' | 'approved_override';

export type RequestStatus = 'pending' | 'in_progress' | 'needs_reshoot' | 'complete';

export interface FirmBranding {
  id: string;
  firmName: string;
  tagline: string;
  verticalFocus: VerticalType;
  logoText: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  customDomain: string;
  senderName: string;
  dedicatedNumber: string;
  whatsappEnabled: boolean;
  hidePoweredBy: boolean;
  planName: string;
  monthlyPriceUsd: number;
  concurrentLimit: number | null; // null = Unlimited
  updatedAt: string;
}

export interface ChecklistItemDefinition {
  id: string;
  stepId: string;
  title: string;
  instructions: string;
  expectedDocType: DocumentCategory;
  expectedYear: string | null; // e.g. "2025" or null for any
  acceptedFormats: string[]; // e.g. ["image/jpeg", "image/png", "application/pdf"]
  minSharpness: number; // 0-100 threshold (default 55)
  required: boolean;
}

export interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  vertical: VerticalType;
  description: string;
  steps: ChecklistStep[];
  items: ChecklistItemDefinition[];
  defaultCadence: ReminderRule[];
  createdAt: string;
}

export interface VerificationResult {
  status: VerificationStatus;
  passed: boolean;
  headline: string;
  detail: string;
  sharpnessScore: number; // 0-100
  brightnessScore: number; // 0-100
  width: number;
  height: number;
  detectedDocType: DocumentCategory;
  detectedYear: string | null;
  extractedSummary: string;
  confidence: number; // 0-100
  engine: 'vision-ai' | 'forensic-ocr' | 'client-canvas';
  checkedAt: string;
}

export interface SubmissionRecord {
  id: string;
  itemId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  channel: IntakeChannel;
  uploadedAt: string;
  verification: VerificationResult;
}

export interface ChecklistItemState extends ChecklistItemDefinition {
  status: ItemStatus;
  submissions: SubmissionRecord[];
  latestVerification: VerificationResult | null;
}

export interface ReminderRule {
  id: string;
  dayOffset: number;
  channel: 'whatsapp' | 'sms' | 'email';
  subject: string;
  messageTemplate: string;
  sent: boolean;
  sentAt: string | null;
}

export interface ChatMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  channel: 'whatsapp' | 'sms' | 'portal';
  senderLabel: string;
  body: string;
  mediaFileName?: string;
  mediaUrl?: string;
  verification?: VerificationResult;
  createdAt: string;
}

export interface ClientRequest {
  id: string;
  token: string;
  referenceCode: string; // e.g. "TAX-4821"
  title: string;
  vertical: VerticalType;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  preferredChannel: IntakeChannel;
  status: RequestStatus;
  dueDate: string;
  steps: ChecklistStep[];
  items: ChecklistItemState[];
  reminderRules: ReminderRule[];
  autoPauseOnComplete: boolean;
  aiCatchesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxDispatch {
  id: string;
  requestId: string;
  clientName: string;
  channel: 'whatsapp' | 'sms' | 'email';
  recipient: string;
  subject: string;
  body: string;
  deliveryProvider: 'twilio' | 'resend' | 'simulated-outbox';
  status: 'sent' | 'queued';
  createdAt: string;
}

export interface DashboardMetrics {
  activeConcurrentRequests: number;
  totalRequests: number;
  completedRequests: number;
  needsReshootRequests: number;
  totalAiCatches: number;
  verifiedDocumentsCount: number;
  competitorCapThreshold: number; // e.g. 20 (Content Snare / File Request Pro cap)
  monthlyPriceUsd: number; // $25 flat
  competitorMonthlyUsd: number; // $39 average
}
