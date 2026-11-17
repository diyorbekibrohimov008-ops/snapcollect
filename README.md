# SnapCollect 🚀

> **Client Document & Asset Collection for Accounting, Mortgage, & Professional Services**  
> *Replace email attachments, chasing clients, and throttled portals with zero-login WhatsApp/SMS intake, instant AI document verification, and seasonal unlimited scaling.*

[![Live on Vercel](https://img.shields.io/badge/Vercel-Live%20Production-black?style=flat&logo=vercel)](https://snapcollect.vercel.app)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.4-blue?style=flat&logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19.3-61dafb?style=flat&logo=react)](https://react.dev)
[![TypeScript 5.8](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Tests Passing](https://img.shields.io/badge/tests-11%2F11%20passing-brightgreen?style=flat&logo=vitest)](https://vitest.dev)

---

## 🌐 Live Production

- **Production URL:** [https://snapcollect.vercel.app](https://snapcollect.vercel.app)
- **Team Alias:** [https://snapcollect-ibroximov.vercel.app](https://snapcollect-ibroximov.vercel.app)

---

## 💡 The Problem & How SnapCollect Wins

| Challenge with Incumbents (Content Snare, File Request Pro) | SnapCollect Solution |
| :--- | :--- |
| **Concurrent Request Throttles:** Plans start at $35–$42/mo with strict 20-request caps that punish accounting firms during tax season. | **Seasonal Unlimited Scaling:** Flat $25/month pricing with unlimited concurrent requests so teams never hit an artificial ceiling. |
| **Mobile & Desktop Login Friction:** Clients abandon portals because documents are on their phone cameras or paper on their desks. | **WhatsApp & SMS Intake Mode:** Clients snap and text W-2s, bank statements, and IDs directly to a dedicated business number with zero logins. |
| **No Pre-Validation:** Portals accept blurry photos or wrong tax years, forcing staff into hours of manual document review. | **Instant Pre-Validation & AI Verification:** Real-time client-side `<canvas>` 3x3 Laplacian blur detection and server-side forensic inspection immediately flag blurry uploads or wrong tax years (e.g., 2024 instead of 2025 W-2). |

---

## ✨ Features

- **Staff Command Center (`/`, `/requests/new`, `/requests/[id]`):** Real-time tracking of active requests, completion progress, pending document slots, and one-click reminders.
- **Client Mobile Upload Portal (`/c/[token]`):** Frictionless, mobile-optimized white-label checklist where clients can snap photos or drag-and-drop documents.
- **Instant Document Verification Engine:**
  - Client-side `<canvas>` sharpness score (3x3 Laplacian kernel) before upload.
  - Server-side image/PDF forensic parser inspecting document metadata, resolution, text streams, and tax year tags.
  - Optional fallback to Vercel AI Gateway / Vision LLMs.
- **WhatsApp & SMS Business Intake Studio (`/whatsapp`, `/api/webhooks/twilio`):**
  - Full production Twilio webhook handling `application/x-www-form-urlencoded` payloads and returning standard TwiML XML.
  - Built-in interactive WhatsApp smartphone simulator for instant testing with synthetic sample documents (crisp 2025 W-2, blurry W-2, wrong 2024 tax year).
- **Template Library (`/templates`):** Pre-built collection packages for Individual Tax Returns, Mortgage Loan Pre-Approval, and Creative Agency Brand Onboarding.
- **White-Label Agency Branding & Reminders (`/settings`, `/api/reminders/cron`):**
  - Custom firm name, taglines, primary colors, and email/SMS sender identities.
  - Automated reminder cadence with daily cron triggers (`0 14 * * *`).
- **Enterprise-Grade Private Storage (`/api/files/[...key]`):**
  - Integrated with Private `@vercel/blob` storage.
  - Path-traversal safeguards and streaming file access.

---

## 🛠 Tech Stack

- **Framework:** [Next.js 16.4](https://nextjs.org/) (App Router, Turbopack)
- **UI:** [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide Icons](https://lucide.dev/)
- **Storage:** [@vercel/blob](https://vercel.com/docs/storage/vercel-blob) (Private store) with local file-system fallback for development
- **Document Processing:** `pngjs`, `jpeg-js`, canvas Laplacian analysis
- **Validation & Types:** [Zod](https://zod.dev/), TypeScript 5.8
- **Testing:** [Vitest 3.2](https://vitest.dev/)
- **Deployment:** [Vercel](https://vercel.com/) with automated daily cron jobs

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/diyorbekibrohimov008-ops/snapcollect.git
cd snapcollect
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access token for private file storage | Optional (falls back to `.snapcollect-data/`) |
| `CRON_SECRET` | Secret key authenticating `/api/reminders/cron` | Optional |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID for live SMS/WhatsApp | Optional (simulator works out of the box) |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token for live webhook verification | Optional |
| `TWILIO_PHONE_NUMBER` | Dedicated business phone number | Optional |
| `RESEND_API_KEY` | Resend API key for automated reminder emails | Optional |

> **Note:** The application works completely out-of-the-box in local development with no external API keys required!

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Run the test suite:

```bash
npm test
```

Run TypeScript verification:

```bash
npm run lint # or npx tsc --noEmit
```

Run production build check:

```bash
npm run build
```

---

## 📄 License

MIT © [Diyorbek Ibrohimov](https://github.com/diyorbekibrohimov008-ops)
