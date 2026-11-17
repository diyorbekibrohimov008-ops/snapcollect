# SnapCollect Full MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy **SnapCollect**, a full-stack client document & asset collection SaaS MVP that matches Content Snare / File Request Pro's multi-step checklist builder, automated reminders, and white-label branding while beating them on WhatsApp/SMS uploads, instant AI document verification, and flat \$25/month unlimited concurrent requests.

**Architecture:** Next.js App Router (TypeScript + Tailwind CSS v4) running on Node.js 24 on Vercel Hobby (free, 24/7 online). Persistent storage uses a unified `StoreAdapter` backed by private **Vercel Blob** (`@vercel/blob`) in production and local filesystem (`.snapcollect-data/`) during local dev and Vitest runs. Document verification operates in two real tiers: (1) instant client-side `<canvas>` Laplacian sharpness, luminance, format, and filename/year pre-validation before upload, and (2) server-side pixel/PDF forensic extraction paired with optional multimodal Vision LLM (`ai` + `@ai-sdk/gateway`) for semantic verification across both web uploads and inbound Twilio WhatsApp/SMS webhooks (`POST /api/webhooks/twilio` returning TwiML).

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS v4, `@vercel/blob`, `ai`, `@ai-sdk/gateway`, `lucide-react`, `pngjs`, `jpeg-js`, `zod`, `vitest`.

## Global Constraints
- Pricing & Scaling: Flat \$25/month plan with **unlimited concurrent active requests** (no 20-request cap). Seed 24 active concurrent requests across Tax, Mortgage, and Creative Agency verticals to prove seasonal scaling immediately.
- Zero-Login Client Capture: `/c/[token]` requires zero authentication, inherits live white-label firm branding, and offers one-tap mobile camera upload plus WhatsApp/SMS intake routing.
- Instant AI Verification: Reject blurry photos (`"This photo is blurry..."`) and year/document mismatches (`"You uploaded a 2024 W-2 instead of 2025."`) both client-side and server-side (and in WhatsApp/SMS replies).
- Privacy: Never store client documents in unauthenticated public Blob buckets; always store with `access: 'private'` and stream through `/api/files/[...key]`.
- Deployment: Must build cleanly (`npm run build`), pass all unit/API tests (`npm test`), and deploy live to Vercel production (`24/7` online, free Hobby tier) with verified HTTP 200 responses.

## Review Focus
1. **Concurrent Request Write Isolation:** Two clients uploading documents via `/c/[token]` and `/api/webhooks/twilio` simultaneously must not clobber each other's request records — store each request, message thread, and outbox record under isolated blob keys rather than a single monolithic `db.json`.
2. **Corrupt, Oversized, or Unsupported Files:** Uploading a zero-byte file, corrupt image, or non-image/non-PDF payload to `/api/requests/[id]/upload` or `/api/webhooks/twilio` must return a clear 400/422 validation error instead of crashing the decoder.
3. **Wrong-Year vs. Valid-Year Detection:** Uploading a `2024 W-2` (via PNG/PDF text or metadata/filename) to a slot expecting `2025 W-2` must explicitly report `"You uploaded a 2024 W-2 instead of 2025"` and mark status `needs_reshoot` instead of `verified`.
4. **Twilio Webhook Form-Encoded & JSON Compatibility:** `POST /api/webhooks/twilio` must accept both real Twilio `application/x-www-form-urlencoded` requests (returning `application/xml` TwiML) and JSON simulator payloads (returning JSON + TwiML preview), without breaking on missing media.
5. **Private Blob Streaming & Path Traversal Prevention:** `/api/files/[...key]` must sanitize keys (block `..`) and stream `get(pathname, { access: 'private', useCache: false })` cleanly with `X-Content-Type-Options: nosniff`.

---

### Task 1: Project Configuration & Domain Types
**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vercel.json`, `vitest.config.ts`
- Create: `src/lib/types.ts`

- [ ] **Step 1:** Configure Next.js, TypeScript, Tailwind CSS v4, Vitest, and `vercel.json` schedule for `/api/reminders/cron`.
- [ ] **Step 2:** Define strict TypeScript schemas in `src/lib/types.ts` (`FirmBranding`, `ChecklistTemplate`, `ChecklistStep`, `ChecklistItem`, `ClientRequest`, `SubmissionRecord`, `VerificationResult`, `ChatMessage`, `ReminderRule`, `OutboxDispatch`).

### Task 2: Storage Adapter (`@vercel/blob` Private + Local Fallback) & Seed Engine
**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/lib/seed.ts`
- Test: `src/lib/__tests__/storage.test.ts`

