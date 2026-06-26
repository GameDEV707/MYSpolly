import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store/appStore.ts';
import { useSettings } from '../store/settings.ts';
import { legalActions } from '../../core/selectors/legalActions.ts';
import { BoardSvg } from '../components/board/BoardSvg.tsx';
import { PlayerStrip } from '../components/player/PlayerStrip.tsx';
import { Markets } from '../components/market/Markets.tsx';
import { Hand } from '../components/cards/Hand.tsx';
import { ActionBar } from '../components/hud/ActionBar.tsx';
import { Log } from '../components/hud/Log.tsx';
import { Banner } from '../components/hud/Banner.tsx';
import { useAnimateEvents } from '../animation/useAnimateEvents.ts';
import { audio } from '../audio/sound.ts';
import { Button, Panel } from '../components/ui.tsx';

/**
 * Main game screen. Renders the board + HUD and routes human input through the
 * ActionBar guided flow. AI turns advance automatically (driven by the store).
 */
export function GameScreen(props: { replay?: boolean }): JSX.Element {
  const { t } = useTranslation();
  const game = useApp((s) => s.game);
  const events = useApp((s) => s.events);
  const dispatch = useApp((s) => s.dispatch);
  const aiThinking = useApp((s) => s.aiThinking);
  const goto = useApp((s) => s.goto);
  const { settings } = useSettings();

  const activeState = game ? game.players[game.activePlayer] : undefined;
  const skipAnims = !!activeState?.isAI && settings.skipAiAnimations;
  const { banner, skip } = useAnimateEvents(events, skipAnims);

  // Play era-appropriate ambience.
  useEffect(() => {
    if (game) audio.playMusic(game.era === 'rail' ? 'rail' : 'canal');
    return () => audio.stopMusic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.era]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') goto('pause');
      if (e.key === ' ') skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goto, skip]);

  const highlights = useMemo(() => {
    if (!game) return { locs: new Set<string>(), lines: new Set<string>() };
    const acts = legalActions(game);
    const locs = new Set<string>();
    const lines = new Set<string>();
    for (const a of acts) {
      if (a.type === 'BUILD') locs.add(a.locationId);
      if (a.type === 'NETWORK') a.links.forEach((l) => lines.add(l.lineId));
    }
    return { locs, lines };
  }, [game]);

  if (!game) {
    return (
      <div style={{ padding: 'var(--space-8)' }}>
        <Button onClick={() => goto('mainMenu')}>{t('results.mainMenu')}</Button>
      </div>
    );
  }

  const active = game.players[game.activePlayer]!;
  const isHumanTurn = !active.isAI && !props.replay;

  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 'var(--space-3)',
        padding: 'var(--space-3)',
      }}
    >
      <Banner messageKey={banner} />
      {/* Left: header + board */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minHeight: 0 }}
      >
        <Panel style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <strong>{t(`game.${game.era}`)}</strong> · {t('game.round', { round: game.round })} ·{' '}
            {t('game.actionsLeft', { n: game.actionsLeftThisTurn })}
          </div>
          <div>
            {aiThinking
              ? t('game.aiThinking', { name: active.name })
              : isHumanTurn
                ? t('game.yourTurn')
                : t('game.turn', { name: active.name })}
          </div>
          <Button variant="ghost" onClick={() => goto('pause')}>
            ⏸
          </Button>
        </Panel>
        <div style={{ flex: 1, minHeight: 0 }}>
          <BoardSvg
            game={game}
            highlightLocations={isHumanTurn ? highlights.locs : new Set()}
            highlightLines={isHumanTurn ? highlights.lines : new Set()}
          />
        </div>
      </div>

      {/* Right: HUD */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        <PlayerStrip game={game} />
        <Markets coal={game.coalMarket} iron={game.ironMarket} />
        {isHumanTurn && <ActionBar game={game} onDispatch={dispatch} />}
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
            {t('game.hand')} — {active.name}
          </div>
          <Hand cards={active.hand} hidden={active.isAI} />
        </div>
        <Log events={events} />
      </div>
    </div>
  );
}
