import type { LocaleCode } from './i18n/config';

/**
 * ---------------------------------------------------------------------------
 * EasyTrip brand
 * ---------------------------------------------------------------------------
 *
 * Single source of truth for the product name and for the short promise line
 * that appears in metadata, the header, the footer and the e-mail copy.
 *
 * Why a module rather than a dictionary entry: the brand name is *not* a
 * translatable string. "EasyTrip" is the legal/trademarked mark and must render
 * verbatim in every locale except Chinese, where the registered 中文名 is used.
 * Treating it as a normal dictionary value would invite a translator to
 * "improve" it, and it would also break the `satisfies Record<LocaleCode, ...>`
 * shape because the values intentionally differ per locale.
 *
 *   zh → 易捷旅行      (registered Chinese brand name)
 *   everything else → EasyTrip
 */

export const BRAND = {
  /** Latin mark, used for the logo, favicon and ticket PDF header. */
  latin: 'EasyTrip',
  /** Registered Simplified Chinese brand name. */
  zhHans: '易捷旅行',
  /** One-line positioning statement used in metadata and hero copy. */
  latinTagline: 'Considered travel, beautifully arranged.',
  zhHansTagline: '用心甄选，安心启程。',
} as const;

/** The brand name for a given UI locale. */
export function brandName(locale: LocaleCode | string = 'en'): string {
  return String(locale).toLowerCase().startsWith('zh') ? BRAND.zhHans : BRAND.latin;
}

/** The brand promise line for a given UI locale. */
export function brandTagline(locale: LocaleCode | string = 'en'): string {
  return String(locale).toLowerCase().startsWith('zh') ? BRAND.zhHansTagline : BRAND.latinTagline;
}

/**
 * Compact mark for the logo tile: "E" in Latin locales, "易" in Chinese.
 * A single glyph keeps the header logo legible at 32px in both scripts.
 */
export function brandMark(locale: LocaleCode | string = 'en'): string {
  return String(locale).toLowerCase().startsWith('zh') ? '易' : 'E';
}

/** `<title>` suffix so every page reads "<Page> | EasyTrip". */
export function brandTitleSuffix(locale: LocaleCode | string = 'en'): string {
  return `| ${brandName(locale)}`;
}