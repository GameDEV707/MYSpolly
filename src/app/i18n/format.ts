import type { Lang } from './index.ts';

/** Locale codes for Intl formatting per app language. */
const LOCALE: Record<Lang, string> = { en: 'en-GB', ru: 'ru-RU', uz: 'uz-UZ' };

/** Format a plain number for the active language. */
export function formatNumber(value: number, lang: Lang): string {
  try {
    return new Intl.NumberFormat(LOCALE[lang]).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Format a money amount. The in-game currency is the historical pound (£), shown
 * with the locale's grouping but a fixed £ symbol so it reads the same in every
 * language (matching the physical components).
 */
export function formatMoney(value: number, lang: Lang): string {
  return `£${formatNumber(value, lang)}`;
}
