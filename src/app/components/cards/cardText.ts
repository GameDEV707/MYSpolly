import type { TFunction } from 'i18next';
import type { Card } from '../../../core/model/state.ts';

/** Readable face label for a card (location name, industries, or wild). */
export function cardLabel(t: TFunction, card: Card): string {
  if (card.kind === 'location' && card.locationId) {
    // `card.name` is the location's registered i18n key on the active map, so
    // this resolves to a real place name on every map (never a raw id).
    return t(card.name);
  }
  if (card.kind === 'industry' && card.industries) {
    return card.industries.map((i) => t(`industry.${i}`)).join(' / ');
  }
  if (card.kind === 'wildLocation') return t('card.wildLocation');
  if (card.kind === 'wildIndustry') return t('card.wildIndustry');
  return card.name;
}

/** Localized one-word card-kind label (Location / Industry / Wild). */
export function cardKindLabel(t: TFunction, card: Card): string {
  switch (card.kind) {
    case 'location':
      return t('card.location');
    case 'industry':
      return t('card.industry');
    case 'wildLocation':
    case 'wildIndustry':
      return t('card.wild');
    default:
      return '';
  }
}
