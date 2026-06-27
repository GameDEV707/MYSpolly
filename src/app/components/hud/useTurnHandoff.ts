import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../../core/model/state.ts';
import type { PlayerColor } from '../../../core/model/types.ts';
import { audio } from '../../audio/sound.ts';
import { useSettings } from '../../store/settings.ts';

/**
 * Turn-handoff state surfaced to the UI (§7.13 / task 3R.26). Whenever the
 * active player changes, the screen shows a brief, prominent cue so the next
 * player always knows it is their turn.
 */
export interface HandoffState {
  color: PlayerColor;
  name: string;
  isAI: boolean;
  /**
   * `confirm` blocks the screen until the next human taps "Ready" — used for
   * hot-seat human→human handoffs so the previous player's hand stays hidden.
   * `banner` is a brief, non-blocking cue (AI→human, human→AI, game start).
   */
  mode: 'banner' | 'confirm';
  /** Increments on every handoff so the banner animation restarts each time. */
  token: number;
}

/**
 * Watches `game.activePlayer` and produces a handoff cue on every change. Plays
 * a sound, auto-dismisses brief banners, and keeps the hot-seat confirmation up
 * until the player acknowledges it. Inert during replays / when not playing.
 */
export function useTurnHandoff(
  game: GameState | null,
  enabled: boolean,
): { handoff: HandoffState | null; dismiss: () => void } {
  const settings = useSettings((s) => s.settings);
  const passDevicePrompt = settings.passDevicePrompt;
  const reducedMotion = settings.reducedMotion;
  const [handoff, setHandoff] = useState<HandoffState | null>(null);
  const prevRef = useRef<{ color: PlayerColor; isAI: boolean } | null>(null);
  const tokenRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!game || !enabled || game.phase !== 'playing') {
      if (game) {
        prevRef.current = {
          color: game.activePlayer,
          isAI: game.players[game.activePlayer]?.isAI ?? false,
        };
      }
      return;
    }
    const active = game.players[game.activePlayer];
    if (!active) return;
    const prev = prevRef.current;
    if (prev && prev.color === game.activePlayer) return;

    const prevWasHuman = prev ? !prev.isAI : false;
    const newIsHuman = !active.isAI;
    const hotSeat = prevWasHuman && newIsHuman && passDevicePrompt;
    const mode: 'banner' | 'confirm' = hotSeat ? 'confirm' : 'banner';

    prevRef.current = { color: game.activePlayer, isAI: active.isAI };
    tokenRef.current += 1;
    setHandoff({
      color: active.color,
      name: active.name,
      isAI: active.isAI,
      mode,
      token: tokenRef.current,
    });
    audio.playSfx('turnChange');

    if (timerRef.current) clearTimeout(timerRef.current);
    if (mode === 'banner') {
      const base = active.isAI ? 1200 : 2000;
      const dur = reducedMotion ? Math.min(base, 1000) : base;
      timerRef.current = setTimeout(() => setHandoff(null), dur);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.activePlayer, game?.phase, enabled, passDevicePrompt]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function dismiss(): void {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHandoff(null);
  }

  return { handoff, dismiss };
}
