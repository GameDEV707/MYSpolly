import type { GameState, PlayerState, Card, MerchantState, MarketTrack } from '../model/state.ts';
import type { IndustryType, PlayerColor } from '../model/types.ts';
import {
  COAL_MARKET,
  IRON_MARKET,
  STARTING_MONEY,
  STARTING_INCOME_LEVEL,
  STARTING_VP,
  HAND_SIZE,
  LINK_TILES_PER_PLAYER,
  ROUNDS_PER_ERA,
  initialMatStacks,
} from '../data/index.ts';
import { getMap, DEFAULT_MAP_ID } from '../maps/registry.ts';
import { buildMapDeck } from '../maps/builder.ts';
import { startingResources } from '../data/economy.ts';
import { makeSeed, shuffle } from '../rng.ts';
import { STATE_VERSION } from '../index.ts';

export interface PlayerSeat {
  color: PlayerColor;
  name: string;
  isAI: boolean;
}

export interface SetupConfig {
  seats: PlayerSeat[];
  introMode?: boolean;
  boardSide?: 'day' | 'night';
  lang?: 'en' | 'ru' | 'uz';
  /** Active map id (§7.15); defaults to the classic Birmingham map. */
  mapId?: string;
  seed: number;
}

function makeMarket(def: typeof COAL_MARKET): MarketTrack {
  return {
    cubes: def.initialCubes,
    capacity: def.priceLadder.length,
    priceLadder: [...def.priceLadder],
    emptyPrice: def.emptyPrice,
  };
}

/** Validate seat configuration. */
function validateSeats(seats: PlayerSeat[]): void {
  if (seats.length < 2 || seats.length > 4) {
    throw new Error(`Brass: Birmingham supports 2–4 players, got ${seats.length}`);
  }
  const colors = new Set(seats.map((s) => s.color));
  if (colors.size !== seats.length) {
    throw new Error('Duplicate player colours in setup');
  }
}

/**
 * Build the full initial GameState for a new game (deterministic given `seed`).
 * Implements the rulebook setup: deck filtering, hands, discard, merchants by
 * player count, market fills, starting money/income/VP, mat stacks, and random
 * initial turn order. The first round of the Canal Era grants only 1 action.
 */
export function buildInitialState(config: SetupConfig): GameState {
  validateSeats(config.seats);
  const players = config.seats.length;
  const mapId = config.mapId ?? DEFAULT_MAP_ID;
  const map = getMap(mapId);
  const firstEra = map.eras[0]!.id;
  let idSeq = 0;
  const mintId = (prefix: string): string => {
    idSeq += 1;
    return `${prefix}${idSeq}`;
  };

  let rngState = makeSeed(config.seed);

  // --- Deck ---
  const deckDefs = buildMapDeck(map, players);
  const deckCards: Card[] = deckDefs.map((d) => ({
    id: mintId('c'),
    kind: d.kind,
    ...(d.locationId !== undefined ? { locationId: d.locationId } : {}),
    ...(d.industries !== undefined ? { industries: [...d.industries] } : {}),
    name: d.name,
  }));
  const shuffled = shuffle(deckCards, rngState);
  rngState = shuffled.state;
  const deck = shuffled.result;

  // --- Players ---
  const playerStates = {} as Record<PlayerColor, PlayerState>;
  for (const seat of config.seats) {
    const hand: Card[] = [];
    for (let i = 0; i < HAND_SIZE; i += 1) {
      const card = deck.shift();
      if (card) hand.push(card);
    }
    const discardStart = deck.shift();
    const matStacks = initialMatStacks() as Record<IndustryType, number[]>;
    playerStates[seat.color] = {
      color: seat.color,
      name: seat.name,
      isAI: seat.isAI,
      money: STARTING_MONEY,
      incomeLevel: STARTING_INCOME_LEVEL,
      vp: STARTING_VP,
      hand,
      discard: discardStart ? [discardStart] : [],
      matStacks,
      linksLeft: LINK_TILES_PER_PLAYER,
      spentThisTurn: 0,
      resources: startingResources(mapId, players),
    };
  }

  // --- Merchants ---
  const emptyMerchants = map.playerCountRules.emptyMerchants[players] ?? [];
  const merchantLocations = map.merchantLocations[firstEra] ?? [];
  const spaces: { locationId: string; spaceIndex: number }[] = [];
  for (const m of merchantLocations) {
    if (emptyMerchants.includes(m.id)) continue;
    for (let i = 0; i < m.tileSpaces; i += 1) {
      spaces.push({ locationId: m.id, spaceIndex: i });
    }
  }
  const eligibleTiles = map.merchantTiles.filter((t) => t.minPlayers <= players);
  const shuffledTiles = shuffle(eligibleTiles, rngState);
  rngState = shuffledTiles.state;
  const merchants: MerchantState[] = spaces.map((sp, idx) => {
    const tile = shuffledTiles.result[idx] ?? { accepts: [] };
    const accepts = [...tile.accepts] as IndustryType[];
    return {
      id: mintId('m'),
      locationId: sp.locationId,
      spaceIndex: sp.spaceIndex,
      accepts,
      hasJuice: accepts.length > 0, // juice beside non-blank merchants
    };
  });

  // --- Turn order ---
  const colors = config.seats.map((s) => s.color);
  const orderShuffle = shuffle(colors, rngState);
  rngState = orderShuffle.state;
  const turnOrder = orderShuffle.result;

  const state: GameState = {
    version: STATE_VERSION,
    seed: config.seed,
    rngState,
    options: {
      players,
      introMode: config.introMode ?? false,
      boardSide: config.boardSide ?? 'night',
      lang: config.lang ?? 'en',
      mapId,
    },
    era: firstEra,
    round: 1,
    isFirstCanalRound: true,
    turnOrder,
    activePlayer: turnOrder[0] as PlayerColor,
    activeIndex: 0,
    actionsLeftThisTurn: 1, // first Canal round: 1 action
    players: playerStates,
    tiles: [],
    links: [],
    merchants,
    coalMarket: makeMarket(COAL_MARKET),
    ironMarket: makeMarket(IRON_MARKET),
    drawDeck: deck,
    wildLocationPile: 4,
    wildIndustryPile: 4,
    phase: 'playing',
    idSeq,
  };

  // Sanity: rounds-per-era table must contain this player count.
  if (!(players in ROUNDS_PER_ERA)) {
    throw new Error(`No rounds-per-era entry for ${players} players`);
  }

  return state;
}

/** Mint a new unique id within an existing game (advances idSeq). */
export function mintId(state: GameState, prefix: string): string {
  state.idSeq += 1;
  return `${prefix}${state.idSeq}`;
}
