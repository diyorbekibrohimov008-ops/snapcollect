'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileCheck2,
  Infinity as InfinityIcon,
  LayoutDashboard,
  Layers,
  MessageSquare,
  Plus,
  Settings,
  Smartphone,
} from 'lucide-react';
import type { FirmBranding } from '@/lib/types';
import { SwitchCompareModal } from './SwitchCompareModal';

interface AppShellProps {
  firm: FirmBranding | null;
  activeCount: number;
  sampleToken?: string;
  children: React.ReactNode;
}

export function AppShell({ firm, activeCount, sampleToken, children }: AppShellProps) {
  const pathname = usePathname();
  const [compareOpen, setCompareOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Command Center', icon: LayoutDashboard },
    { href: '/requests/new', label: 'New Request', icon: Plus },
    { href: '/whatsapp', label: 'WhatsApp / SMS Mode', icon: MessageSquare },
    { href: '/templates', label: 'Templates', icon: Layers },
    { href: '/settings', label: 'White-Label & Plan', icon: Settings },
  ];

  const primaryColor = firm?.primaryColor || '#0F172A';
  const accentColor = firm?.accentColor || '#10B981';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white shadow-xs"
                style={{ backgroundColor: primaryColor }}
              >
                {firm?.logoText || 'SC'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-tight text-slate-900">
                    {firm?.firmName || 'Summit Tax & Advisory'}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    AI Verified
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {firm?.dedicatedNumber || '+1 (555) 019-2834'} · {firm?.customDomain || 'intake.summittax.com'}
                </p>
              </div>
            </Link>
          </div>

          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
            {sampleToken && (
              <Link
                href={`/c/${sampleToken}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                <Smartphone className="h-3.5 w-3.5" />
                Client Portal Preview
              </Link>
            )}
          </nav>

          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
            title="Compare against Content Snare & File Request Pro"
          >
            <InfinityIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-mono tabular-nums">{activeCount}</span> Active · Unlimited ($25/mo)
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>

      <footer className="border-t border-slate-200 bg-white/80 py-4 text-center text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
            SnapCollect Seasonal Unlimited ($25/mo flat · Unlimited concurrent requests · WhatsApp/SMS + AI pre-validation)
          </span>
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="font-semibold text-emerald-700 underline-offset-2 hover:underline"
          >
            See why firms switch from Content Snare ($35–$42/mo)
          </button>
        </div>
      </footer>

      <SwitchCompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        activeCount={activeCount}
      />
    </div>
  );
}
