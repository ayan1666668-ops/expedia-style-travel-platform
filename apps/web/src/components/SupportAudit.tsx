'use client';

import { Fragment, useEffect, useState } from 'react';
import { api, type AuditEntry } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { readToken } from '@/lib/session';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

/**
 * Support audit trail.
 *
 * Every balance change, profile edit and goodwill refund lands here. The point
 * is answerability: when finance asks why a shopper has credit they didn't
 * pay for, this is the screen that produces the answer.
 */
export function SupportAudit({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);

  const [token, setToken] = useState<string | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const stored = readToken();
    if (!stored) return;
    setToken(stored);

    api
      .supportAudit({ limit: 100 }, stored)
      .then((result) => setEntries(result.items))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  if (!token) return <p className="muted">{t('common_errors.sessionExpired')}</p>;
  if (loading) return <div className="skeleton" style={{ height: 320 }} />;

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <h3>{t('support.audit')}</h3>
        <p className="muted small">—</p>
      </div>
    );
  }

  return (
    <section className="card">
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('staff.placed')}</th>
              <th>{t('support.action')}</th>
              <th>{t('support.actor')}</th>
              <th>Entity</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <Fragment key={entry.id}>
                <tr>
                  <td className="tiny subtle nowrap">{formatDateTime(entry.createdAt, locale)}</td>
                  <td className="tiny mono">{entry.action}</td>
                  <td className="tiny subtle">{entry.actorRole ?? 'system'}</td>
                  <td className="tiny subtle truncate" style={{ maxWidth: 200 }}>
                    {entry.entityType}
                    {entry.entityId ? ` · ${entry.entityId.slice(-8)}` : ''}
                  </td>
                  <td className="right">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    >
                      {expanded === entry.id ? t('common.close') : '⋯'}
                    </button>
                  </td>
                </tr>

                {expanded === entry.id && (
                  <tr key={`${entry.id}-detail`}>
                    <td colSpan={5}>
                      <div className="panel">
                        <div className="grid grid-2">
                          <pre className="audit-json">
                            <strong>before</strong>
                            {JSON.stringify(entry.before, null, 2) ?? 'null'}
                          </pre>
                          <pre className="audit-json">
                            <strong>after</strong>
                            {JSON.stringify(entry.after, null, 2) ?? 'null'}
                          </pre>
                        </div>
                        {entry.ip && (
                          <div className="tiny subtle" style={{ marginTop: 'var(--sp-2)' }}>
                            IP {entry.ip}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}