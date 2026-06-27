import type { GameState, MarketTrack } from '../model/state.ts';
import type { GameEvent } from '../model/events.ts';
import type { ResourceSource } from '../model/actions.ts';
import type { PlayerColor } from '../model/types.ts';
import { PLAYER_COLORS } from '../model/types.ts';
import {
  isMarketResource,
  fixedUnitPrice,
  PLAYER_TRADE_MARKUP,
  type StockResource,
} from '../data/economy.ts';
import { nextBuyPrice, buyFromMarket } from './market.ts';
import { getPlayer, spend, payPlayer } from './helpers.ts';
import { isConnectedToMerchant } from '../selectors/resources.ts';

/**
 * MYSpolly resource consumption (§7.16, revised by §7.17).
 *
 * A player consumes coal / iron / juice for an action. Each required unit is
 * sourced in this strict order (§7.17.3):
 *   1. the acting player's OWN stockpile (free),
 *   2. the relevant **market** — coal/iron only, and only when connected to a
 *      merchant (iron needs no connection); markets are Brass price ladders that
 *      fall back to a fixed `emptyPrice` once empty, so a connected market can
 *      always cover the shortfall,
 *   3. another **player's** stockpile — the buyer pays that player the market
 *      buy price (coal/iron) or the fixed price (non-market resources),
 *   4. a general fixed-price **supply** — non-market resources only (juice),
 *      always available at the configured fixed price (paid to the bank).
 *
 * Every non-stockpile unit is priced exactly and the action's affordability is
 * `totalCost <= money` (checked by the validators before anything is spent).
 */

/** Source + money price of a single consumed unit. */
export interface ResourceUnit {
  /** `'stock'` | `'market'` | `'supply'` | a player color (bought from them). */
  from: 'stock' | 'market' | 'supply' | PlayerColor;
  /** The owner color when `from` is a player; otherwise undefined. */
  owner?: PlayerColor;
  /** Money paid for this single unit (0 for the stockpile). */
  cost: number;
}

export interface ResourcePlan {
  /** Whether the requirement can be met (stockpile + market + players + supply). */
  ok: boolean;
  /** The exact per-unit sourcing (length === count when `ok`). */
  units: ResourceUnit[];
  /** Units drawn from the player's own stockpile. */
  fromStock: number;
  /** Units bought from the coal/iron market. */
  fromMarket: number;
  /** Units bought from a general fixed-price supply. */
  fromSupply: number;
  /** Units bought from other players, keyed by owner color. */
  fromPlayers: Partial<Record<PlayerColor, number>>;
  /** Total money cost of all non-stockpile units. */
  totalCost: number;
  /** i18n key explaining why the requirement cannot be met (when `!ok`). */
  reasonKey?: string;
}

function marketFor(state: GameState, resource: StockResource): MarketTrack | null {
  if (resource === 'coal') return state.coalMarket;
  if (resource === 'iron') return state.ironMarket;
  return null;
}

/** Can a market shortfall be bought for `resource` from `loc`? */
function marketConnectionOk(
  state: GameState,
  resource: StockResource,
  loc: string | undefined,
): boolean {
  if (resource === 'iron') return true; // iron market needs no connection
  if (resource === 'coal') return loc !== undefined && isConnectedToMerchant(state, loc);
  return false; // non-market resource (juice) is never bought from a market
}

/** Other players (not `player`) that hold `resource`, in buy-preference order. */
function sellerOrder(
  state: GameState,
  player: PlayerColor,
  resource: StockResource,
  prefer: PlayerColor[],
): PlayerColor[] {
  const holders = PLAYER_COLORS.filter(
    (c) => c !== player && (state.players[c]?.resources[resource] ?? 0) > 0,
  );
  // Honour any explicit preference first (UI picker), then most-available, then
  // a stable color order — a deterministic "sensible default" for the AI.
  return [...holders].sort((a, b) => {
    const pa = prefer.indexOf(a);
    const pb = prefer.indexOf(b);
    if (pa !== pb) return (pa < 0 ? Infinity : pa) - (pb < 0 ? Infinity : pb);
    const sa = state.players[a]!.resources[resource];
    const sb = state.players[b]!.resources[resource];
    if (sa !== sb) return sb - sa;
    return PLAYER_COLORS.indexOf(a) - PLAYER_COLORS.indexOf(b);
  });
}

