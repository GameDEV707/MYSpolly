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
      /**
       * One event per consumed unit (§7.17.2) so previews/logs reconcile to the
       * cube. `from` is the unit's source: `'stock'` (own stockpile), `'market'`
       * (coal/iron market), `'supply'` (general fixed-price supply), a player
       * color (bought from that player, §7.17.3), or a tile/merchant id. `cost`
       * is the money paid for that single unit (0 when drawn from the stockpile).
       */
      t: 'RESOURCE_CONSUMED';
      resource: 'coal' | 'iron' | 'juice';
      from: string;
      player: PlayerColor;
      cost?: number;
    }
  | { t: 'TILE_FLIPPED'; tileId: string; incomeGain: number; player: PlayerColor }
  | {
      /**
       * End-of-round production added to a player's stockpile by their owned
       * production buildings (§7.16.2). Reports the amount added per resource
       * (after any stockpile cap) and the new totals.
       */
      t: 'RESOURCE_PRODUCED';
      player: PlayerColor;
      coal: number;
      iron: number;
      juice: number;
      totals: { coal: number; iron: number; juice: number };
    }
  | {
      t: 'GOODS_SOLD';
      player: PlayerColor;
      tileId: string;
      industry: IndustryType;
      /** Producing factory's location id (delivery origin). */
      from: string;
      /** Destination merchant tile id + its location id. */
      merchantId: string;
      merchantLocationId: string;
    }
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
  // --- Bankruptcy & auction (§7.17.5) ---
  | {
      /** A mandatory payment exceeded a player's cash; resolution begins. */
      t: 'BANKRUPTCY_STARTED';
      player: PlayerColor;
      /** Money still owed at the moment resolution started. */
      due: number;
    }
  | {
      /** A player sold one of their tiles to the bank at half build cost. */
      t: 'TILE_SOLD_TO_BANK';
      player: PlayerColor;
      tileId: string;
      refund: number;
    }
  | {
      /** A tile was put up for auction with `opening` as the starting bid. */
      t: 'AUCTION_OPENED';
      seller: PlayerColor;
      tileId: string;
      opening: number;
    }
  | { t: 'AUCTION_BID'; bidder: PlayerColor; tileId: string; amount: number }
  | {
      /**
       * Auction resolved. `toBank` true ⇒ nobody bid above the opening and the
       * bank bought the tile at `price` (tile removed). Otherwise `winner` paid
       * `price` to the seller and now owns the tile (it stays on the board).
       */
      t: 'AUCTION_RESULT';
      seller: PlayerColor;
      tileId: string;
      price: number;
      winner: PlayerColor | null;
      toBank: boolean;
    }
  | {
      /** Bankruptcy resolved: how much was raised, VP lost, and any unpaid debt. */
      t: 'BANKRUPTCY_RESOLVED';
      player: PlayerColor;
      raised: number;
      vpLost: number;
      stillOwed: number;
    }
  | {
      t: 'ERA_SCORING';
      era: Era;
      /** Total VP gained per player this scoring (links + tiles). */
      perPlayer: Record<string, number>;
      /** VP from links per player. */
      links: Record<string, number>;
      /** VP from flipped industry tiles per player. */
      tiles: Record<string, number>;
    }
  | { t: 'ERA_ENDED'; era: Era }
  | { t: 'ERA_MORPH'; from: Era; to: Era; routeFrom: string; routeTo: string }
  | { t: 'CANAL_MAINTENANCE' }
  | { t: 'GAME_OVER'; ranking: PlayerColor[] };

export type EventType = GameEvent['t'];

/** Result of applying an action: the new state and the events it produced. */
export interface ReduceResult {
  state: import('./state.ts').GameState;
  events: GameEvent[];
}
