import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '../../../core/model/state.ts';
import type { PlayerColor } from '../../../core/model/types.ts';
import { PLAYER_CSS_VAR } from '../ui.tsx';
import type { BankruptcyEpisode, BankruptcyStep } from './bankruptcyView.ts';

export { bankruptcyEpisodes } from './bankruptcyView.ts';
export type { BankruptcyEpisode, BankruptcyStep } from './bankruptcyView.ts';

/**
 * Bankruptcy / auction modal (§7.17.5 / task 11.13).
 *
 * The pure engine resolves a shortfall deterministically (selling tiles to the
 * bank at half, or auctioning them to the other players starting at half) and
 * emits a step-by-step event trail. This modal turns that trail (see
 * `bankruptcyView.ts`) into a clear, fully-localized (EN/RU/UZ) recap so the
 * player sees exactly which factory was sold or auctioned, the opening bid, each
 * bid, the winner (new owner) and any VP lost. (An interactive variant can drive
 * the same view from a UI-supplied `BankruptcyDecider`; the presentation is
 * identical.)
 */

export function BankruptcyModal(props: {
  game: GameState;
  episode: BankruptcyEpisode | null;
  onClose: () => void;
}): JSX.Element | null {
  const { game, episode, onClose } = props;
  const { t } = useTranslation();
  if (!episode) return null;

  const name = (c: PlayerColor): string => game.players[c]?.name ?? t(`color.${c}`);
  const color = PLAYER_CSS_VAR[episode.debtor] ?? 'var(--accent)';

  const overlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)',
    zIndex: 270,
  };
  const card: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
    padding: '24px 32px',
    borderRadius: 'var(--radius)',
    border: `3px solid ${color}`,
    background: 'var(--surface, rgba(20,20,24,0.96))',
    color: 'var(--text)',
    maxWidth: 460,
    width: '90%',
  };

  const lineFor = (s: BankruptcyStep): string => {
    switch (s.kind) {
      case 'soldToBank':
        return t('bankruptcy.sellToBank', { amount: s.amount });
      case 'auctionOpened':
        return t('bankruptcy.opening', { amount: s.amount });
      case 'auctionBid':
        return `${s.who ? name(s.who) : ''}: ${t('bankruptcy.bid', { amount: s.amount })}`;
      case 'auctionWon':
        return t('bankruptcy.won', { name: s.who ? name(s.who) : '', amount: s.amount });
      case 'auctionToBank':
        return t('bankruptcy.noBid', { amount: s.amount });
      default:
        return '';
    }
  };

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label={t('bankruptcy.title')}>
      <div style={card}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color }}>
          {t('bankruptcy.title')}
        </div>
        <div style={{ fontSize: 15 }}>
          {t('bankruptcy.intro', { name: name(episode.debtor), due: episode.due })}
        </div>
        <ul
          style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          {episode.steps.map((s, i) => (
            <li key={i} style={{ fontSize: 14 }}>
              {lineFor(s)}
            </li>
          ))}
        </ul>
        {episode.vpLost > 0 && (
          <div style={{ fontSize: 14, color: 'var(--danger, #e66)' }}>
            {t('bankruptcy.vpLost', { vp: episode.vpLost, amount: episode.vpLost })}
          </div>
        )}
        {episode.stillOwed > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {t('bankruptcy.stillOwed', { amount: episode.stillOwed })}
          </div>
        )}
        <button
          onClick={onClose}
          autoFocus
          style={{
            marginTop: 4,
            padding: '10px 24px',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: color,
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('bankruptcy.resolved')}
        </button>
      </div>
    </div>
  );
}
