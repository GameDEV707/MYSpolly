import type { IndustryType, MerchantBonusType } from '../../../core/model/types.ts';

/**
 * Shared visual vocabulary for the board and legend (§7.12, §7.16). Each
 * industry, resource and merchant bonus has a glyph + colour + i18n label key
 * so locations are self-explanatory and the legend stays in sync with the map.
 */

export interface IconMeta {
  /** Unicode glyph rendered in SVG `<text>` (no variation selectors → reliable). */
  glyph: string;
  /** Accent colour for chips / swatches. */
  color: string;
  /** i18n label key. */
  labelKey: string;
}

export const INDUSTRY_ICON: Record<IndustryType, IconMeta> = {
  cotton: { glyph: '🧵', color: '#d98ab5', labelKey: 'industry.cotton' },
  coal: { glyph: '⬛', color: '#3a3a40', labelKey: 'industry.coal' },
  iron: { glyph: '⚙', color: '#c87f3a', labelKey: 'industry.iron' },
  manufacturer: { glyph: '🏭', color: '#8a6fbf', labelKey: 'industry.manufacturer' },
  pottery: { glyph: '🏺', color: '#b9622e', labelKey: 'industry.pottery' },
  juice: { glyph: '🧃', color: '#e8943a', labelKey: 'industry.juice' },
};

export const RESOURCE_ICON = {
  coal: { glyph: '⬛', color: '#3a3a40', labelKey: 'legend.coal' },
  iron: { glyph: '🟧', color: '#c87f3a', labelKey: 'legend.iron' },
  juice: { glyph: '🧃', color: '#e8943a', labelKey: 'legend.juice' },
  vp: { glyph: '★', color: '#e6c35c', labelKey: 'legend.vp' },
  money: { glyph: '£', color: '#7bbf6f', labelKey: 'legend.money' },
  income: { glyph: '↑', color: '#6fa8bf', labelKey: 'legend.income' },
} as const;

export const MERCHANT_BONUS_ICON: Record<MerchantBonusType, IconMeta> = {
  develop: { glyph: '⚒', color: '#bf8a6f', labelKey: 'legend.develop' },
  income: { glyph: '↑', color: '#6fa8bf', labelKey: 'legend.income' },
  vp: { glyph: '★', color: '#e6c35c', labelKey: 'legend.vp' },
  money: { glyph: '£', color: '#7bbf6f', labelKey: 'legend.money' },
};

/** Region/banner colour band per location colour. */
export const BAND_COLOR: Record<string, string> = {
  blue: '#3b6ea5',
  teal: '#2f8f8f',
  red: '#a5483b',
  yellow: '#b7951f',
  green: '#4f8a3d',
  farm: '#7a6a44',
  merchant: '#6a4f8a',
};
