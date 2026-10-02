'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type ScanResult } from '@/lib/api';
import { readToken } from '@/lib/session';
import { formatDate } from '@/lib/format';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

type Stats = Awaited<ReturnType<typeof api.scanStats>>;

/**
 * Gate scanner. Two modes matter operationally:
 *  - "Check" only reads and is safe to run on every beep.
 *  - "Admit" commits the redemption, so it needs an explicit toggle.
 * That mirrors how real gate hardware is deployed (dry-run during training).
 */
export function GateScanner({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);
  const [code, setCode] = useState('');
  const [gate, setGate] = useState('Main Gate');
  const [commit, setCommit] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<{ number: string; holder: string; result: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const token = readToken();
    if (!token) return;
    const load = () => api.scanStats(token, gate).then(setStats).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [gate]);

  async function scan(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    const token = readToken();
    if (!token) return;

    setBusy(true);
    try {
      const response = await api.scanVerify({ code: trimmed, gate, commit }, token);
      setResult(response);
      setHistory((prev) =>
        [
          {
            number: response.ticket?.ticketNumber ?? trimmed,
            holder: response.ticket?.holderName ?? '—',
            result: response.result,
          },
          ...prev,
        ].slice(0, 12),
      );
      setCode('');
      inputRef.current?.focus();
    } catch (caught) {
      setResult({
        valid: false,
        result: 'ERROR',
        message: caught instanceof ApiError ? caught.message : t('staff.scannerError'),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid scanner-layout" style={{ gap: 'var(--sp-5)', alignItems: 'start' }}>
      <div className="stack-lg">
        <form className="card card-pad stack" onSubmit={scan}>
          <label className="field">
            <span className="label">{t('staff.ticketNumberOrBarcode')}</span>
            <input
              ref={inputRef}
              className="input input-lg mono"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="TKT-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className="row wrap" style={{ gap: 'var(--sp-4)' }}>
            <label className="field grow">
              <span className="label">{t('staff.gateLabel')}</span>
              <input className="input" value={gate} onChange={(event) => setGate(event.target.value)} />
            </label>
            <label className="row" style={{ gap: 'var(--sp-2)', paddingTop: 20 }}>
              <input type="checkbox" checked={commit} onChange={(event) => setCommit(event.target.checked)} />
              <span className="small bold">{t('staff.admitAndRedeem')}</span>
            </label>
          </div>

          <p className="tiny subtle" style={{ margin: 0 }}>
            {commit ? t('staff.admitHint') : t('staff.dryRunHint')}
          </p>

          <button className="btn btn-primary btn-block btn-lg" disabled={busy || code.trim() === ''}>
            {busy ? t('staff.checking') : commit ? t('staff.scanAndAdmit') : t('staff.checkOnly')}
          </button>
        </form>

        {result && (
          <div
            className="card card-pad stack"
            style={{
              borderColor: result.valid ? 'var(--success-600)' : 'var(--danger-600)',
              background: result.valid ? 'var(--success-50)' : 'var(--danger-50)',
            }}
          >
            <div className="row" style={{ gap: 'var(--sp-3)' }}>
              <span style={{ fontSize: 30 }} aria-hidden>
                {result.valid ? '✅' : '⛔'}
              </span>
              <div>
                <h3 style={{ margin: 0 }}>
                  {result.valid ? t('staff.admit') : t('staff.doNotAdmit')}
                </h3>
                <p className="small" style={{ margin: '2px 0 0' }}>
                  {result.message}
                </p>
              </div>
            </div>

            {result.ticket && (
              <div className="panel" style={{ background: 'rgba(255,255,255,0.7)' }}>
                <Line label={t('staff.ticketLabel')} value={result.ticket.ticketNumber} mono />
                <Line label={t('staff.guestLabel')} value={result.ticket.holderName} />
                <Line label={t('staff.experienceLabel')} value={result.ticket.productName} />
                <Line label={t('staff.date')} value={formatDate(result.ticket.serviceDate, locale)} />
                {result.ticket.timeSlot && (
                  <Line label={t('staff.slotLabel')} value={result.ticket.timeSlot} />
                )}
                <Line label={t('staff.partySize')} value={String(result.ticket.partySize)} />
                <Line label={t('staff.seatsUsed')} value={String(result.ticket.redeemedSeats)} />
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="stack">
        {stats && (
          <div className="card card-pad stack-sm">
            <h3 style={{ fontSize: 16, margin: 0 }}>{t('staff.todayAt', gate)}</h3>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
              <Stat label={t('staff.ticketsLabel')} value={String(stats.ticketsToday)} />
              <Stat label={t('staff.admittedLabel')} value={String(stats.admitted)} />
              <Stat label={t('staff.noShowLabel')} value={`${stats.noShowRate}%`} />
              <Stat label={t('staff.thisSession')} value={String(history.length)} />
            </div>
          </div>
        )}

        <div className="card card-pad stack-sm">
          <h3 style={{ fontSize: 16, margin: 0 }}>{t('staff.recentScans')}</h3>
          {history.length === 0 ? (
            <p className="muted small">{t('staff.noScansYet')}</p>
          ) : (
            history.map((entry, index) => (
              <div key={index} className="row-between small" style={{ paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="mono tiny truncate">{entry.number}</div>
                  <div className="tiny subtle truncate">{entry.holder}</div>
                </div>
                <span className={`badge badge-${entry.result === 'ADMITTED' ? 'success' : entry.result === 'ALREADY_USED' ? 'warn' : 'danger'}`}>
                  {entry.result}
                </span>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function Line({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="row-between small" style={{ paddingBottom: 4 }}>
      <span className="subtle">{label}</span>
      <span className={`bold ${mono ? 'mono' : ''}`} style={{ textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="tiny subtle">{label}</div>
      <div className="bold" style={{ fontSize: 20 }}>
        {value}
      </div>
    </div>
  );
}