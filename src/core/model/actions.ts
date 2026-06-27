import type { IndustryType, PlayerColor } from './types.ts';

/**
 * Action input types. Humans (via UI) and AI bots both construct these and feed
 * them to `reduce`. There is exactly one rules authority.
 */

/** Reference to a card in the active player's hand by instance id. */
export interface CardRef {
  cardId: string;
}

/**
 * Where a consumed resource comes from (§7.16 / §7.17). In the MYSpolly economy
 * a player draws from their OWN stockpile first, then buys a shortfall in this
 * order: the relevant market (coal/iron only, when connected) → another player's
 * stockpile (paying that player) → a general fixed-price supply (non-market
 * resources such as juice). On a Sell, juice may instead come from a connected
 * merchant's barrel (which also grants its bonus).
 */
export type ResourceSource =
  | { from: 'stock' } // the acting player's own stockpile (coal / iron / juice)
  | { from: 'market' } // buy a shortfall from the coal / iron market
  | { from: 'player'; color: PlayerColor } // buy from another player's stockpile (§7.17.3)
  | { from: 'supply' } // buy a non-market resource at its fixed price (§7.17.4)
  | { from: 'merchantJuice'; merchantId: string }; // merchant juice (Sell only)

export interface BuildAction {
  type: 'BUILD';
  card: CardRef;
  industry: IndustryType;
  locationId: string;
  slotId: string;
  coalSources: ResourceSource[];
  ironSources: ResourceSource[];
  /** If overbuilding, the id of the tile being replaced. */
  overbuildTileId?: string;
}

export interface NetworkLinkSpec {
  lineId: string;
  /** Coal source for this rail link (rail era only). */
  coalSource?: ResourceSource;
}

export interface NetworkAction {
  type: 'NETWORK';
  card: CardRef;
  links: NetworkLinkSpec[];
  /** Juice source consumed when building two rail links. */
  juiceSource?: ResourceSource;
}

export interface DevelopAction {
  type: 'DEVELOP';
  card: CardRef;
  /** 1 or 2 industries whose lowest tile is removed from the mat. */
  removals: IndustryType[];
  ironSources: ResourceSource[];
}

export interface SellSpec {
  tileId: string;
  merchantId: string;
  juice: ResourceSource[];
}

export interface SellAction {
  type: 'SELL';
  card: CardRef;
  sales: SellSpec[];
}

export interface LoanAction {
  type: 'LOAN';
  card: CardRef;
}

export interface ScoutAction {
  type: 'SCOUT';
  card: CardRef;
  extraDiscards: [CardRef, CardRef];
}

export interface PassAction {
  type: 'PASS';
  card: CardRef;
}

export type Action =
  | BuildAction
  | NetworkAction
  | DevelopAction
  | SellAction
  | LoanAction
  | ScoutAction
  | PassAction;

export type ActionType = Action['type'];
