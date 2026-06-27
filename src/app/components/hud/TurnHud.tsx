import { useTranslation } from 'react-i18next';
import type { GameState } from '../../../core/model/state.ts';
import { PLAYER_CSS_VAR } from '../ui.tsx';
import { useFlow } from './flowStore.ts';
import { promptInfo } from './flow.ts';

/**
 * Turn HUD (§7.13): era, round, whose turn it is, actions remaining, and a
 * concise prompt of the current guided step (e.g. "Pick a card to build…").
 */
export function TurnHud(props: {
  game: GameState;
  aiThinking: boolean;
  isHumanTurn: boolean;
}): JSX.Element {
  const { game, aiThinking, isHumanTurn } = props;
  const { t } = useTranslation();
  const flow = useFlow();
  const active = game.players[game.activePlayer]!;
  const prompt = promptInfo(t, flow);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong>{t(`game.${game.era}`)}</strong>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <span>{t('game.round', { round: game.round })}</span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <span>{t('game.actionsLeft', { n: game.actionsLeftThisTurn })}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: PLAYER_CSS_VAR[active.color],
            border: '1px solid rgba(0,0,0,0.4)',
            flex: '0 0 auto',
          }}
        />
        <span style={{ fontSize: 13 }}>
          {aiThinking
            ? t('game.aiThinking', { name: active.name })
            : isHumanTurn
              ? t('game.yourTurn')
              : t('game.turn', { name: active.name })}
        </span>
      </div>
      {isHumanTurn && (
        <div style={{ fontSize: 12, color: 'var(--accent)' }}>{t(prompt.key, prompt.params)}</div>
      )}
    </div>
  );
}