/**
 * Plan consuming `count` of `resource` for `player` (§7.17.3). Pure — performs
 * no mutation; computes the exact per-unit sourcing and total money cost so the
 * validators can check `totalCost <= money` and the preview can itemize it.
 * `prefer` lets the UI nominate which other player(s) to buy from first.
 */
export function planResource(
  state: GameState,
  player: PlayerColor,
  resource: StockResource,
  count: number,
  loc?: string,
  prefer: PlayerColor[] = [],
): ResourcePlan {
  const units: ResourceUnit[] = [];
  const fromPlayers: Partial<Record<PlayerColor, number>> = {};
  let fromStock = 0;
  let fromMarket = 0;
  let fromSupply = 0;
  let totalCost = 0;

  if (count <= 0) {
    return { ok: true, units, fromStock, fromMarket, fromSupply, fromPlayers, totalCost };
  }

  // 1. Own stockpile.
  const stock = getPlayer(state, player).resources[resource];
  const takeStock = Math.min(stock, count);
  for (let i = 0; i < takeStock; i += 1) units.push({ from: 'stock', cost: 0 });
  fromStock = takeStock;
  let need = count - takeStock;

  // 2. Market (coal/iron only, when connected). A market can always satisfy the
  //    rest of the shortfall (it falls back to `emptyPrice` once empty).
  if (need > 0 && isMarketResource(resource) && marketConnectionOk(state, resource, loc)) {
    const market = marketFor(state, resource)!;
    let cubes = market.cubes;
    for (let i = 0; i < need; i += 1) {
      const price =
        cubes > 0
          ? (market.priceLadder[market.capacity - cubes] ?? market.emptyPrice)
          : market.emptyPrice;
      if (cubes > 0) cubes -= 1;
      units.push({ from: 'market', cost: price });
      totalCost += price;
    }
    fromMarket = need;
    need = 0;
  }

  // 3. Other players' stockpiles (pay that player).
  if (need > 0) {
    const market = marketFor(state, resource);
    const unitPrice = (): number => {
      const base = isMarketResource(resource)
        ? nextBuyPrice(market!)
        : (fixedUnitPrice(resource) ?? 0);
      return base + PLAYER_TRADE_MARKUP;
    };
    for (const seller of sellerOrder(state, player, resource, prefer)) {
      if (need <= 0) break;
      let avail = state.players[seller]!.resources[resource];
      while (need > 0 && avail > 0) {
        const price = unitPrice();
        units.push({ from: seller, owner: seller, cost: price });
        fromPlayers[seller] = (fromPlayers[seller] ?? 0) + 1;
        totalCost += price;
        avail -= 1;
        need -= 1;
      }
    }
  }

  // 4. General fixed-price supply (non-market resources only — unlimited).
  if (need > 0 && !isMarketResource(resource)) {
    const price = fixedUnitPrice(resource) ?? 0;
    for (let i = 0; i < need; i += 1) {
      units.push({ from: 'supply', cost: price });
      totalCost += price;
    }
    fromSupply = need;
    need = 0;
  }

  if (need > 0) {
    return {
      ok: false,
      units,
      fromStock,
      fromMarket,
      fromSupply,
      fromPlayers,
      totalCost,
      reasonKey: isMarketResource(resource) ? 'flow.why.noResource' : 'flow.why.noResource',
    };
  }

  return { ok: true, units, fromStock, fromMarket, fromSupply, fromPlayers, totalCost };
}

/**
 * The ordered list of preferred seller colors named by a set of resource
 * sources (the UI picker's `{from:'player'; color}` entries). Used to thread a
 * human's choice of which player to buy from into `planResource`/
 * `consumeResource`; an empty list means "use the engine's sensible default".
 */
