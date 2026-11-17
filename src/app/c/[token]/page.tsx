'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileCheck2,
  Loader2,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { SampleDocKit } from '@/components/SampleDocKit';
import { verifyFileClientSide } from '@/lib/client-verify';
import type { SampleDocKind } from '@/lib/sample-docs';
import type {
  ChecklistItemState,
  ClientRequest,
  FirmBranding,
  VerificationResult,
} from '@/lib/types';

export default function ClientMobilePortalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [request, setRequest] = useState<ClientRequest | null>(null);
  const [firm, setFirm] = useState<FirmBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [preCheckAlerts, setPreCheckAlerts] = useState<
    Record<string, { file: File; result: VerificationResult }>
  >({});
  const [selectedSampleTargetId, setSelectedSampleTargetId] = useState<string>('');

  const loadPortal = useCallback(async () => {
    const resp = await fetch(`/api/requests/portal/${token}`, { cache: 'no-store' });
    if (!resp.ok) {
      setError('This checklist link could not be found or has expired.');
      setLoading(false);
      return;
    }
    const data = await resp.json();
    setRequest(data.request);
    setFirm(data.firm);
    setActiveStepId((prev) => prev || data.request?.steps?.[0]?.id || null);
    setSelectedSampleTargetId((prev) => prev || data.request?.items?.[0]?.id || '');
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  async function uploadToServer(itemId: string, file: File) {
    if (!request) return;
    setBusyItemId(itemId);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('itemId', itemId);
      form.append('channel', 'portal');

      const resp = await fetch(`/api/requests/${request.id}/upload`, {
        method: 'POST',
        body: form,
      });
      const data = await resp.json();
      if (data.request) {
        setRequest(data.request);
      }
      if (data.verification && !data.verification.passed) {
        setPreCheckAlerts((prev) => ({
          ...prev,
          [itemId]: { file, result: data.verification },
        }));
      } else {
        setPreCheckAlerts((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleFileSelected(item: ChecklistItemState, file: File) {
    setBusyItemId(item.id);
    try {
      // Tier 1: Instant client-side <canvas> blur, format, and year pre-validation BEFORE upload!
      const clientCheck = await verifyFileClientSide(file, item);
      if (!clientCheck.passed) {
        setPreCheckAlerts((prev) => ({
          ...prev,
          [item.id]: { file, result: clientCheck },
        }));
        setBusyItemId(null);
        return;
      }

      // Passed client pre-check -> upload to server for AI verification + private storage
      await uploadToServer(item.id, file);
    } catch {
      setBusyItemId(null);
    }
  }

  async function handleSamplePick(file: File, _kind: SampleDocKind) {
    if (!request) return;
    const item =
      request.items.find((it) => it.id === selectedSampleTargetId) ?? request.items[0];
    if (!item) return;
    setActiveStepId(item.stepId);
    await handleFileSelected(item, file);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading secure checklist...
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <ShieldAlert className="mb-3 h-10 w-10 text-rose-500" />
        <h1 className="text-lg font-bold text-slate-900">Portal Link Unavailable</h1>
        <p className="mt-1 text-sm text-slate-600">{error}</p>
        <Link href="/" className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
          Return to Command Center
        </Link>
      </div>
    );
  }

  const primaryColor = firm?.primaryColor || '#0F172A';
  const accentColor = firm?.accentColor || '#10B981';

  const verifiedCount = request.items.filter(
    (it) => it.status === 'verified' || it.status === 'approved_override',
  ).length;
  const totalCount = request.items.length;
  const pct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

  const currentStep =
    request.steps.find((s) => s.id === activeStepId) ?? request.steps[0];
  const stepItems = request.items.filter((it) => it.stepId === currentStep?.id);

  return (
    <div className="min-h-screen bg-slate-100/80 pb-12">
      {/* White-Label Firm Header */}
      <header className="px-4 py-5 text-white shadow-sm" style={{ backgroundColor: primaryColor }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-slate-950 shadow-xs"
              style={{ backgroundColor: accentColor }}
            >
              {firm?.logoText || 'SC'}
            </div>
            <div>
              <h1 className="text-base font-bold">{firm?.firmName || 'Summit Tax & Advisory'}</h1>
              <p className="text-xs opacity-80">
                Zero-login secure intake · {firm?.customDomain || 'intake.summittax.com'}
              </p>
            </div>
          </div>

          <Link
            href={`/requests/${request.id}`}
            className="rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25"
          >
            Staff View
          </Link>
        </div>
      </header>

      <main className="mx-auto -mt-3 max-w-2xl px-4">
        {/* Progress & Greeting Card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
                Ref {request.referenceCode} · Due {request.dueDate}
              </span>
              <h2 className="mt-2 text-lg font-bold text-slate-900">
                Hi {request.clientName.split(' ')[0]}, here&apos;s your {request.title}
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Instant AI checks photo sharpness and tax year right on your device before submission.
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono text-2xl font-bold text-slate-900">
                {verifiedCount}/{totalCount}
              </span>
              <p className="text-[11px] text-slate-500">verified</p>
            </div>
          </div>

          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: accentColor }}
            />
          </div>

          {/* WhatsApp / SMS Zero-Portal Friction Banner */}
          <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div className="text-xs text-emerald-950">
                <strong>Prefer WhatsApp or SMS?</strong> Snap and text your photos straight to{' '}
                <span className="font-mono font-bold">
                  {firm?.dedicatedNumber || '+1 (555) 019-2834'}
                </span>{' '}
                with code <span className="font-mono font-bold">{request.referenceCode}</span> — no portal needed.
              </div>
            </div>
            <Link
              href={`/whatsapp?requestId=${request.id}`}
              className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Open Text Mode
            </Link>
          </div>
        </section>

        {/* Multi-Step Tabs */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {request.steps.map((step) => {
            const isActive = step.id === currentStep?.id;
            const stepItemList = request.items.filter((it) => it.stepId === step.id);
            const stepDone = stepItemList.filter(
              (it) => it.status === 'verified' || it.status === 'approved_override',
            ).length;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStepId(step.id)}
                className={`flex-1 rounded-xl border px-3.5 py-2.5 text-left transition ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{step.title}</span>
                  <span className="font-mono text-[11px] opacity-80">
                    {stepDone}/{stepItemList.length}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] opacity-75">{step.description}</p>
              </button>
            );
          })}
        </div>

        {/* Checklist Items */}
        <section className="mt-4 flex flex-col gap-3">
          {stepItems.map((item) => {
            const isVerified =
              item.status === 'verified' || item.status === 'approved_override';
            const isBusy = busyItemId === item.id;
            const alertObj = preCheckAlerts[item.id];
            const latestVerif = alertObj?.result ?? item.latestVerification;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border bg-white p-5 shadow-2xs transition ${
                  isVerified
                    ? 'border-emerald-200'
                    : alertObj || item.status === 'needs_reshoot'
                      ? 'border-amber-300'
                      : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                      {item.required && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{item.instructions}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">
                      Expected: {item.expectedDocType.toUpperCase()}
                      {item.expectedYear ? ` · Year ${item.expectedYear}` : ''} · Min sharpness{' '}
                      {item.minSharpness}/100
                    </p>
                  </div>

                  {isVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : item.status === 'needs_reshoot' || alertObj ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Action Needed
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      Waiting
                    </span>
                  )}
                </div>

                {/* Instant AI Feedback Alert */}
                {latestVerif && (
                  <div
                    className={`mt-3 rounded-xl border p-3 text-xs ${
                      latestVerif.passed
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                        : 'border-amber-300 bg-amber-50 text-amber-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {latestVerif.passed ? (
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        )}
                        <div>
                          <p className="font-bold">{latestVerif.headline}</p>
                          <p className="mt-0.5 opacity-90">{latestVerif.detail}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded bg-white/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                        {latestVerif.sharpnessScore}/100 · {latestVerif.engine}
                      </span>
                    </div>

                    {alertObj && !latestVerif.passed && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById(
                              `file-input-${item.id}`,
                            ) as HTMLInputElement | null;
                            input?.click();
                          }}
                          className="rounded-lg bg-amber-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-amber-800"
                        >
                          Retake / Choose Clearer File
                        </button>
                        <button
                          type="button"
                          onClick={() => void uploadToServer(item.id, alertObj.file)}
                          className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          Upload Anyway for Manual Review
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Uploaded File Preview */}
                {item.submissions[0] && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    {item.submissions[0].mimeType.startsWith('image/') && (
                      <img
                        src={`/api/files/${item.submissions[0].storageKey}`}
                        alt={item.submissions[0].fileName}
                        className="h-14 w-20 rounded-lg border border-slate-200 bg-white object-contain"
                      />
                    )}
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="truncate font-semibold text-slate-800">
                        {item.submissions[0].fileName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Uploaded via {item.submissions[0].channel.toUpperCase()} ·{' '}
                        {Math.round(item.submissions[0].sizeBytes / 1024)} KB
                      </p>
                    </div>
                  </div>
                )}

                {/* Mobile Camera & File Input */}
                <div className="mt-4">
                  <input
                    id={`file-input-${item.id}`}
                    type="file"
                    accept="image/*,.pdf"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileSelected(item, file);
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor={`file-input-${item.id}`}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold transition ${
                      isBusy
                        ? 'bg-slate-200 text-slate-600'
                        : isVerified
                          ? 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Running instant AI sharpness &amp; year verification...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        <Upload className="h-4 w-4" />
                        {isVerified ? 'Replace Verified Document' : 'Snap Photo or Upload File'}
                      </>
                    )}
                  </label>
                </div>
              </div>
            );
          })}
        </section>

        {/* Built-in Test Kit for Instant Demo */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              Test Instant Client-Side AI Validation
            </span>
            <select
              value={selectedSampleTargetId}
              onChange={(e) => setSelectedSampleTargetId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {request.items.map((it) => (
                <option key={it.id} value={it.id}>
                  Target: {it.title}
                </option>
              ))}
            </select>
          </div>
          <SampleDocKit onSelectFile={handleSamplePick} disabled={busyItemId !== null} />
        </section>

        {!firm?.hidePoweredBy && (
          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
            <FileCheck2 className="h-3.5 w-3.5" />
            Secured by SnapCollect · Private Encrypted Storage
          </p>
        )}
      </main>
    </div>
  );
}
