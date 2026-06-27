import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../../core/model/state.ts';
import type { PlayerColor } from '../../../core/model/types.ts';
import { audio } from '../../audio/sound.ts';
import { useSettings } from '../../store/settings.ts';

/**
 * How long the brief "Player X's turn" banner stays on screen before it fades
 * out on its own (task 3R.27). Kept in the 1.2–1.8s window the design calls for
 * and centralized here so the duration is easy to tune. The CSS fade and the
 * JS dismiss timer both read this value so they stay in sync.
 */
export const TURN_BANNER_MS = 1500;
/** Shorter window when the player prefers reduced motion. */
export const TURN_BANNER_REDUCED_MS = 900;

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
  /**
   * Auto-dismiss lifetime in ms for `banner` mode (0/undefined for `confirm`,
   * which stays until the player taps Ready). The overlay uses this to sync its
   * fade-out with the dismiss timer.
   */
  durationMs?: number;
}

/**
 * Watches `game.activePlayer` and produces a handoff cue on every change. Plays
 * a sound, auto-dismisses brief banners after a short, configurable window
 * (task 3R.27), and keeps the hot-seat confirmation up until the player
 * acknowledges it. The dismiss timer is always cleared before a new banner is
 * shown (and on unmount) so rapid turn changes — e.g. fast AI turns — never
 * stack banners or leave one stuck on screen. Inert during replays / when not
 * playing.
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

  function clearTimer(): void {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    if (!game || !enabled || game.phase !== 'playing') {
      // Not in active play: drop any pending banner so it can never linger.
      clearTimer();
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
    const durationMs = reducedMotion ? TURN_BANNER_REDUCED_MS : TURN_BANNER_MS;

    prevRef.current = { color: game.activePlayer, isAI: active.isAI };
    tokenRef.current += 1;
    setHandoff({
      color: active.color,
      name: active.name,
      isAI: active.isAI,
      mode,
      token: tokenRef.current,
      durationMs: mode === 'banner' ? durationMs : undefined,
    });
    audio.playSfx('turnChange');

    // Reset the dismiss timer on every handoff so banners never stack or stick.
    clearTimer();
    if (mode === 'banner') {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setHandoff(null);
      }, durationMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.activePlayer, game?.phase, enabled, passDevicePrompt, reducedMotion]);

  useEffect(() => () => clearTimer(), []);

  function dismiss(): void {
    clearTimer();
    setHandoff(null);
  }

  return { handoff, dismiss };
}
