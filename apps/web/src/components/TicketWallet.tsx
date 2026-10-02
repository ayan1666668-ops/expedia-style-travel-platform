'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, mediaUrl } from '@/lib/api';
import { readToken } from '@/lib/session';
import { formatDate, relativeDay } from '@/lib/format';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';
import { brandName } from '@/lib/brand';

type WalletTicket = Awaited<ReturnType<typeof api.tickets>>[number];

export function TicketWallet({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);
  const [tickets, setTickets] = useState<WalletTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setLoading(false);
      setError(t('account.signInToOpenWallet'));
      return;
    }

    api
      .tickets(token)
      .then(setTickets)
      .catch(() => setError(t('account.couldNotLoadTickets')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: 220 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card card-pad center stack">
        <p className="muted">{error}</p>
        <Link href="/login?next=/tickets" className="btn btn-primary">
          {t('common.signIn')}
        </Link>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: 40 }} aria-hidden>
          🎟️
        </div>
        <h3>{t('account.noTickets')}</h3>
        <p className="muted" style={{ maxWidth: 380 }}>
          {t('account.noTicketsHint')}
        </p>
        <Link href="/search" className="btn btn-primary">
          {t('account.findSomething')}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
      {tickets.map((ticket) => (
        <article key={ticket.id} className="ticket-pass" style={{ margin: 0 }}>
          <div className="ticket-pass-header">
            <div style={{ minWidth: 0 }}>
              <div className="tiny" style={{ opacity: 0.8 }}>
                {ticket.destinationName ?? brandName(locale)}
              </div>
              <div className="bold truncate" style={{ fontSize: 15 }}>
                {ticket.productName}
              </div>
            </div>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              {ticket.status === 'REDEEMED'
                ? t('account.used')
                : relativeDay(ticket.serviceDate, new Date(), locale)}
            </span>
          </div>

          <div className="ticket-perf" />

          <div className="ticket-pass-body">
            {mediaUrl(ticket.qrImageUrl) ? (
              <img src={mediaUrl(ticket.qrImageUrl) ?? ''} alt={`QR code for ticket ${ticket.ticketNumber}`} className="ticket-qr" />
            ) : (
              <div className="ticket-qr" style={{ display: 'grid', placeItems: 'center', fontSize: 11 }}>
                {t('account.qrUnavailable')}
              </div>
            )}

            <div className="stack-sm" style={{ minWidth: 0 }}>
              <div className="small bold">{formatDate(ticket.serviceDate, locale)}</div>
              {ticket.timeSlot && <div className="tiny subtle">{ticket.timeSlot}</div>}
              <div className="tiny subtle">{ticket.holderName}</div>
              <div className="ticket-number">{ticket.ticketNumber}</div>
              <div className="row ticket-pass-actions" style={{ gap: 'var(--sp-2)', marginTop: 'auto', paddingTop: 'var(--sp-2)' }}>
                {mediaUrl(ticket.pdfUrl) && (
                  <a href={mediaUrl(ticket.pdfUrl) ?? '#'} className="btn btn-secondary btn-sm" download>
                    PDF
                  </a>
                )}
                {ticket.qrImageUrl && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setScan(ticket.ticketNumber)}>
                    Zoom
                  </button>
                )}
              </div>
            </div>
          </div>
        </article>
      ))}

      {scan && (
        <div className="modal-backdrop" onClick={() => setScan(null)} role="presentation">
          <div className="modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <h3 style={{ marginBottom: 'var(--sp-3)' }}>{scan}</h3>
            {tickets
              .filter((ticket) => ticket.ticketNumber === scan)
              .map((ticket) => (
                <img
                  key={ticket.id}
                  src={mediaUrl(ticket.qrImageUrl) ?? ''}
                  alt=""
                  style={{ width: '100%', imageRendering: 'pixelated' }}
                />
              ))}
            <button className="btn btn-primary btn-block" style={{ marginTop: 'var(--sp-4)' }} onClick={() => setScan(null)}>
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}