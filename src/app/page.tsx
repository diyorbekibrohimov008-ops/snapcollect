'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ExternalLink,
  Infinity as InfinityIcon,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import type {
  ClientRequest,
  DashboardMetrics,
  FirmBranding,
  OutboxDispatch,
} from '@/lib/types';

export default function CommandCenterPage() {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [firm, setFirm] = useState<FirmBranding | null>(null);
  const [outbox, setOutbox] = useState<OutboxDispatch[]>([]);
  const [loading, setLoading] = useState(true);

  const [verticalFilter, setVerticalFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams();
    if (verticalFilter !== 'all') params.set('vertical', verticalFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());

    const [reqResp, outboxResp] = await Promise.all([
      fetch(`/api/requests?${params.toString()}`, { cache: 'no-store' }),
      fetch('/api/reminders/run', { cache: 'no-store' }),
    ]);

    const reqData = await reqResp.json();
    const outboxData = await outboxResp.json();
    setRequests(reqData.requests || []);
    setMetrics(reqData.metrics || null);
    setFirm(reqData.firm || null);
    setOutbox(outboxData.outbox || []);
    setLoading(false);
  }, [verticalFilter, statusFilter, searchQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  }

  async function launchBulkTaxBatch() {
    setBusyAction('bulk');
    try {
      const resp = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'bulk',
          templateId: 'tpl_tax_2025',
          bulkCount: 10,
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        showToast(
          `Launched ${data.count} concurrent tax season requests! Now running ${data.metrics.activeConcurrentRequests} active requests with zero throttling.`,
        );
        await loadData();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function runRemindersNow() {
    setBusyAction('reminders');
    try {
      const resp = await fetch('/api/reminders/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (resp.ok) {
        showToast(`Dispatched ${data.processedCount} scheduled client reminder(s).`);
        await loadData();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function sendNudge(reqId: string, clientName: string) {
    setBusyAction(reqId);
    try {
      const resp = await fetch('/api/reminders/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: reqId }),
      });
      if (resp.ok) {
        showToast(`Instant nudge sent to ${clientName}.`);
        await loadData();
      }
    } finally {
      setBusyAction(null);
    }
  }

  const sampleToken = requests[0]?.token || 'marcus-2025-tax';

  return (
    <AppShell
      firm={firm}
      activeCount={metrics?.activeConcurrentRequests ?? 24}
      sampleToken={sampleToken}
    >
      {toast && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-xs">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {toast}
          </span>
        </div>
      )}

      {/* Hero Switching Banner */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Built to beat Content Snare &amp; File Request Pro
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Collect verified client documents over WhatsApp, SMS &amp; zero-login mobile
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Clients snap and text W-2s, bank statements, or IDs straight to{' '}
              <span className="font-mono font-semibold text-white">
                {firm?.dedicatedNumber || '+1 (555) 019-2834'}
              </span>
              . Instant AI rejects blurry photos &amp; wrong tax years before staff ever touch them — at a flat{' '}
              <strong className="text-emerald-300">$25/month</strong> with zero concurrent request caps.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/requests/new"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              New Checklist Request
            </Link>
            <Link
              href="/whatsapp"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              <MessageSquare className="h-4 w-4 text-emerald-400" />
              Try WhatsApp / SMS Mode
            </Link>
          </div>
        </div>
      </section>

      {/* KPI Strip */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Concurrent Active Requests
            </span>
            <InfinityIcon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-slate-900">
              {metrics?.activeConcurrentRequests ?? '—'}
            </span>
            <span className="text-xs font-semibold text-emerald-600">/ ∞ Unlimited</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Legacy portals throttle at 20 concurrent requests. You have zero ceilings.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Instant AI Bad-Upload Catches
            </span>
            <ShieldCheck className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-slate-900">
              {metrics?.totalAiCatches ?? '—'}
            </span>
            <span className="text-xs font-semibold text-amber-700">blur &amp; wrong-year blocks</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Auto-coached clients before manual staff review was wasted.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Verified Checklist Items
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-slate-900">
              {metrics?.verifiedDocumentsCount ?? '—'}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              across {metrics?.totalRequests ?? 0} total
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Sharpness, format &amp; tax-year checked automatically on arrival.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Seasonal Flat Pricing
            </span>
            <Zap className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-emerald-950">
              $25
            </span>
            <span className="text-xs font-semibold text-emerald-800">/mo flat</span>
          </div>
          <p className="mt-1.5 text-xs text-emerald-800">
            Save vs $35–$42/mo throttled tools during tax season spikes.
          </p>
        </div>
      </section>

      {/* Seasonal Scaling & Cadence Action Bar */}
      <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search client, phone, or ref code..."
              className="h-9 w-64 rounded-xl border border-slate-200 pl-9 pr-3 text-xs outline-hidden focus:border-slate-900"
            />
          </div>

          <select
            value={verticalFilter}
            onChange={(e) => setVerticalFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="all">All Verticals</option>
            <option value="tax">Tax &amp; Accounting</option>
            <option value="mortgage">Mortgage Brokers</option>
            <option value="creative">Creative Agencies</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="needs_reshoot">Needs Reshoot (AI Caught)</option>
            <option value="in_progress">In Progress</option>
            <option value="pending">Pending</option>
            <option value="complete">Complete</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={launchBulkTaxBatch}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            {busyAction === 'bulk' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Layers className="h-3.5 w-3.5 text-emerald-600" />
            )}
            Launch 10-Client Tax Batch (No Cap)
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={runRemindersNow}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busyAction === 'reminders' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bell className="h-3.5 w-3.5 text-slate-600" />
            )}
            Run Due Reminders Now
          </button>
        </div>
      </section>

      {/* Main Content Split: Requests Pipeline + Outbox Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="min-w-0 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-bold text-slate-900">
                Active Client Collection Pipeline ({requests.length})
              </h2>
              <span className="text-xs text-slate-500">
                Click any client to inspect AI checks or test WhatsApp intake
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading client pipeline…
              </div>
            ) : requests.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No matching requests. Try clearing filters or launching a new checklist.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {requests.map((req) => {
                  const verified = req.items.filter(
                    (it) => it.status === 'verified' || it.status === 'approved_override',
                  ).length;
                  const total = req.items.length;
                  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;

                  const statusBadge =
                    req.status === 'complete'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : req.status === 'needs_reshoot'
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : req.status === 'in_progress'
                          ? 'bg-sky-50 text-sky-900 border-sky-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <div
                      key={req.id}
                      className="flex flex-col justify-between gap-3 px-5 py-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/requests/${req.id}`}
                            className="text-sm font-bold text-slate-900 hover:text-emerald-700"
                          >
                            {req.clientName}
                          </Link>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
                            {req.referenceCode}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge}`}
                          >
                            {req.status === 'needs_reshoot'
                              ? 'AI Flagged Reshoot'
                              : req.status === 'in_progress'
                                ? 'In Progress'
                                : req.status === 'complete'
                                  ? 'Complete'
                                  : 'Pending'}
                          </span>
                          {req.aiCatchesCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                              <AlertTriangle className="h-3 w-3" />
                              {req.aiCatchesCount} AI catch
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 truncate text-xs text-slate-600">
                          {req.title} · <span className="font-mono">{req.clientPhone}</span> ·{' '}
                          <span className="uppercase">{req.preferredChannel}</span>
                        </p>

                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-1.5 w-36 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-semibold text-slate-600">
                            {verified}/{total} verified
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/requests/${req.id}`}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Workbench
                        </Link>
                        <Link
                          href={`/c/${req.token}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          Portal
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        <button
                          type="button"
                          disabled={busyAction === req.id}
                          onClick={() => sendNudge(req.id, req.clientName)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          <Send className="h-3 w-3" />
                          Nudge
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Live Automated Reminder Outbox */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Automated Reminder Outbox</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Auto-pauses on completion
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {outbox.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{item.clientName}</span>
                    <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-slate-600">
                      {item.channel}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-slate-700">{item.subject}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