export function preferredSellers(sources: ResourceSource[] | undefined): PlayerColor[] {
  if (!sources) return [];
  const out: PlayerColor[] = [];
  for (const s of sources) {
    if (s.from === 'player' && !out.includes(s.color)) out.push(s.color);
  }
  return out;
}

/**
 * Consume `count` of `resource` for `player`, applying the plan from
 * `planResource`: spend from the stockpile, buy from the market (moving its
 * price), buy from other players (paying them), and buy from the fixed-price
 * supply — emitting one `RESOURCE_CONSUMED` event per unit (with its money
 * `cost`) so previews and the log reconcile to the cube. Throws if the
 * requirement cannot be met (callers must `planResource` first).
 */
export function consumeResource(
  state: GameState,
  player: PlayerColor,
  resource: StockResource,
  count: number,
  loc: string | undefined,
  events: GameEvent[],
  prefer: PlayerColor[] = [],
): void {
  if (count <= 0) return;
  const plan = planResource(state, player, resource, count, loc, prefer);
  if (!plan.ok) {
    throw new Error(`Cannot consume ${count} ${resource}: requirement not satisfiable`);
  }
  const p = getPlayer(state, player);
  const market = marketFor(state, resource);
  for (const unit of plan.units) {
    if (unit.from === 'stock') {
      p.resources[resource] -= 1;
      events.push({ t: 'RESOURCE_CONSUMED', resource, from: 'stock', player, cost: 0 });
    } else if (unit.from === 'market') {
      const cost = buyFromMarket(market!, 1);
      if (cost > 0) spend(state, player, cost, events);
      events.push({ t: 'RESOURCE_CONSUMED', resource, from: 'market', player, cost });
    } else if (unit.from === 'supply') {
      if (unit.cost > 0) spend(state, player, unit.cost, events);
      events.push({ t: 'RESOURCE_CONSUMED', resource, from: 'supply', player, cost: unit.cost });
    } else {
      // Bought from another player: pay that owner and take a unit of their stock.
      const owner = unit.owner ?? unit.from;
      payPlayer(state, player, owner, unit.cost, events);
      state.players[owner]!.resources[resource] -= 1;
      events.push({
        t: 'RESOURCE_CONSUMED',
        resource,
        from: `player:${owner}`,
        player,
        cost: unit.cost,
      });
    }
  }
}

/**
 * Validate + consume juice for a Sell from a set of sources. Each juice unit is
 * either the player's own stockpile (`{from:'stock'}`) or a connected merchant's
 * barrel (`{from:'merchantJuice'}`, which is consumed and grants its bonus).
 * Returns the merchant ids whose juice was used so the caller can apply bonuses.
 */
export function consumeSellJuice(
  state: GameState,
  player: PlayerColor,
  sources: ResourceSource[],
  events: GameEvent[],
): string[] {
  const merchantJuiceUsed: string[] = [];
  const p = getPlayer(state, player);
  for (const src of sources) {
    if (src.from === 'stock') {
      if (p.resources.juice <= 0) throw new Error('No juice in stockpile to sell');
      p.resources.juice -= 1;
      events.push({ t: 'RESOURCE_CONSUMED', resource: 'juice', from: 'stock', player, cost: 0 });
    } else if (src.from === 'merchantJuice') {
      const merchant = state.merchants.find((m) => m.id === src.merchantId);
      if (!merchant || !merchant.hasJuice) {
        throw new Error(`Merchant juice ${src.merchantId} unavailable`);
      }
      merchant.hasJuice = false;
      merchantJuiceUsed.push(merchant.id);
      events.push({
        t: 'RESOURCE_CONSUMED',
        resource: 'juice',
        from: merchant.id,
        player,
        cost: 0,
      });
    } else {
      throw new Error('Invalid juice source for Sell');
    }
  }
  return merchantJuiceUsed;
}
