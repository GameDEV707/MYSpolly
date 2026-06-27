import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import type { GameState } from '../../../core/model/state.ts';
import { pointsToWin } from '../../../core/selectors/standings.ts';
import { Panel, PLAYER_CSS_VAR } from '../ui.tsx';
import { HelpButton } from '../help/HelpButton.tsx';

/** Compact overview of all players (turn order, money, income, VP, spent). */
export function PlayerStrip(props: { game: GameState }): JSX.Element {
  const { game } = props;
  const { t } = useTranslation();
  return (
    <Panel
      style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', position: 'relative' }}
    >
      <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 1 }}>
        <HelpButton topic="players" from="game" />
      </div>
      {game.turnOrder.map((color) => {
        const p = game.players[color]!;
        const active = color === game.activePlayer;
        const accent = PLAYER_CSS_VAR[color];
        const toWin = pointsToWin(game, color);
        const leading = toWin === 0;
        const toWinLabel = leading ? t('game.leading') : t('game.toWinShort', { n: toWin });
        const toWinTip = leading ? t('game.leadingTip') : t('game.toWinTip', { n: toWin });
        return (
          <div
            key={color}
            className={active ? 'active-player-panel' : undefined}
            aria-current={active ? 'true' : undefined}
            title={t('help.player')}
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
            <div
              title={toWinTip}
              aria-label={toWinTip}
              style={{
                fontSize: 11,
                marginTop: 2,
                fontWeight: 600,
                color: leading ? 'var(--accent, #e6c35c)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span aria-hidden="true">🏆</span>
              {toWinLabel}
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
