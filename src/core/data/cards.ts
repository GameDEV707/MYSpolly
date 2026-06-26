import type { CardDef, IndustryType } from '../model/types.ts';
import { TOWNS } from './board.ts';

/**
 * Draw-deck composition.
 *
 * Confirmed rules from the rulebook:
 *  - There are **64** Location + Industry cards plus **8** Wild cards
 *    (4 Wild Location + 4 Wild Industry) kept as two separate face-up piles.
 *  - For a player count P < 4, remove every card whose player-count icon > P.
 *  - Location-card colour exclusions by player count: 2P removes blue + teal
 *    location cards; 3P removes teal; 4P uses all.
 *  - Excluded locations can still be BUILT in; they are just not drawable.
 *
 * VERIFY: the exact multiset of which town gets how many Location cards, the
 * Industry-card counts, and each card's player-count icon are printed on the
 * physical cards. They are encoded here as a coherent set that (a) totals 64 at
 * 4 players and (b) shrinks correctly under the colour/player-count rules
 * (enforced by the validation test). Era LENGTH is governed by the rulebook's
 * fixed 8/9/10 rounds (see engine/phases), independent of deck size, so minor
 * deck differences never change how long an era lasts.
 */

export interface DeckCard extends CardDef {
  /** Minimum player count at which this card is included (its icon). */
  minPlayers: 1 | 2 | 3 | 4;
  /** For location cards: the banner colour (for the 2P/3P exclusion rule). */
  colorBand?: string;
  /** Unique id within the deck definition. */
  uid: string;
}

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

// --- Location cards: two per town by default; a handful gated to 3P/4P so the
// deck shrinks for lower player counts beyond the colour exclusions. ---
const LOCATION_CARDS: DeckCard[] = TOWNS.flatMap((t): DeckCard[] => {
  const base: DeckCard = {
    kind: 'location',
    locationId: t.id,
    name: t.name,
    colorBand: t.colorBand,
    minPlayers: 1,
    uid: uid('loc'),
  };
  const second: DeckCard = { ...base, minPlayers: 1, uid: uid('loc') };
  return [base, second];
});

// Promote a few central-town location cards to higher player-count icons so 2P
// and 3P decks are appropriately smaller (in addition to colour exclusions).
function gate(locId: string, minPlayers: DeckCard['minPlayers']): void {
  const card = LOCATION_CARDS.find((c) => c.locationId === locId && c.minPlayers === 1);
  if (card) card.minPlayers = minPlayers;
}
gate('birmingham', 3);
gate('coventry', 4);
gate('redditch', 4);
gate('nuneaton', 3);

// --- Industry cards (not affected by colour exclusion). ---
function industryCards(industry: IndustryType, specs: DeckCard['minPlayers'][]): DeckCard[] {
  return specs.map((minPlayers) => ({
    kind: 'industry',
    industries: [industry],
    name: `industry.${industry}`,
    minPlayers,
    uid: uid('ind'),
  }));
}

const INDUSTRY_CARDS: DeckCard[] = [
  ...industryCards('coal', [1, 1, 2]),
  ...industryCards('iron', [1, 1, 1, 2]),
  ...industryCards('cotton', [1, 1, 2, 3, 4]),
  ...industryCards('manufacturer', [1, 1, 2, 3, 4]),
  ...industryCards('pottery', [1, 2, 4]),
  ...industryCards('brewery', [1, 1, 2, 4]),
];

/** The full 4-player deck definition (Location + Industry cards). */
export const FULL_DECK: DeckCard[] = [...LOCATION_CARDS, ...INDUSTRY_CARDS];

export const WILD_LOCATION_COUNT = 4;
export const WILD_INDUSTRY_COUNT = 4;

/** Banner colours excluded from the Location-card deck per player count. */
export const EXCLUDED_BANDS: Record<number, string[]> = {
  2: ['blue', 'teal'],
  3: ['teal'],
  4: [],
};

/**
 * Build the draw-deck card list for a given player count (before shuffling).
 * Applies both the player-count icon rule and the colour-exclusion rule.
 */
export function buildDeckCards(players: number): DeckCard[] {
  const excluded = EXCLUDED_BANDS[players] ?? [];
  return FULL_DECK.filter((c) => {
    if (c.minPlayers > players) return false;
    if (c.kind === 'location' && c.colorBand && excluded.includes(c.colorBand)) return false;
    return true;
  });
}

/** Total cards in the full (4P) deck — must be 64 per the rulebook. */
export const FULL_DECK_SIZE = FULL_DECK.length;
