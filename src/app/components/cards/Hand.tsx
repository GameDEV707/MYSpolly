import { useTranslation } from 'react-i18next';
import type { Card } from '../../../core/model/state.ts';
import { TOWN_BY_ID } from '../../../core/data/board.ts';
import { Panel } from '../ui.tsx';

function cardLabel(t: (k: string) => string, card: Card): string {
  if (card.kind === 'location' && card.locationId)
    return t(TOWN_BY_ID[card.locationId]?.name ?? card.locationId);
  if (card.kind === 'industry' && card.industries)
    return card.industries.map((i) => t(`industry.${i}`)).join('/');
  if (card.kind === 'wildLocation') return t('card.wildLocation');
  if (card.kind === 'wildIndustry') return t('card.wildIndustry');
  return card.name;
}

/** Renders the active player's hand (hot-seat: only the current human sees it). */
export function Hand(props: { cards: Card[]; hidden?: boolean }): JSX.Element {
  const { t } = useTranslation();
  return (
    <Panel style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 80 }}>
      {props.cards.map((card) => (
        <div
          key={card.id}
          style={{
            width: 80,
            height: 110,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: props.hidden ? 'var(--bg-elevated)' : 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontSize: 12,
            padding: 4,
            color: card.kind.startsWith('wild') ? 'var(--accent)' : 'var(--text)',
          }}
        >
          {props.hidden ? '🂠' : cardLabel(t, card)}
        </div>
      ))}
    </Panel>
  );
}
