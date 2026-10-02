'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, type PromoBannerAdmin, type PromoBannerInput } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

const SLOTS = ['home', 'hero'] as const;
const THEMES = ['brand', 'accent', 'success', 'warning', 'neutral'] as const;

type Draft = {
  id?: string;
  slot: string;
  titleEn: string;
  titleZh: string;
  bodyEn: string;
  bodyZh: string;
  ctaLabelEn: string;
  ctaLabelZh: string;
  ctaHref: string;
  imageUrl: string;
  theme: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY: Draft = {
  slot: 'home',
  titleEn: '',
  titleZh: '',
  bodyEn: '',
  bodyZh: '',
  ctaLabelEn: '',
  ctaLabelZh: '',
  ctaHref: '',
  imageUrl: '',
  theme: 'brand',
  startsAt: '',
  endsAt: '',
  isActive: true,
  sortOrder: 0,
};

/** `2026-10-01T12:00:00Z` → the value a datetime-local input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 16);
}

/** Empty means "no bound" — the API treats null as always-eligible. */
function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function PromoManager({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<PromoBannerAdmin[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load(authToken: string) {
    try {
      const result = await api.adminPromoBanners(authToken);
      setItems(result.items);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 403
          ? t('staff.staffOnly')
          : t('common_errors.generic'),
      );
    }
  }

  useEffect(() => {
    const stored = window.localStorage.getItem('easytrip_token');
    if (!stored) return;
    setToken(stored);
    load(stored);
  }, []);

  function edit(item: PromoBannerAdmin) {
    setDraft({
      id: item.id,
      slot: item.slot,
      titleEn: item.titleEn,
      titleZh: item.titleZh ?? '',
      bodyEn: item.bodyEn ?? '',
      bodyZh: item.bodyZh ?? '',
      ctaLabelEn: item.ctaLabelEn ?? '',
      ctaLabelZh: item.ctaLabelZh ?? '',
      ctaHref: item.ctaHref ?? '',
      imageUrl: item.imageUrl ?? '',
      theme: item.theme,
      startsAt: toLocalInput(item.startsAt),
      endsAt: toLocalInput(item.endsAt),
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    });
  }

  async function save() {
    if (!token || !draft) return;
    if (!draft.titleEn.trim()) {
      setError(t('promo.fieldsRequired'));
      return;
    }

    const body: PromoBannerInput = {
      slot: draft.slot,
      titleEn: draft.titleEn.trim(),
      titleZh: draft.titleZh.trim() || null,
      bodyEn: draft.bodyEn.trim() || null,
      bodyZh: draft.bodyZh.trim() || null,
      ctaLabelEn: draft.ctaLabelEn.trim() || null,
      ctaLabelZh: draft.ctaLabelZh.trim() || null,
      ctaHref: draft.ctaHref.trim() || null,
      imageUrl: draft.imageUrl.trim() || null,
      theme: draft.theme,
      startsAt: fromLocalInput(draft.startsAt),
      endsAt: fromLocalInput(draft.endsAt),
      isActive: draft.isActive,
      sortOrder: draft.sortOrder,
    };

    setSaving(true);
    setError(null);
    try {
      if (draft.id) {
        await api.updatePromoBanner(draft.id, body, token);
      } else {
        await api.createPromoBanner(body, token);
      }
      setDraft(null);
      await load(token);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('common_errors.generic'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: PromoBannerAdmin) {
    if (!token) return;
    if (!window.confirm(t('promo.confirmDelete'))) return;

    await api.deletePromoBanner(item.id, token).catch(() => undefined);
    if (draft?.id === item.id) setDraft(null);
    await load(token);
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (!token) {
    return <p className="muted">{t('common_errors.sessionExpired')}</p>;
  }

  return (
    <div className="stack-lg">
      {error && <p className="form-error">{error}</p>}

      {/* ---------------------------------------------------------------- */}
      {/* List                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="card card-pad stack">
        <div className="row-between wrap">
          <h2 style={{ fontSize: 17 }}>{t('promo.adminTitle')}</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setDraft({ ...EMPTY })}>
            {t('promo.createBanner')}
          </button>
        </div>

        {items.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--sp-6)' }}>
            <h3>{t('promo.noneYet')}</h3>
            <p className="muted small">{t('promo.noneYetHint')}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('promo.title')}</th>
                  <th>{t('promo.slot')}</th>
                  <th>{t('promo.schedule')}</th>
                  <th className="right">{t('promo.clicks')}</th>
                  <th>{t('promo.active')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="small bold">{item.titleEn}</div>
                      {item.titleZh && <div className="tiny subtle">{item.titleZh}</div>}
                    </td>
                    <td className="tiny">{item.slot}</td>
                    <td className="tiny subtle">
                      {item.startsAt || item.endsAt
                        ? `${item.startsAt ? formatDateTime(item.startsAt) : '—'} → ${
                            item.endsAt ? formatDateTime(item.endsAt) : '∞'
                          }`
                        : t('promo.alwaysOn')}
                    </td>
                    <td className="right small">{item.clickCount}</td>
                    <td>
                      <span className={`badge badge-${item.isActive ? 'success' : 'neutral'} small`}>
                        {item.isActive ? t('common.yes') : t('common.no')}
                      </span>
                    </td>
                    <td className="right nowrap">
                      <button className="btn btn-ghost btn-sm" onClick={() => edit(item)}>
                        {t('common.save')}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(item)}>
                        {t('promo.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Editor                                                          */}
      {/* ---------------------------------------------------------------- */}
      {draft && (
        <section className="card card-pad stack">
          <h2 style={{ fontSize: 17 }}>{draft.id ? t('promo.editBanner') : t('promo.createBanner')}</h2>

          <div className="grid grid-2">
            <label className="field">
              <span className="label">{t('promo.title')} (EN) *</span>
              <input
                className="input"
                value={draft.titleEn}
                onChange={(e) => set('titleEn', e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">{t('promo.titleZh')}</span>
              <input
                className="input"
                lang="zh-CN"
                value={draft.titleZh}
                onChange={(e) => set('titleZh', e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">{t('promo.body')} (EN)</span>
              <textarea
                className="textarea"
                rows={3}
                value={draft.bodyEn}
                onChange={(e) => set('bodyEn', e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">{t('promo.bodyZh')}</span>
              <textarea
                className="textarea"
                rows={3}
                lang="zh-CN"
                value={draft.bodyZh}
                onChange={(e) => set('bodyZh', e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">{t('promo.ctaLabel')} (EN)</span>
              <input
                className="input"
                value={draft.ctaLabelEn}
                onChange={(e) => set('ctaLabelEn', e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">{t('promo.ctaLabel')} (中文)</span>
              <input
                className="input"
                lang="zh-CN"
                value={draft.ctaLabelZh}
                onChange={(e) => set('ctaLabelZh', e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">{t('promo.ctaHref')}</span>
              <input
                className="input"
                placeholder="/search?type=ATTRACTION"
                value={draft.ctaHref}
                onChange={(e) => set('ctaHref', e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">{t('promo.imageUrl')}</span>
              <input
                className="input"
                value={draft.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">{t('promo.slot')}</span>
              <select
                className="select"
                value={draft.slot}
                onChange={(e) => set('slot', e.target.value)}
              >
                {SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot === 'home' ? t('promo.slotHome') : t('promo.slotHero')}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="label">{t('promo.theme')}</span>
              <select
                className="select"
                value={draft.theme}
                onChange={(e) => set('theme', e.target.value)}
              >
                {THEMES.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="label">{t('promo.startsAt')}</span>
              <input
                className="input"
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">{t('promo.endsAt')}</span>
              <input
                className="input"
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => set('endsAt', e.target.value)}
              />
            </label>
          </div>

          <div className="row wrap" style={{ gap: 'var(--sp-4)' }}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
              />
              <span className="small bold">{t('promo.active')}</span>
            </label>

            <label className="field" style={{ maxWidth: 120 }}>
              <span className="label">Sort</span>
              <input
                className="input"
                type="number"
                value={draft.sortOrder}
                onChange={(e) => set('sortOrder', Number(e.target.value) || 0)}
              />
            </label>
          </div>

          <div className="row" style={{ gap: 'var(--sp-2)' }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? t('common.loading') : t('promo.save')}
            </button>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}