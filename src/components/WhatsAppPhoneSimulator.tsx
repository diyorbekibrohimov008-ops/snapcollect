'use client';

import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Code2,
  Loader2,
  MessageCircle,
  Send,
  Smartphone,
} from 'lucide-react';
import type { SampleDocKind } from '@/lib/sample-docs';
import type { ChatMessage, ClientRequest } from '@/lib/types';
import { SampleDocKit } from './SampleDocKit';

interface WhatsAppPhoneSimulatorProps {
  request: ClientRequest;
  messages: ChatMessage[];
  dedicatedNumber: string;
  firmName: string;
  onUpdated: (request: ClientRequest, messages: ChatMessage[], twiml?: string) => void;
}

export function WhatsAppPhoneSimulator({
  request,
  messages,
  dedicatedNumber,
  firmName,
  onUpdated,
}: WhatsAppPhoneSimulatorProps) {
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>(
    request.preferredChannel === 'sms' ? 'sms' : 'whatsapp',
  );
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [lastTwiml, setLastTwiml] = useState<string | null>(null);
  const [showTwiml, setShowTwiml] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function sendWebhookText(messageText: string) {
    if (!messageText.trim() || sending) return;
    setSending(true);
    try {
      const resp = await fetch('/api/webhooks/twilio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          requestId: request.id,
          from: request.clientPhone,
          channel,
          body: messageText.trim(),
        }),
      });
      const data = await resp.json();
      if (data.request && data.messages) {
        setLastTwiml(data.twiml || null);
        onUpdated(data.request, data.messages, data.twiml);
      }
      setTextInput('');
    } finally {
      setSending(false);
    }
  }

  async function sendWebhookFile(file: File) {
    if (sending) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append('requestId', request.id);
      form.append('from', request.clientPhone);
      form.append('channel', channel);
      form.append('body', textInput.trim() || `Here is ${file.name}`);
      form.append('file', file);

      const resp = await fetch('/api/webhooks/twilio', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: form,
      });
      const data = await resp.json();
      if (data.request && data.messages) {
        setLastTwiml(data.twiml || null);
        onUpdated(data.request, data.messages, data.twiml);
      }
      setTextInput('');
    } finally {
      setSending(false);
    }
  }

  async function sendSampleKind(file: File, _kind: SampleDocKind) {
    await sendWebhookFile(file);
  }

  const isWhatsApp = channel === 'whatsapp';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setChannel('whatsapp')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
              isWhatsApp ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp Mode
          </button>
          <button
            type="button"
            onClick={() => setChannel('sms')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
              !isWhatsApp ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            SMS / MMS Mode
          </button>
        </div>

        {lastTwiml && (
          <button
            type="button"
            onClick={() => setShowTwiml((s) => !s)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Code2 className="h-3.5 w-3.5" />
            {showTwiml ? 'Hide TwiML' : 'Inspect TwiML'}
          </button>
        )}
      </div>

      {showTwiml && lastTwiml && (
        <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] text-emerald-300">
          {lastTwiml}
        </pre>
      )}

      {/* Mobile Phone Frame */}
      <div className="overflow-hidden rounded-2xl border-4 border-slate-900 bg-white shadow-lg">
        <div
          className={`flex items-center justify-between px-4 py-3 text-white ${
            isWhatsApp ? 'bg-emerald-800' : 'bg-slate-900'
          }`}
        >
          <div>
            <p className="text-xs font-bold">{firmName}</p>
            <p className="font-mono text-[11px] opacity-85">
              {dedicatedNumber} · {isWhatsApp ? 'WhatsApp Business' : 'Dedicated SMS/MMS'}
            </p>
          </div>
          <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] font-semibold">
            {request.referenceCode}
          </span>
        </div>

        <div
          className={`flex h-80 flex-col gap-2.5 overflow-y-auto p-3.5 ${
            isWhatsApp ? 'bg-[#efeae2]' : 'bg-slate-50'
          }`}
        >
          {messages.length === 0 && (
            <div className="my-auto rounded-xl bg-white/90 p-3 text-center text-xs text-slate-600 shadow-xs">
              Text &ldquo;status&rdquo; or snap any document below. SnapCollect AI verifies sharpness and tax year
              immediately in-thread.
            </div>
          )}

          {messages.map((msg) => {
            const isClientInbound = msg.direction === 'inbound';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isClientInbound ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[86%] rounded-2xl px-3.5 py-2 text-xs shadow-xs ${
                    isClientInbound
                      ? isWhatsApp
                        ? 'bg-[#d9fdd3] text-slate-900'
                        : 'bg-sky-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-900'
                  }`}
                >
                  <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] opacity-70">
                    <span className="font-semibold">{msg.senderLabel}</span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {msg.mediaUrl && (
                    <div className="my-1.5 overflow-hidden rounded-lg border border-black/10 bg-white">
                      <img
                        src={msg.mediaUrl}
                        alt={msg.mediaFileName || 'Uploaded document'}
                        className="max-h-36 w-full object-contain"
                      />
                    </div>
                  )}

                  {msg.mediaFileName && !msg.mediaUrl && (
                    <div className="mb-1 rounded bg-black/5 px-2 py-1 font-mono text-[10px]">
                      📎 {msg.mediaFileName}
                    </div>
                  )}

                  <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>

                  {msg.verification && (
                    <div
                      className={`mt-1.5 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${
                        msg.verification.passed
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-amber-50 text-amber-900'
                      }`}
                    >
                      {msg.verification.passed ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                      )}
                      <span>
                        Sharpness {msg.verification.sharpnessScore}/100 · {msg.verification.engine}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div className="border-t border-slate-200 bg-white p-2.5">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void sendWebhookFile(file);
                }
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={sending}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              title="Snap or attach photo/PDF"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void sendWebhookText(textInput);
                }
              }}
              placeholder='Reply ("status") or snap a document...'
              className="h-9 flex-1 rounded-xl border border-slate-200 px-3 text-xs outline-hidden focus:border-emerald-500"
            />
            <button
              type="button"
              disabled={sending || !textInput.trim()}
              onClick={() => sendWebhookText(textInput)}
              className="inline-flex h-9 items-center gap-1 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={sending}
              onClick={() => sendWebhookText('status')}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              Text: &ldquo;status&rdquo;
            </button>
          </div>
        </div>
      </div>

      <SampleDocKit
        onSelectFile={sendSampleKind}
        disabled={sending}
        title="Snap & Text a Test Photo via WhatsApp / SMS"
      />
    </div>
  );
}
