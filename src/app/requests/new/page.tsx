'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  Loader2,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import type {
  ChecklistItemDefinition,
  ChecklistStep,
  ChecklistTemplate,
  DocumentCategory,
  FirmBranding,
  VerticalType,
} from '@/lib/types';

interface DraftReminder {
  id: string;
  dayOffset: number;
  channel: 'whatsapp' | 'sms' | 'email';
  subject: string;
  messageTemplate: string;
}

function NewRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTemplateId = searchParams.get('templateId');

  const [firm, setFirm] = useState<FirmBranding | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [activeCount, setActiveCount] = useState(24);
  const [loading, setLoading] = useState(true);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [vertical, setVertical] = useState<VerticalType>('tax');
  const [title, setTitle] = useState('2025 Individual Tax Return Intake');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [preferredChannel, setPreferredChannel] = useState<'whatsapp' | 'sms' | 'portal'>('whatsapp');
  const [dueDate, setDueDate] = useState('2026-11-30');
  const [autoPauseOnComplete, setAutoPauseOnComplete] = useState(true);
  const [sendWelcomeNow, setSendWelcomeNow] = useState(true);

  const [steps, setSteps] = useState<ChecklistStep[]>([]);
  const [items, setItems] = useState<ChecklistItemDefinition[]>([]);
  const [cadence, setCadence] = useState<DraftReminder[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyTemplate(tpl: ChecklistTemplate) {
    setSelectedTemplateId(tpl.id);
    setVertical(tpl.vertical);
    setTitle(tpl.name);
    setSteps(tpl.steps.map((s) => ({ ...s })));
    setItems(tpl.items.map((it) => ({ ...it })));
    setCadence(
      tpl.defaultCadence.map((r) => ({
        id: r.id,
        dayOffset: r.dayOffset,
        channel: r.channel,
        subject: r.subject,
        messageTemplate: r.messageTemplate,
      })),
    );
  }

  useEffect(() => {
    async function init() {
      const [reqResp, tplResp] = await Promise.all([
        fetch('/api/requests', { cache: 'no-store' }),
        fetch('/api/templates', { cache: 'no-store' }),
      ]);
      const reqData = await reqResp.json();
      const tplData = await tplResp.json();
      const list: ChecklistTemplate[] = tplData.templates || [];
      setFirm(reqData.firm || null);
      setActiveCount(reqData.metrics?.activeConcurrentRequests ?? 24);
      setTemplates(list);

      const initial =
        (initialTemplateId && list.find((t) => t.id === initialTemplateId)) || list[0];
      if (initial) applyTemplate(initial);
      setLoading(false);
    }
    void init();
  }, [initialTemplateId]);

  function addStep() {
    const num = steps.length + 1;
    const stepId = `step_${Date.now()}`;
    setSteps([
      ...steps,
      {
        id: stepId,
        title: `Step ${num} · Additional Documents`,
        description: 'Upload supporting files below.',
        order: num,
      },
    ]);
  }

  function addItem(stepId: string) {
    setItems([
      ...items,
      {
        id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        stepId,
        title: 'Supporting Document',
        instructions: 'Ensure all edges and numbers are clearly legible.',
        expectedDocType: 'any',
        expectedYear: '2025',
        acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
        minSharpness: 55,
        required: true,
      },
    ]);
  }

  function moveItem(index: number, delta: -1 | 1) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    setItems(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim()) {
      setError('Please enter the client name, email, and mobile phone number.');
      return;
    }
    if (items.length === 0) {
      setError('Add at least one checklist document item.');
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          templateId: selectedTemplateId,
          title,
          vertical,
          clientName,
          clientEmail,
          clientPhone,
          preferredChannel,
          dueDate,
          autoPauseOnComplete,
          sendWelcomeNow,
          steps,
          items,
          reminderRules: cadence,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'Failed to launch request');
        setSubmitting(false);
        return;
      }
      router.push(`/requests/${data.request.id}`);
    } catch {
      setError('Network error creating request');
      setSubmitting(false);
    }
  }

  return (
    <AppShell firm={firm} activeCount={activeCount}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Multi-Step Checklist &amp; Reminder Builder
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Launch unlimited concurrent requests with per-item AI blur &amp; tax-year validation plus automated
          WhatsApp/SMS &amp; email follow-ups.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading templates...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-12">
          {/* Left: Builder Steps & Items */}
          <div className="flex flex-col gap-5 lg:col-span-8">
            {/* Template Starter */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <h2 className="mb-3 text-sm font-bold text-slate-900">1. Choose Vertical Template</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {templates.map((tpl) => {
                  const selected = tpl.id === selectedTemplateId;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className={`rounded-xl border p-3.5 text-left transition ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                      }`}
                    >
                      <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-600">
                        {tpl.vertical}
                      </span>
                      <p className="mt-2 text-xs font-bold text-slate-900">{tpl.name}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {tpl.steps.length} steps · {tpl.items.length} AI-checked items
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Multi-Step Sections */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  2. Multi-Step Checklist &amp; AI Verification Rules
                </h2>
                <button
                  type="button"
                  onClick={addStep}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Step
                </button>
              </div>

              <div className="flex flex-col gap-5">
                {steps.map((step) => {
                  const stepItems = items.filter((it) => it.stepId === step.id);
                  return (
                    <div
                      key={step.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) =>
                            setSteps(
                              steps.map((s) =>
                                s.id === step.id ? { ...s, title: e.target.value } : s,
                              ),
                            )
                          }
                          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => addItem(step.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                        >
                          <Plus className="h-3 w-3" />
                          Add Item
                        </button>
                      </div>

                      <div className="flex flex-col gap-3">
                        {stepItems.map((item) => {
                          const globalIdx = items.findIndex((x) => x.id === item.id);
                          return (
                            <div
                              key={item.id}
                              className="rounded-xl border border-slate-200 bg-white p-3.5"
                            >
                              <div className="grid gap-3 sm:grid-cols-12">
                                <div className="sm:col-span-5">
                                  <label className="block text-[10px] font-semibold uppercase text-slate-500">
                                    Document Title
                                  </label>
                                  <input
                                    type="text"
                                    value={item.title}
                                    onChange={(e) =>
                                      setItems(
                                        items.map((x) =>
                                          x.id === item.id ? { ...x, title: e.target.value } : x,
                                        ),
                                      )
                                    }
                                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-semibold"
                                  />
                                </div>

                                <div className="sm:col-span-3">
                                  <label className="block text-[10px] font-semibold uppercase text-slate-500">
                                    AI Doc Type
                                  </label>
                                  <select
                                    value={item.expectedDocType}
                                    onChange={(e) =>
                                      setItems(
                                        items.map((x) =>
                                          x.id === item.id
                                            ? {
                                                ...x,
                                                expectedDocType: e.target.value as DocumentCategory,
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                                  >
                                    <option value="w2">Form W-2</option>
                                    <option value="1099">Form 1099</option>
                                    <option value="bank_statement">Bank Statement</option>
                                    <option value="government_id">Government ID</option>
                                    <option value="paystub">Paystub</option>
                                    <option value="brand_asset">Brand Asset</option>
                                    <option value="any">Any Document</option>
                                  </select>
                                </div>

                                <div className="sm:col-span-2">
                                  <label className="block text-[10px] font-semibold uppercase text-slate-500">
                                    Expected Year
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="2025 or blank"
                                    value={item.expectedYear ?? ''}
                                    onChange={(e) =>
                                      setItems(
                                        items.map((x) =>
                                          x.id === item.id
                                            ? {
                                                ...x,
                                                expectedYear: e.target.value.trim() || null,
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                    className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-xs"
                                  />
                                </div>

                                <div className="flex items-end justify-end gap-1 sm:col-span-2">
                                  <button
                                    type="button"
                                    onClick={() => moveItem(globalIdx, -1)}
                                    className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                                    title="Move up"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveItem(globalIdx, 1)}
                                    className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                                    title="Move down"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setItems(items.filter((x) => x.id !== item.id))}
                                    className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                                    title="Delete item"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                                <input
                                  type="text"
                                  value={item.instructions}
                                  onChange={(e) =>
                                    setItems(
                                      items.map((x) =>
                                        x.id === item.id
                                          ? { ...x, instructions: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                  placeholder="Instructions for client..."
                                  className="h-7 flex-1 rounded-lg border border-slate-200 px-2.5 text-[11px] text-slate-600"
                                />
                                <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={item.required}
                                    onChange={(e) =>
                                      setItems(
                                        items.map((x) =>
                                          x.id === item.id
                                            ? { ...x, required: e.target.checked }
                                            : x,
                                        ),
                                      )
                                    }
                                  />
                                  Required
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Automated Reminder Cadence */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    3. Automated Multi-Channel Reminder Cadence
                  </h2>
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={autoPauseOnComplete}
                    onChange={(e) => setAutoPauseOnComplete(e.target.checked)}
                  />
                  Auto-pause when verified
                </label>
              </div>

              <div className="flex flex-col gap-2.5">
                {cadence.map((rule) => (
                  <div
                    key={rule.id}
                    className="grid items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-2">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        Day {rule.dayOffset}
                      </span>
                    </div>
                    <div className="sm:col-span-3">
                      <select
                        value={rule.channel}
                        onChange={(e) =>
                          setCadence(
                            cadence.map((r) =>
                              r.id === rule.id
                                ? { ...r, channel: e.target.value as 'whatsapp' | 'sms' | 'email' }
                                : r,
                            ),
                          )
                        }
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold uppercase"
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                        <option value="email">Email</option>
                      </select>
                    </div>
                    <div className="sm:col-span-7">
                      <input
                        type="text"
                        value={rule.subject}
                        onChange={(e) =>
                          setCadence(
                            cadence.map((r) =>
                              r.id === rule.id ? { ...r, subject: e.target.value } : r,
                            ),
                          )
                        }
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right: Client Details & Launch */}
          <aside className="lg:col-span-4">
            <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <h2 className="text-sm font-bold text-slate-900">Client &amp; Delivery Settings</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Clients receive a zero-login portal link AND dedicated WhatsApp/SMS intake number.
              </p>

              {error && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
                  {error}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Request Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Client Name</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Client Email</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Client Mobile (for WhatsApp / SMS Upload Mode)
                  </label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+15559876543"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Preferred Channel
                    </label>
                    <select
                      value={preferredChannel}
                      onChange={(e) =>
                        setPreferredChannel(e.target.value as 'whatsapp' | 'sms' | 'portal')
                      }
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS / MMS</option>
                      <option value="portal">Mobile Portal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-2.5 text-xs"
                    />
                  </div>
                </div>

                <label className="mt-1 inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={sendWelcomeNow}
                    onChange={(e) => setSendWelcomeNow(e.target.checked)}
                  />
                  Send welcome WhatsApp/SMS &amp; portal link immediately
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Launch Request (Unlimited Plan · $0 extra)
                </button>

                <p className="flex items-center justify-center gap-1 text-[11px] text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Currently {activeCount} active concurrent requests — no cap!
                </p>
              </div>
            </div>
          </aside>
        </form>
      )}
    </AppShell>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Loading checklist builder...
        </div>
      }
    >
      <NewRequestContent />
    </Suspense>
  );
}
