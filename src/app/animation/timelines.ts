import type { GameEvent } from '../../core/model/events.ts';
import type { Sfx } from '../audio/sound.ts';

/**
 * Maps a semantic GameEvent to its presentation: which sound effect to play and
 * how long the visual beat lasts (before the next event animates). Durations are
 * scaled by the user's animation-speed setting in the queue.
 */
export interface EventFx {
  sfx?: Sfx;
  /** Base duration in ms at "normal" speed. */
  durationMs: number;
  /** Cinematic events get a full-screen banner. */
  banner?: string;
}

export function eventToFx(e: GameEvent): EventFx {
  switch (e.t) {
    case 'TILE_PLACED':
      return { sfx: 'tilePlace', durationMs: 350 };
    case 'LINK_PLACED':
      return { sfx: 'linkPlace', durationMs: 300 };
    case 'CUBE_TO_MARKET':
      return { sfx: 'cube', durationMs: 250 + e.count * 80 };
    case 'RESOURCE_CONSUMED':
      return { sfx: 'cube', durationMs: 120 };
    case 'TILE_FLIPPED':
      return { sfx: 'flip', durationMs: 400 };
    case 'MONEY_CHANGED':
      return { sfx: e.delta > 0 ? 'coin' : undefined, durationMs: 120 };
    case 'VP_CHANGED':
    case 'INCOME_CHANGED':
      return { durationMs: 150 };
    case 'CARD_DISCARDED':
      return { sfx: 'cardDiscard', durationMs: 120 };
    case 'HAND_REFILLED':
      return { sfx: 'cardDraw', durationMs: 200 };
    case 'MERCHANT_BONUS':
      return { sfx: 'coin', durationMs: 200 };
    case 'ROUND_ENDED':
      return { durationMs: 400, banner: 'banner.roundEnd' };
    case 'ERA_ENDED':
      return { sfx: 'eraFanfare', durationMs: 1500, banner: 'banner.eraEnd' };
    case 'CANAL_MAINTENANCE':
      return { durationMs: 1200, banner: 'banner.railBegins' };
    case 'GAME_OVER':
      return { sfx: 'victory', durationMs: 2000, banner: 'banner.gameOver' };
    default:
      return { durationMs: 80 };
  }
}

const SPEED_SCALE: Record<string, number> = {
  slow: 1.6,
  normal: 1,
  fast: 0.5,
  instant: 0,
};

export function scaledDuration(base: number, speed: string, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return base * (SPEED_SCALE[speed] ?? 1);
}
