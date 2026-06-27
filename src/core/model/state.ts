import type { CardKind, Era, IndustryType, LinkType, PlayerColor } from './types.ts';

/**
 * Dynamic (per-game) state types. GameState is plain JSON: no class instances,
 * no functions, no Maps/Sets — so it is trivially serializable (save/load,
 * replays) and deep-cloneable via `structuredClone`.
 */

/** A card instance in a hand / discard / deck. */
export interface Card {
  /** Unique instance id within a game. */
  id: string;
  kind: CardKind;
  /** Location card → the location id. */
  locationId?: string;
  /** Industry card → which industries it permits. */
  industries?: IndustryType[];
  /** i18n display key. */
  name: string;
}

export interface PlacedTile {
  id: string;
  owner: PlayerColor;
  industry: IndustryType;
  level: number;
  locationId: string;
  slotId: string;
  flipped: boolean;
  /** Cubes / juice remaining on the tile (coal, iron, juice). */
  resourcesLeft: number;
}

export interface PlacedLink {
  id: string;
  owner: PlayerColor;
  lineId: string;
  type: LinkType;
}

export interface MarketTrack {
  cubes: number;
  capacity: number;
  priceLadder: number[];
  emptyPrice: number;
}

export interface MerchantState {
  id: string;
  /** Merchant location id (shrewsbury / warrington / gloucester / oxford / nottingham). */
  locationId: string;
  /** Index of the tile-space at that location (0-based). */
  spaceIndex: number;
  /** Industries this merchant will buy. Empty = blank merchant (no selling). */
  accepts: IndustryType[];
  /** Whether a juice barrel currently sits beside this merchant. */
  hasJuice: boolean;
}

export interface PlayerState {
  color: PlayerColor;
  /** Human display name / bot name. */
  name: string;
  isAI: boolean;
  money: number;
  incomeLevel: number;
  vp: number;
  hand: Card[];
  discard: Card[];
  /** Remaining tile levels on the mat, per industry (lowest first). */
  matStacks: Record<IndustryType, number[]>;
  /** Link tiles remaining on the mat. */
  linksLeft: number;
  /** Money spent so far this turn (sits on the character tile). */
  spentThisTurn: number;
}

export type GamePhase = 'setup' | 'playing' | 'roundEnd' | 'eraEnd' | 'gameOver';

export interface GameOptions {
  players: number;
  introMode: boolean;
  boardSide: 'day' | 'night';
  lang: 'en' | 'ru' | 'uz';
  /** Active map id (§7.15). Older saves without this default to 'birmingham'. */
  mapId: string;
}

export interface GameState {
  version: number;
  seed: number;
  /** Current PRNG state (advances as randomness is consumed). */
  rngState: number;
  options: GameOptions;

  era: Era;
  /** 1-based round number within the current era. */
  round: number;
  /** True only during the very first round of the Canal Era (1 action/turn). */
  isFirstCanalRound: boolean;

  turnOrder: PlayerColor[];
  activePlayer: PlayerColor;
  actionsLeftThisTurn: number;
  /** Index into turnOrder of the active player. */
  activeIndex: number;

  players: Record<PlayerColor, PlayerState>;

  tiles: PlacedTile[];
  links: PlacedLink[];
  merchants: MerchantState[];

  coalMarket: MarketTrack;
  ironMarket: MarketTrack;

  drawDeck: Card[];
  wildLocationPile: number;
  wildIndustryPile: number;

  phase: GamePhase;

  /** Monotonic counter used to mint unique ids for tiles/links/cards. */
  idSeq: number;

  /** Final ranking once the game is over (best first). */
  ranking?: PlayerColor[];

  /**
   * Per-player VP breakdown, accumulated by end-of-era / end-of-game scoring so
   * the Results screen can show how each final total was reached. `inPlay` VP
   * (merchant bonuses, income shortfalls) is derived as
   * `vp - links - tiles - intro`, so the four parts always reconcile exactly to
   * the authoritative `p.vp`.
   */
  vpBreakdown?: Record<PlayerColor, VpBreakdown>;
}

/** Scored-VP components used by the Results breakdown (§3.12a). */
export interface VpBreakdown {
  /** VP from scoring links at end of each era. */
  links: number;
  /** VP from scoring flipped industry tiles at end of each era. */
  tiles: number;
  /** Intro-variant bonus VP (money + income level + level-≥2 re-score). */
  intro: number;
}
