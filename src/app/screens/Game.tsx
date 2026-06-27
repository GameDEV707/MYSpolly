import { useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store/appStore.ts';
import { useSettings } from '../store/settings.ts';
import { legalActions } from '../../core/selectors/legalActions.ts';
import { BoardSvg } from '../components/board/BoardSvg.tsx';
import { BoardCamera } from '../components/board/BoardCamera.tsx';
import { Legend } from '../components/board/Legend.tsx';
import { PlayerStrip } from '../components/player/PlayerStrip.tsx';
import { Markets } from '../components/market/Markets.tsx';
import { Hand } from '../components/cards/Hand.tsx';
import { GuidedActionBar } from '../components/hud/GuidedActionBar.tsx';
import { TurnHud } from '../components/hud/TurnHud.tsx';
import { Log } from '../components/hud/Log.tsx';
import { Banner } from '../components/hud/Banner.tsx';
import { TurnHandoff } from '../components/hud/TurnHandoff.tsx';
import { useTurnHandoff } from '../components/hud/useTurnHandoff.ts';
import { HelpButton } from '../components/help/HelpButton.tsx';
import { useFlow } from '../components/hud/flowStore.ts';
import { flowHighlights, isBoardTargetStep } from '../components/hud/flow.ts';
import { useAnimateEvents } from '../animation/useAnimateEvents.ts';
import { audio } from '../audio/sound.ts';
import { Button, Panel, PLAYER_CSS_VAR } from '../components/ui.tsx';

/**
 * Main game screen. Renders the camera board + HUD and routes human input
 * through the guided action flow. The board glows valid targets for the active
 * action and accepts clicks to choose them. AI turns advance automatically.
 */
export function GameScreen(props: { replay?: boolean }): JSX.Element {
  const { t } = useTranslation();
  const game = useApp((s) => s.game);
  const events = useApp((s) => s.events);
  const dispatch = useApp((s) => s.dispatch);
  const aiThinking = useApp((s) => s.aiThinking);
  const goto = useApp((s) => s.goto);
  const replayStep = useApp((s) => s.replayStep);
  const replayIndex = useApp((s) => s.replayIndex);
  const replayActions = useApp((s) => s.replayActions);
  const { settings } = useSettings();
  const flow = useFlow();

  const activeState = game ? game.players[game.activePlayer] : undefined;
  const skipAnims = !!activeState?.isAI && settings.skipAiAnimations;
  const { banner, skip } = useAnimateEvents(events, skipAnims);
  const { handoff, dismiss: dismissHandoff } = useTurnHandoff(game, !props.replay);

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

  const isHumanTurn = !!game && !activeState?.isAI && !props.replay;
  const flowActive = isHumanTurn && flow.actionType !== null;

  // While an action is being targeted, glow valid board elements (and dim the
  // rest). Otherwise the board shows no affordance highlights.
  const acts = useMemo(() => (game ? legalActions(game) : []), [game]);
  const highlights = useMemo(
    () =>
      game && flowActive
        ? flowHighlights(game, acts, flow)
        : { locs: new Set<string>(), lines: new Set<string>() },
    [game, acts, flow, flowActive],
  );

  if (!game) {
    return (
      <div style={{ padding: 'var(--space-8)' }}>
        <Button onClick={() => goto('mainMenu')}>{t('results.mainMenu')}</Button>
      </div>
    );
  }

  const dim = flowActive && (highlights.locs.size > 0 || highlights.lines.size > 0);
  const boardTargeting = flowActive && isBoardTargetStep(flow);
  const active = game.players[game.activePlayer]!;

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
      <TurnHandoff handoff={handoff} onReady={dismissHandoff} />
      {/* Left: header + board */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minHeight: 0 }}
      >
        <Panel
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <TurnHud game={game} aiThinking={aiThinking} isHumanTurn={isHumanTurn} />
          {props.replay ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Button variant="ghost" onClick={() => replayStep(-1)}>
                ◀
              </Button>
              <span style={{ fontSize: 13 }}>
                {replayIndex}/{replayActions.length}
              </span>
              <Button variant="ghost" onClick={() => replayStep(1)}>
                ▶
              </Button>
              <Button variant="ghost" onClick={() => goto('results')}>
                ✕
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => goto('pause')}>
              ⏸
            </Button>
          )}
        </Panel>
        <div
          className="board-frame-accent"
          style={
            {
              flex: 1,
              minHeight: 0,
              position: 'relative',
              borderRadius: 'var(--radius)',
              '--active-accent': PLAYER_CSS_VAR[active.color],
            } as CSSProperties
          }
        >
          <BoardCamera>
            {(lod) => (
              <BoardSvg
                game={game}
                lod={lod}
                showTooltips={settings.showTooltips}
                highlightLocations={highlights.locs}
                highlightLines={highlights.lines}
                dimUnhighlighted={dim}
                onLocationClick={boardTargeting ? flow.pickLocation : undefined}
                onLineClick={boardTargeting ? flow.pickLine : undefined}
              />
            )}
          </BoardCamera>
          <Legend />
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
        {isHumanTurn && <GuidedActionBar game={game} onDispatch={dispatch} />}
        <div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>
              {t('game.hand')} — {active.name}
            </span>
            <HelpButton topic="hand" from="game" />
          </div>
          <Hand cards={active.hand} hidden={active.isAI} />
        </div>
        <Log game={game} events={events} />
      </div>
    </div>
  );
}
