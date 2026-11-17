'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Layers, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import type { ChecklistTemplate, FirmBranding } from '@/lib/types';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [firm, setFirm] = useState<FirmBranding | null>(null);
  const [activeCount, setActiveCount] = useState(24);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [tplResp, reqResp] = await Promise.all([
        fetch('/api/templates', { cache: 'no-store' }),
        fetch('/api/requests', { cache: 'no-store' }),
      ]);
      const tplData = await tplResp.json();
      const reqData = await reqResp.json();
      setTemplates(tplData.templates || []);
      setFirm(reqData.firm || null);
      setActiveCount(reqData.metrics?.activeConcurrentRequests ?? 24);
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <AppShell firm={firm} activeCount={activeCount}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Industry Checklist Templates</h1>
          <p className="text-sm text-slate-600">
            Pre-configured multi-step checklists and AI verification rules for Accountants, Mortgage Brokers &amp;
            Creative Agencies.
          </p>
        </div>
        <Link
          href="/requests/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Custom Request Builder
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading templates…
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-700">
                    {tpl.vertical}
                  </span>
                  <Layers className="h-4 w-4 text-slate-400" />
                </div>
                <h2 className="mt-3 text-base font-bold text-slate-900">{tpl.name}</h2>
                <p className="mt-1 text-xs text-slate-600">{tpl.description}</p>

                <div className="mt-4 flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                  {tpl.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span className="truncate">{it.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href={`/requests/new?templateId=${tpl.id}`}
                className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Use This Template
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
