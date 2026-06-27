import { useTranslation } from 'react-i18next';
import type { Card } from '../../../core/model/state.ts';
import { Panel } from '../ui.tsx';
import { cardLabel, cardKindLabel } from './cardText.ts';

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
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontSize: 12,
            padding: 4,
            gap: 4,
            color: card.kind.startsWith('wild') ? 'var(--accent)' : 'var(--text)',
          }}
        >
          {props.hidden ? (
            '🂠'
          ) : (
            <>
              <span style={{ fontWeight: 600 }}>{cardLabel(t, card)}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {cardKindLabel(t, card)}
              </span>
            </>
          )}
        </div>
      ))}
    </Panel>
  );
}
