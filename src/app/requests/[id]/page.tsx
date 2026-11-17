'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ThumbsUp,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { WhatsAppPhoneSimulator } from '@/components/WhatsAppPhoneSimulator';
import type { ChatMessage, ClientRequest, FirmBranding } from '@/lib/types';

export default function RequestWorkbenchPage() {
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  const [request, setRequest] = useState<ClientRequest | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [firm, setFirm] = useState<FirmBranding | null>(null);
  const [activeCount, setActiveCount] = useState(24);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadRequest = useCallback(async () => {
    const [detailResp, listResp] = await Promise.all([
      fetch(`/api/requests/${requestId}`, { cache: 'no-store' }),
      fetch('/api/requests', { cache: 'no-store' }),
    ]);
    if (detailResp.ok) {
      const detail = await detailResp.json();
      setRequest(detail.request);
      setMessages(detail.messages || []);
      setFirm(detail.firm || null);
    }
    if (listResp.ok) {
      const list = await listResp.json();
      setActiveCount(list.metrics?.activeConcurrentRequests ?? 24);
    }
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  async function overrideItem(itemId: string, decision: 'approve' | 'request_reshoot') {
    if (!request) return;
    setBusy(itemId);
    try {
      const resp = await fetch(`/api/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'override_item',
          itemId,
          decision,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setRequest(data.request);
        setMessages(data.messages || []);
      }
    } finally {
      setBusy(null);
    }
  }

  async function triggerNextReminder() {
    if (!request) return;
    setBusy('reminder');
    try {
      const resp = await fetch('/api/reminders/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: request.id }),
      });
      if (resp.ok) {
        await loadRequest();
      }
    } finally {
      setBusy(null);
    }
  }

  function copyPortalLink() {
    if (!request || typeof window === 'undefined') return;
    const url = `${window.location.origin}/c/${request.token}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) {
    return (
      <AppShell firm={firm} activeCount={activeCount}>
        <div className="flex items-center justify-center py-24 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading request workbench...
        </div>
      </AppShell>
    );
  }

  if (!request) {
    return (
      <AppShell firm={firm} activeCount={activeCount}>
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-900">Request not found.</p>
          <Link href="/" className="mt-3 inline-block text-xs font-semibold text-emerald-700">
            ← Back to Command Center
          </Link>
        </div>
      </AppShell>
    );
  }

  const verifiedCount = request.items.filter(
    (it) => it.status === 'verified' || it.status === 'approved_override',
  ).length;

  return (
    <AppShell firm={firm} activeCount={activeCount} sampleToken={request.token}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Command Center
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">
              {request.clientName} — {request.title}
            </h1>
            <span className="rounded-md bg-slate-200/80 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
              {request.referenceCode}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            {request.clientEmail} · <span className="font-mono">{request.clientPhone}</span> ·{' '}
            {verifiedCount}/{request.items.length} items verified · {request.aiCatchesCount} AI bad-upload catches
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyPortalLink}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? 'Copied Link!' : 'Copy Client Link'}
          </button>
          <Link
            href={`/c/${request.token}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Open Zero-Login Portal
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Multi-Step Checklist Review + Reminder Cadence */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {request.steps.map((step) => {
            const stepItems = request.items.filter((it) => it.stepId === step.id);
            return (
              <section
                key={step.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
              >
                <h2 className="text-sm font-bold text-slate-900">{step.title}</h2>
                <p className="text-xs text-slate-500">{step.description}</p>

                <div className="mt-4 flex flex-col gap-3">
                  {stepItems.map((item) => {
                    const ok =
                      item.status === 'verified' || item.status === 'approved_override';
                    const latestSub = item.submissions[0];
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-4 ${
                          ok
                            ? 'border-emerald-200 bg-emerald-50/40'
                            : item.status === 'needs_reshoot'
                              ? 'border-amber-300 bg-amber-50/40'
                              : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                            <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                              Expects: {item.expectedDocType.toUpperCase()}
                              {item.expectedYear ? ` (${item.expectedYear})` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {!ok && (
                              <button
                                type="button"
                                disabled={busy === item.id}
                                onClick={() => overrideItem(item.id, 'approve')}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50"
                              >
                                <ThumbsUp className="h-3 w-3" />
                                Approve
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busy === item.id}
                              onClick={() => overrideItem(item.id, 'request_reshoot')}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-50"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Request Reshoot
                            </button>
                          </div>
                        </div>

                        {item.latestVerification && (
                          <div
                            className={`mt-2.5 flex items-start gap-2 rounded-lg p-2.5 text-xs ${
                              item.latestVerification.passed
                                ? 'bg-emerald-100/70 text-emerald-950'
                                : 'bg-amber-100/80 text-amber-950'
                            }`}
                          >
                            {item.latestVerification.passed ? (
                              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                            ) : (
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-bold">{item.latestVerification.headline}</p>
                              <p className="mt-0.5 text-[11px] opacity-90">
                                {item.latestVerification.extractedSummary}
                              </p>
                            </div>
                          </div>
                        )}

                        {latestSub && (
                          <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
                            {latestSub.mimeType.startsWith('image/') && (
                              <img
                                src={`/api/files/${latestSub.storageKey}`}
                                alt={latestSub.fileName}
                                className="h-14 w-20 rounded border border-slate-200 object-contain"
                              />
                            )}
                            <div className="min-w-0 flex-1 text-[11px]">
                              <a
                                href={`/api/files/${latestSub.storageKey}`}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate font-semibold text-slate-900 underline"
                              >
                                {latestSub.fileName}
                              </a>
                              <p className="text-slate-500">
                                Channel: {latestSub.channel.toUpperCase()} ·{' '}
                                {Math.round(latestSub.sizeBytes / 1024)} KB
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Automated Reminder Schedule */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">Automated Reminder Cadence</h2>
              </div>
              <button
                type="button"
                disabled={busy === 'reminder'}
                onClick={triggerNextReminder}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {busy === 'reminder' ? 'Sending...' : 'Trigger Next Reminder Now'}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {request.reminderRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-700">Day {rule.dayOffset}</span>{' '}
                    <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-slate-600">
                      {rule.channel}
                    </span>{' '}
                    <span className="font-medium text-slate-900">{rule.subject}</span>
                  </div>
                  {rule.sent ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Sent
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400">Scheduled</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Embedded Live WhatsApp / SMS Client Simulator */}
        <aside className="lg:col-span-5">
          <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <h2 className="mb-1 text-sm font-bold text-slate-900">
              Live WhatsApp / SMS Client Thread
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              Simulate {request.clientName.split(' ')[0]} snapping a photo from their phone and watch AI check &amp;
              sync the checklist immediately.
            </p>
            <WhatsAppPhoneSimulator
              request={request}
              messages={messages}
              dedicatedNumber={firm?.dedicatedNumber || '+1 (555) 019-2834'}
              firmName={firm?.firmName || 'Summit Tax & Advisory'}
              onUpdated={(updatedReq, updatedMsgs) => {
                setRequest(updatedReq);
                setMessages(updatedMsgs);
              }}
            />
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
