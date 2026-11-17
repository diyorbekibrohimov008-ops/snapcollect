'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { SampleDocKind } from '@/lib/sample-docs';

interface SampleButtonSpec {
  kind: SampleDocKind;
  label: string;
  badge: string;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
}

const SAMPLE_BUTTONS: SampleButtonSpec[] = [
  {
    kind: 'w2_2025_crisp',
    label: 'Crisp 2025 W-2',
    badge: 'Passes AI',
    tone: 'emerald',
  },
  {
    kind: 'w2_2025_blurry',
    label: 'Blurry W-2 Snap',
    badge: 'Blur Alert',
    tone: 'amber',
  },
  {
    kind: 'w2_2024_wrong_year',
    label: '2024 W-2 (Wrong Yr)',
    badge: 'Year Alert',
    tone: 'rose',
  },
  {
    kind: 'bank_2025_crisp',
    label: '2025 Bank Statement',
    badge: 'Passes AI',
    tone: 'emerald',
  },
  {
    kind: 'gov_id_crisp',
    label: 'Driver License ID',
    badge: 'Passes AI',
    tone: 'slate',
  },
];

interface SampleDocKitProps {
  onSelectFile: (file: File, kind: SampleDocKind) => Promise<void> | void;
  disabled?: boolean;
  title?: string;
}

export function SampleDocKit({
  onSelectFile,
  disabled,
  title = '1-Click Test Document Snaps (real PNG images)',
}: SampleDocKitProps) {
  const [loadingKind, setLoadingKind] = useState<SampleDocKind | null>(null);

  async function handlePick(kind: SampleDocKind) {
    if (disabled || loadingKind) return;
    setLoadingKind(kind);
    try {
      const resp = await fetch(`/api/sample-doc?kind=${kind}`);
      const headerName = resp.headers.get('X-Sample-Filename') || `${kind}.png`;
      const blob = await resp.blob();
      const file = new File([blob], headerName, { type: 'image/png' });
      await onSelectFile(file, kind);
    } finally {
      setLoadingKind(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
        <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SAMPLE_BUTTONS.map((btn) => {
          const isBusy = loadingKind === btn.kind;
          const colorCls =
            btn.tone === 'amber'
              ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
              : btn.tone === 'rose'
                ? 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100'
                : btn.tone === 'emerald'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100';

          return (
            <button
              key={btn.kind}
              type="button"
              disabled={disabled || Boolean(loadingKind)}
              onClick={() => handlePick(btn.kind)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${colorCls}`}
            >
              <span>{isBusy ? 'Generating...' : btn.label}</span>
              <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold">
                {btn.badge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
