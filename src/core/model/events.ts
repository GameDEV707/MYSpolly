import type { Era, IndustryType, PlayerColor } from './types.ts';
import type { Card, PlacedLink, PlacedTile } from './state.ts';

/**
 * Semantic events emitted by the reducer. They drive the presentation layer
 * (animations + audio) and the game log. The engine has zero knowledge of
 * pixels; it only describes *what happened*.
 */
export type GameEvent =
  | { t: 'TILE_PLACED'; tile: PlacedTile; overbuilt?: string }
  | { t: 'LINK_PLACED'; link: PlacedLink }
  | {
      t: 'CUBE_TO_MARKET';
      resource: 'coal' | 'iron';
      from: string;
      count: number;
      income: number;
    }
  | {
      t: 'RESOURCE_CONSUMED';
      resource: 'coal' | 'iron' | 'beer';
      from: string;
      player: PlayerColor;
    }
  | { t: 'TILE_FLIPPED'; tileId: string; incomeGain: number; player: PlayerColor }
  | { t: 'INCOME_CHANGED'; player: PlayerColor; delta: number; level: number }
  | { t: 'MONEY_CHANGED'; player: PlayerColor; delta: number; total: number }
  | { t: 'VP_CHANGED'; player: PlayerColor; delta: number; total: number }
  | { t: 'CARD_DISCARDED'; player: PlayerColor; card: Card }
  | { t: 'CARD_RETURNED_WILD'; player: PlayerColor; card: Card }
  | { t: 'HAND_REFILLED'; player: PlayerColor; count: number }
  | { t: 'DEVELOP'; player: PlayerColor; industry: IndustryType }
  | { t: 'LOAN_TAKEN'; player: PlayerColor }
  | { t: 'SCOUT'; player: PlayerColor }
  | { t: 'MERCHANT_BONUS'; player: PlayerColor; merchantId: string; kind: string }
  | { t: 'ACTION_DONE'; player: PlayerColor; action: string }
  | { t: 'TURN_ENDED'; next: PlayerColor }
  | { t: 'ROUND_ENDED'; round: number; newOrder: PlayerColor[] }
  | { t: 'INCOME_COLLECTED'; player: PlayerColor; amount: number }
  | { t: 'SHORTFALL'; player: PlayerColor; tilesSold: number; vpLost: number }
  | { t: 'ERA_SCORING'; era: Era; perPlayer: Record<string, number> }
  | { t: 'ERA_ENDED'; era: Era }
  | { t: 'CANAL_MAINTENANCE' }
  | { t: 'GAME_OVER'; ranking: PlayerColor[] };

export type EventType = GameEvent['t'];

/** Result of applying an action: the new state and the events it produced. */
export interface ReduceResult {
  state: import('./state.ts').GameState;
  events: GameEvent[];
}
