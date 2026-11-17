'use client';

import { CheckCircle2, X, XCircle, Zap } from 'lucide-react';

interface SwitchCompareModalProps {
  open: boolean;
  onClose: () => void;
  activeCount: number;
}

export function SwitchCompareModal({ open, onClose, activeCount }: SwitchCompareModalProps) {
  if (!open) return null;

  const rows = [
    {
      feature: 'Monthly Starting Price',
      snap: '$25/mo flat',
      incumbents: '$35–$42/mo',
      win: true,
    },
    {
      feature: 'Active Concurrent Requests',
      snap: 'Unlimited (even 150+ during tax peak)',
      incumbents: 'Throttled (capped at ~20 active)',
      win: true,
    },
    {
      feature: 'Client WhatsApp / SMS Upload Mode',
      snap: 'Snap & text straight to business number',
      incumbents: 'Multi-page portal login required',
      win: true,
    },
    {
      feature: 'Instant AI Pre-Validation',
      snap: 'Blocks blurry photos & wrong tax year (2024 vs 2025)',
      incumbents: 'None — accepts bad files for manual review',
      win: true,
    },
    {
      feature: 'Multi-Step Checklists & Cadence',
      snap: 'Included + auto-pause on verify',
      incumbents: 'Included',
      win: false,
    },
    {
      feature: 'White-Label Firm Branding',
      snap: 'Custom domain, logo, colors & sender',
      incumbents: 'Higher-tier add-on',
      win: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overscroll-contain">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-slate-950">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Why Firms Switch from Content Snare & File Request Pro</h2>
              <p className="text-xs text-slate-300">
                Currently running <span className="font-mono font-semibold text-emerald-400">{activeCount}</span> active
                concurrent requests — zero throttling at $25/mo flat
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close comparison"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Capability</th>
                  <th className="px-4 py-3 text-emerald-700">SnapCollect ($25/mo)</th>
                  <th className="px-4 py-3 text-slate-500">Content Snare / File Request Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <tr key={row.feature} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.feature}</td>
                    <td className="px-4 py-3 font-medium text-emerald-700">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        {row.snap}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        {row.win ? (
                          <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        {row.incumbents}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
            <span>
              <strong>Seasonal Tax-Peak Protection:</strong> Your workspace has{' '}
              <span className="font-mono font-bold">{activeCount}</span> concurrent requests open right now—already
              above legacy 20-request limits, with $0 overage fees.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 font-semibold text-white hover:bg-emerald-700"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
