import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import type { GameState } from '../../../core/model/state.ts';
import { Panel, PLAYER_CSS_VAR } from '../ui.tsx';

/** Compact overview of all players (turn order, money, income, VP, spent). */
export function PlayerStrip(props: { game: GameState }): JSX.Element {
  const { game } = props;
  const { t } = useTranslation();
  return (
    <Panel style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      {game.turnOrder.map((color) => {
        const p = game.players[color]!;
        const active = color === game.activePlayer;
        const accent = PLAYER_CSS_VAR[color];
        return (
          <div
            key={color}
            className={active ? 'active-player-panel' : undefined}
            aria-current={active ? 'true' : undefined}
            style={
              {
                flex: 1,
                minWidth: 120,
                padding: 8,
                borderRadius: 6,
                border: `2px solid ${active ? accent : 'var(--border)'}`,
                background: active ? 'var(--surface)' : 'transparent',
                // De-emphasize players who are not on turn.
                opacity: active ? 1 : 0.55,
                transition: 'opacity var(--anim-base) ease, border-color var(--anim-base) ease',
                '--active-accent': accent,
              } as CSSProperties
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: PLAYER_CSS_VAR[color],
                }}
              />
              {p.name} {p.isAI ? '🤖' : ''}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              💷 £{p.money} · 📈 {p.incomeLevel} · ⭐ {p.vp}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('game.spent')}: £{p.spentThisTurn}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
