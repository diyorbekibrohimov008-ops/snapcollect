'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  ExternalLink,
  Loader2,
  Phone,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { WhatsAppPhoneSimulator } from '@/components/WhatsAppPhoneSimulator';
import type { ChatMessage, ClientRequest, FirmBranding } from '@/lib/types';

function WhatsAppStudioContent() {
  const searchParams = useSearchParams();
  const initialReqId = searchParams.get('requestId');

  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ClientRequest | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [firm, setFirm] = useState<FirmBranding | null>(null);
  const [activeCount, setActiveCount] = useState(24);
  const [loading, setLoading] = useState(true);
  const [webhookOrigin, setWebhookOrigin] = useState('https://snapcollect.vercel.app');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWebhookOrigin(window.location.origin);
    }
  }, []);

  const selectRequestById = useCallback(async (id: string) => {
    const resp = await fetch(`/api/requests/${id}`, { cache: 'no-store' });
    if (!resp.ok) return;
    const data = await resp.json();
    setSelectedRequest(data.request);
    setMessages(data.messages || []);
    if (data.firm) setFirm(data.firm);
  }, []);

  useEffect(() => {
    async function init() {
      const resp = await fetch('/api/requests', { cache: 'no-store' });
      const data = await resp.json();
      const list: ClientRequest[] = data.requests || [];
      setRequests(list);
      setFirm(data.firm || null);
      setActiveCount(data.metrics?.activeConcurrentRequests ?? list.length);

      const target =
        (initialReqId && list.find((r) => r.id === initialReqId)) ||
        list.find((r) => r.id === 'req_marcus_vance') ||
        list[0];
      if (target) {
        await selectRequestById(target.id);
      }
      setLoading(false);
    }
    void init();
  }, [initialReqId, selectRequestById]);

  function handleSimulatorUpdate(updatedReq: ClientRequest, updatedMessages: ChatMessage[]) {
    setSelectedRequest(updatedReq);
    setMessages(updatedMessages);
    setRequests((prev) => prev.map((r) => (r.id === updatedReq.id ? updatedReq : r)));
  }

  return (
    <AppShell
      firm={firm}
      activeCount={activeCount}
      sampleToken={selectedRequest?.token}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            WhatsApp &amp; SMS Upload Mode (Live Webhook Studio)
          </h1>
          <p className="text-xs text-slate-600">
            Clients never touch a portal login — they snap and text their W-2, bank statement, or ID straight to{' '}
            <span className="font-mono font-semibold text-slate-900">
              {firm?.dedicatedNumber || '+1 (555) 019-2834'}
            </span>
            .
          </p>
        </div>
        {selectedRequest && (
          <Link
            href={`/c/${selectedRequest.token}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            Open Client Mobile Link
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {loading || !selectedRequest ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading WhatsApp &amp; SMS intake studio...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left: Client Switcher */}
          <aside className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
              <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Threads ({requests.length})
              </h2>
              <div className="flex max-h-[540px] flex-col gap-1 overflow-y-auto">
                {requests.slice(0, 15).map((req) => {
                  const active = req.id === selectedRequest.id;
                  const done = req.items.filter(
                    (it) => it.status === 'verified' || it.status === 'approved_override',
                  ).length;
                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => void selectRequestById(req.id)}
                      className={`flex flex-col rounded-xl p-2.5 text-left transition ${
                        active ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold">{req.clientName}</span>
                        <span className="font-mono text-[10px] opacity-80">
                          {done}/{req.items.length}
                        </span>
                      </div>
                      <span className="mt-0.5 truncate font-mono text-[10px] opacity-75">
                        {req.clientPhone} · {req.referenceCode}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Center: Interactive Phone Simulator */}
          <section className="lg:col-span-5">
            <WhatsAppPhoneSimulator
              request={selectedRequest}
              messages={messages}
              dedicatedNumber={firm?.dedicatedNumber || '+1 (555) 019-2834'}
              firmName={firm?.firmName || 'Summit Tax & Advisory'}
              onUpdated={handleSimulatorUpdate}
            />
          </section>

          {/* Right: Live Synced Checklist + Twilio Webhook Spec */}
          <aside className="flex flex-col gap-4 lg:col-span-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Live Checklist Sync</h2>
                <Link
                  href={`/requests/${selectedRequest.id}`}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Open Workbench →
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {selectedRequest.items.map((item) => {
                  const ok = item.status === 'verified' || item.status === 'approved_override';
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 text-xs ${
                        ok
                          ? 'border-emerald-200 bg-emerald-50/70'
                          : item.status === 'needs_reshoot'
                            ? 'border-amber-300 bg-amber-50/70'
                            : 'border-slate-200 bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{item.title}</span>
                        {ok ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : item.status === 'needs_reshoot' ? (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                        ) : (
                          <span className="font-mono text-[10px] text-slate-500">Pending</span>
                        )}
                      </div>
                      {item.latestVerification && (
                        <p className="mt-1 text-[11px] text-slate-700">
                          {item.latestVerification.headline}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-xs text-slate-200 shadow-2xs">
              <div className="mb-2 flex items-center gap-1.5 font-bold text-white">
                <Code2 className="h-4 w-4 text-emerald-400" />
                Live Twilio WhatsApp / SMS Webhook
              </div>
              <p className="text-[11px] text-slate-300">
                Point your Twilio Sandbox or Business Number webhook (`POST`) directly to:
              </p>
              <code className="mt-2 block overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 font-mono text-[11px] text-emerald-300">
                {webhookOrigin}/api/webhooks/twilio
              </code>
              <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                <Phone className="h-3.5 w-3.5" />
                Accepts Twilio `From`, `Body`, `MediaUrl0`, auto-verifies documents, and replies with native TwiML XML.
              </p>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

export default function WhatsAppStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Loading WhatsApp studio...
        </div>
      }
    >
      <WhatsAppStudioContent />
    </Suspense>
  );
}
