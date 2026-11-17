'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Infinity as InfinityIcon,
  Loader2,
  Palette,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import type { FirmBranding, OutboxDispatch } from '@/lib/types';

export default function SettingsPage() {
  const [firm, setFirm] = useState<FirmBranding | null>(null);
  const [activeCount, setActiveCount] = useState(24);
  const [outbox, setOutbox] = useState<OutboxDispatch[]>([]);
  const [health, setHealth] = useState<{
    storage?: string;
    aiVisionConfigured?: boolean;
    twilioConfigured?: boolean;
    resendConfigured?: boolean;
  } | null>(null);

  const [seasonalClients, setSeasonalClients] = useState(45);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    async function load() {
      const [firmResp, reqResp, healthResp, outboxResp] = await Promise.all([
        fetch('/api/firm', { cache: 'no-store' }),
        fetch('/api/requests', { cache: 'no-store' }),
        fetch('/api/health', { cache: 'no-store' }),
        fetch('/api/reminders/run', { cache: 'no-store' }),
      ]);
      const firmData = await firmResp.json();
      const reqData = await reqResp.json();
      const healthData = await healthResp.json();
      const outboxData = await outboxResp.json();

      setFirm(firmData.firm);
      setActiveCount(reqData.metrics?.activeConcurrentRequests ?? 24);
      setHealth(healthData);
      setOutbox(outboxData.outbox || []);
    }
    void load();
  }, []);

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    if (!firm) return;
    setSaving(true);
    try {
      const resp = await fetch('/api/firm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmName: firm.firmName,
          tagline: firm.tagline,
          logoText: firm.logoText,
          primaryColor: firm.primaryColor,
          accentColor: firm.accentColor,
          customDomain: firm.customDomain,
          senderName: firm.senderName,
          dedicatedNumber: firm.dedicatedNumber,
          hidePoweredBy: firm.hidePoweredBy,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setFirm(data.firm);
        setSavedBanner(true);
        setTimeout(() => setSavedBanner(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  // Content Snare / File Request Pro start at $35-$42/mo and throttle ~20 active requests,
  // forcing plan upgrades (~$79-$149/mo) during tax season peaks.
  const incumbentCost = seasonalClients <= 20 ? 39 : seasonalClients <= 60 ? 79 : 149;
  const annualSavings = (incumbentCost - 25) * 12;

  return (
    <AppShell firm={firm} activeCount={activeCount}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          White-Label Studio, Seasonal Plan &amp; Integrations
        </h1>
        <p className="text-sm text-slate-600">
          Customize how every client portal, email reminder, and WhatsApp intake thread looks to your clients.
        </p>
      </div>

      {!firm ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading settings...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left: White-Label Branding Form */}
          <form
            onSubmit={saveBranding}
            className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs lg:col-span-7"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">White-Label Agency Branding</h2>
              </div>
              {savedBanner && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Saved live to portals
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Firm Name</label>
                <input
                  type="text"
                  value={firm.firmName}
                  onChange={(e) => setFirm({ ...firm, firmName: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Logo Monogram (1-4 chars)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={firm.logoText}
                  onChange={(e) => setFirm({ ...firm, logoText: e.target.value.toUpperCase() })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  White-Label Portal Domain
                </label>
                <input
                  type="text"
                  value={firm.customDomain}
                  onChange={(e) => setFirm({ ...firm, customDomain: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Dedicated WhatsApp / SMS Number
                </label>
                <input
                  type="text"
                  value={firm.dedicatedNumber}
                  onChange={(e) => setFirm({ ...firm, dedicatedNumber: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Primary Brand Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={firm.primaryColor}
                    onChange={(e) => setFirm({ ...firm, primaryColor: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200"
                  />
                  <input
                    type="text"
                    value={firm.primaryColor}
                    onChange={(e) => setFirm({ ...firm, primaryColor: e.target.value })}
                    className="h-9 flex-1 rounded-xl border border-slate-200 px-3 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Accent Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={firm.accentColor}
                    onChange={(e) => setFirm({ ...firm, accentColor: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200"
                  />
                  <input
                    type="text"
                    value={firm.accentColor}
                    onChange={(e) => setFirm({ ...firm, accentColor: e.target.value })}
                    className="h-9 flex-1 rounded-xl border border-slate-200 px-3 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Email / SMS Sender Name
              </label>
              <input
                type="text"
                value={firm.senderName}
                onChange={(e) => setFirm({ ...firm, senderName: e.target.value })}
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={firm.hidePoweredBy}
                onChange={(e) => setFirm({ ...firm, hidePoweredBy: e.target.checked })}
              />
              Hide &ldquo;Secured by SnapCollect&rdquo; footer on client portals (100% white-label)
            </label>

            {/* Live White-Label Header Preview */}
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              <div
                className="flex items-center gap-3 px-4 py-3 text-white"
                style={{ backgroundColor: firm.primaryColor }}
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-slate-950"
                  style={{ backgroundColor: firm.accentColor }}
                >
                  {firm.logoText}
                </div>
                <div>
                  <p className="text-xs font-bold">{firm.firmName}</p>
                  <p className="text-[11px] opacity-80">{firm.customDomain} · Zero-login client view</p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save White-Label Branding
            </button>
          </form>

          {/* Right: Unlimited Seasonal Scaling Calculator + Integrations */}
          <div className="flex flex-col gap-5 lg:col-span-5">
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-900">
                  <InfinityIcon className="h-4 w-4 text-emerald-600" />
                  Seasonal Unlimited Plan
                </span>
                <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                  $25/mo flat
                </span>
              </div>
              <p className="mt-2 text-xs text-emerald-950">
                Active right now: <strong className="font-mono">{activeCount}</strong> concurrent requests (no
                20-request cap). Slide to model your tax-season peak:
              </p>

              <div className="mt-4">
                <div className="flex justify-between text-xs font-semibold text-emerald-950">
                  <span>Peak Concurrent Clients: {seasonalClients}</span>
                  <span className="font-mono text-emerald-700">Save ${annualSavings}/yr</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={150}
                  step={5}
                  value={seasonalClients}
                  onChange={(e) => setSeasonalClients(Number(e.target.value))}
                  className="mt-2 w-full accent-emerald-600"
                />
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[11px] text-slate-500">SnapCollect</p>
                    <p className="font-mono text-base font-bold text-emerald-700">$25/mo</p>
                    <p className="text-[10px] text-slate-500">Unlimited concurrent</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[11px] text-slate-500">Legacy Portals</p>
                    <p className="font-mono text-base font-bold text-rose-700">${incumbentCost}/mo</p>
                    <p className="text-[10px] text-slate-500">Throttled above 20 reqs</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">Production Infrastructure Status</h2>
              </div>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">Encrypted Document Storage</span>
                  <span className="font-mono text-[11px] font-semibold text-emerald-700">
                    {health?.storage || 'checking...'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">Instant AI Verification</span>
                  <span className="font-mono text-[11px] font-semibold text-emerald-700">
                    {health?.aiVisionConfigured
                      ? 'Canvas + Vision AI + Forensics'
                      : 'Canvas + Forensic OCR Active'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">WhatsApp / SMS Webhook</span>
                  <span className="font-mono text-[11px] font-semibold text-slate-700">
                    {health?.twilioConfigured ? 'Twilio Live' : 'Twilio Webhook + Simulator'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">Email Cadence Dispatch</span>
                  <span className="font-mono text-[11px] font-semibold text-slate-700">
                    {health?.resendConfigured ? 'Resend Live' : 'Cadence Outbox Active'}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Recent outbox events logged: <strong className="font-mono">{outbox.length}</strong>
              </p>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
