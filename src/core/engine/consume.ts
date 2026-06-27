import type { GameState } from '../model/state.ts';
import type { GameEvent } from '../model/events.ts';
import type { ResourceSource } from '../model/actions.ts';
import type { PlayerColor } from '../model/types.ts';
import { buyCost, buyFromMarket } from './market.ts';
import { consumeFromTile, findTile, spend } from './helpers.ts';
import {
  coalMineOptions,
  ironWorksOptions,
  isConnectedToMerchant,
  juiceTileOptions,
} from '../selectors/resources.ts';

export interface ResolveResult {
  sources: ResourceSource[];
  /** Money that will be spent buying market cubes. */
  marketCost: number;
}

/**
 * Auto-resolve coal sources for consuming `count` coal at `loc`, cheapest-first:
 * nearest connected coal mines, then the Coal Market (requires a merchant
 * connection). Returns null if it cannot be satisfied.
 */
export function resolveCoal(state: GameState, loc: string, count: number): ResolveResult | null {
  const sources: ResourceSource[] = [];
  const mines = coalMineOptions(state, loc).map((t) => ({ id: t.id, left: t.resourcesLeft }));
  let remaining = count;
  for (const mine of mines) {
    while (mine.left > 0 && remaining > 0) {
      sources.push({ from: 'tile', tileId: mine.id });
      mine.left -= 1;
      remaining -= 1;
    }
    if (remaining === 0) break;
  }
  if (remaining > 0) {
    // Need the market: requires connection to a merchant.
    if (!isConnectedToMerchant(state, loc)) return null;
    let marketCost = 0;
    const m = { ...state.coalMarket };
    for (let i = 0; i < remaining; i += 1) {
      marketCost += buyCost(m, 1);
      if (m.cubes > 0) m.cubes -= 1;
      sources.push({ from: 'market' });
    }
    return { sources, marketCost };
  }
  return { sources, marketCost: 0 };
}

/** Auto-resolve iron sources: any iron works first (free), then the Iron Market. */
export function resolveIron(state: GameState, count: number): ResolveResult | null {
  const sources: ResourceSource[] = [];
  const works = ironWorksOptions(state).map((t) => ({ id: t.id, left: t.resourcesLeft }));
  let remaining = count;
  for (const w of works) {
    while (w.left > 0 && remaining > 0) {
      sources.push({ from: 'tile', tileId: w.id });
      w.left -= 1;
      remaining -= 1;
    }
    if (remaining === 0) break;
  }
  if (remaining > 0) {
    let marketCost = 0;
    const m = { ...state.ironMarket };
    for (let i = 0; i < remaining; i += 1) {
      marketCost += buyCost(m, 1);
      if (m.cubes > 0) m.cubes -= 1;
      sources.push({ from: 'market' });
    }
    return { sources, marketCost };
  }
  return { sources, marketCost: 0 };
}

/** Total money cost of a set of resolved sources that hit the market. */
export function marketSpendFor(
  state: GameState,
  resource: 'coal' | 'iron',
  sources: ResourceSource[],
): number {
  const marketCubes = sources.filter((s) => s.from === 'market').length;
  const m = resource === 'coal' ? state.coalMarket : state.ironMarket;
  return buyCost(m, marketCubes);
}

/**
 * Validate + consume coal at `loc`. Tile sources must be connected coal mines
 * with coal left; market sources require a merchant connection. Spends money
 * for market cubes and flips emptied mines.
 */
export function consumeCoal(
  state: GameState,
  player: PlayerColor,
  loc: string,
  sources: ResourceSource[],
  events: GameEvent[],
): void {
  const connectedMines = new Set(coalMineOptions(state, loc).map((t) => t.id));
  let marketCubes = 0;
  for (const src of sources) {
    if (src.from === 'tile') {
      if (!connectedMines.has(src.tileId)) {
        throw new Error(`Coal mine ${src.tileId} is not a connected source for ${loc}`);
      }
      const tile = findTile(state, src.tileId);
      consumeFromTile(state, tile, 'coal', player, events);
    } else if (src.from === 'market') {
      if (!isConnectedToMerchant(state, loc)) {
        throw new Error(`Cannot buy coal: ${loc} not connected to a merchant`);
      }
      marketCubes += 1;
    } else {
      throw new Error('Invalid coal source');
    }
  }
  if (marketCubes > 0) {
    const cost = buyFromMarket(state.coalMarket, marketCubes);
    spend(state, player, cost, events);
    events.push({ t: 'RESOURCE_CONSUMED', resource: 'coal', from: 'market', player });
  }
}

/** Validate + consume iron. Tile sources may be any iron works; else market. */
export function consumeIron(
  state: GameState,
  player: PlayerColor,
  sources: ResourceSource[],
  events: GameEvent[],
): void {
  let marketCubes = 0;
  for (const src of sources) {
    if (src.from === 'tile') {
      const tile = findTile(state, src.tileId);
      if (tile.industry !== 'iron' || tile.resourcesLeft <= 0) {
        throw new Error(`Tile ${src.tileId} is not an iron source`);
      }
      consumeFromTile(state, tile, 'iron', player, events);
    } else if (src.from === 'market') {
      marketCubes += 1;
    } else {
      throw new Error('Invalid iron source');
    }
  }
  if (marketCubes > 0) {
    const cost = buyFromMarket(state.ironMarket, marketCubes);
    spend(state, player, cost, events);
    events.push({ t: 'RESOURCE_CONSUMED', resource: 'iron', from: 'market', player });
  }
}

/**
 * Validate + consume juice for a Sell from a given location.
 * Juice sources: own juiceWorks (no connection), connected opponents' juiceWorks,
 * or merchant juice beside a connected merchant. Returns the merchant ids whose
 * juice was used (so the caller can apply merchant bonuses).
 */
export function consumeJuice(
  state: GameState,
  player: PlayerColor,
  loc: string,
  sources: ResourceSource[],
  events: GameEvent[],
): string[] {
  const juiceIds = new Set(juiceTileOptions(state, player, loc).map((t) => t.id));
  const merchantJuiceUsed: string[] = [];
  for (const src of sources) {
    if (src.from === 'tile') {
      if (!juiceIds.has(src.tileId)) {
        throw new Error(`Juice ${src.tileId} is not an available juice source`);
      }
      const tile = findTile(state, src.tileId);
      consumeFromTile(state, tile, 'juice', player, events);
    } else if (src.from === 'merchantJuice') {
      const merchant = state.merchants.find((m) => m.id === src.merchantId);
      if (!merchant || !merchant.hasJuice) {
        throw new Error(`Merchant juice ${src.merchantId} unavailable`);
      }
      merchant.hasJuice = false;
      merchantJuiceUsed.push(merchant.id);
      events.push({ t: 'RESOURCE_CONSUMED', resource: 'juice', from: merchant.id, player });
    } else {
      throw new Error('Invalid juice source');
    }
  }
  return merchantJuiceUsed;
}