- [ ] **Step 1:** Write failing tests verifying isolated record CRUD, binary file put/get, path sanitization, and 24-request seasonal seeding idempotency.
- [ ] **Step 2:** Implement `StoreAdapter` using `@vercel/blob` (`access: 'private'`, `allowOverwrite: true`, `addRandomSuffix: false`, `useCache: false`) when `BLOB_READ_WRITE_TOKEN` is set, and `.snapcollect-data/` filesystem persistence locally.
- [ ] **Step 3:** Implement `ensureSeeded()` creating default firm white-label config, 3 vertical templates (Tax, Mortgage, Creative Agency), and 24 active concurrent requests across Tax Season, Mortgage, and Brand Onboarding.

### Task 3: Two-Tier Instant AI Document Verification Engine
**Files:**
- Create: `src/lib/client-verify.ts` (browser `<canvas>` Laplacian blur, luminance, PDF/text scan)
- Create: `src/lib/server-verify.ts` (server `pngjs`/`jpeg-js` Laplacian sharpness, PDF ASCII/stream text & year/type detection, plus Vercel AI Gateway multimodal fallback)
- Create: `src/lib/sample-docs.ts` (programmatic real PNG generator for 5 testable documents: Crisp 2025 W-2, Blurry W-2, Wrong-Year 2024 W-2, Crisp 2025 Bank Statement, Crisp Driver ID)
- Test: `src/lib/__tests__/server-verify.test.ts`

- [ ] **Step 1:** Write failing unit tests for server verification: crisp 2025 W-2 -> `verified`, blurry W-2 -> `rejected_blur` with `"This photo is blurry"`, 2024 W-2 when expecting 2025 -> `rejected_mismatch` with `"You uploaded a 2024 W-2 instead of 2025"`, and corrupt buffer -> safe rejection.
- [ ] **Step 2:** Implement `verifyDocumentServer()` and `generateSampleDocPng()` in pure TypeScript (`pngjs`/`jpeg-js` + optional `ai` `@ai-sdk/gateway`).
- [ ] **Step 3:** Implement `verifyFileClientSide()` using `<canvas>` 3x3 Laplacian variance + brightness/resolution + PDF ASCII scan.

### Task 4: Backend API Routes & Twilio / Reminder Engines
**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/firm/route.ts`
- Create: `src/app/api/templates/route.ts`
- Create: `src/app/api/requests/route.ts`
- Create: `src/app/api/requests/[id]/route.ts`
- Create: `src/app/api/requests/[id]/upload/route.ts`
- Create: `src/app/api/requests/portal/[token]/route.ts`
- Create: `src/app/api/files/[...key]/route.ts`
- Create: `src/app/api/webhooks/twilio/route.ts`
- Create: `src/app/api/reminders/run/route.ts`
- Create: `src/app/api/reminders/cron/route.ts`
- Test: `src/lib/__tests__/api-flows.test.ts`

- [ ] **Step 1:** Write failing integration tests covering request creation, bulk batch launch (proving >20 concurrent requests), upload verification & rejection, Twilio WhatsApp/SMS TwiML responses, reminder cadence execution, and white-label settings updates.
- [ ] **Step 2:** Implement all route handlers cleanly with Zod validation, safe error handling, Twilio TwiML builder, and Resend/Twilio optional dispatchers + persistent outbox logging.

### Task 5: Multi-Surface Frontend UI
**Files:**
- Create: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/components/AppShell.tsx`, `src/components/SampleDocKit.tsx`, `src/components/SwitchCompareModal.tsx`, `src/components/WhatsAppPhoneSimulator.tsx`
- Create: `src/app/page.tsx` (Firm Command Center + 24+ active requests pipeline + bulk launch + AI catch KPIs)
- Create: `src/app/requests/new/page.tsx` (Multi-step checklist builder + reminder cadence builder + templates)
- Create: `src/app/requests/[id]/page.tsx` (Review Workbench + live WhatsApp/SMS side panel + reminder log)
- Create: `src/app/c/[token]/page.tsx` (White-label zero-login mobile portal + instant client-side AI validation + sample doc kit)
- Create: `src/app/whatsapp/page.tsx` (Dedicated WhatsApp/SMS Upload Studio + Twilio webhook inspector)
- Create: `src/app/templates/page.tsx` (Vertical templates manager)
- Create: `src/app/settings/page.tsx` (White-label branding studio + \$25/mo unlimited billing calculator + integrations & outbox)

### Task 6: Verification, Build & Vercel Production Deployment
- [ ] **Step 1:** Run `npm test` (Vitest) and fix any issues until 100% pass.
- [ ] **Step 2:** Run `npm run build` and verify zero TypeScript/ESLint/Next.js build errors.
- [ ] **Step 3:** Create Vercel project `snapcollect` + Private Blob store + `CRON_SECRET` via Vercel MCP.
- [ ] **Step 4:** Upload & deploy production build via Vercel MCP (`upload_file` + `create_deployment`), inspect build logs until `READY`, and verify all live production URLs and APIs (`/` `/c/[token]` `/whatsapp` `/settings` `/api/health` `/api/webhooks/twilio`).
