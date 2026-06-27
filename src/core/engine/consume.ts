import type { GameState } from '../model/state.ts';
import type { GameEvent } from '../model/events.ts';
import type { ResourceSource } from '../model/actions.ts';
import type { PlayerColor } from '../model/types.ts';
import type { StockResource } from '../data/economy.ts';
import { buyCost, buyFromMarket } from './market.ts';
import { getPlayer, spend } from './helpers.ts';
import { isConnectedToMerchant } from '../selectors/resources.ts';

/**
 * MYSpolly resource consumption (§7.16).
 *
 * A player consumes coal / iron / juice from their OWN stockpile first. Any
 * shortfall must be bought from the relevant market — but only for coal and
 * iron, and only when connected as the rules require:
 *   - coal: the build/link location must be connected to a merchant,
 *   - iron: no connection needed (the iron market is always reachable),
 *   - juice: has NO market, so a juice shortfall makes the action illegal.
 *
 * Resources are NEVER taken (free or otherwise) from another player's mines /
 * works — that is the whole point of the variant.
 */

export interface ResourcePlan {
  /** Whether the requirement can be met (stockpile + any legal market buy). */
  ok: boolean;
  /** How many units come from the player's own stockpile. */
  fromStock: number;
  /** How many units are bought from the market (coal/iron only). */
  fromMarket: number;
  /** Money cost of the market purchase. */
  marketCost: number;
  /** i18n key explaining why the requirement cannot be met (when `!ok`). */
  reasonKey?: string;
}

/** Can a market shortfall be bought for `resource` from `loc`? */
function marketConnectionOk(
  state: GameState,
  resource: StockResource,
  loc: string | undefined,
): boolean {
  if (resource === 'iron') return true; // iron market needs no connection
  if (resource === 'coal') return loc !== undefined && isConnectedToMerchant(state, loc);
  return false; // juice has no market
}

/**
 * Plan consuming `count` of `resource` for `player`, drawing from the stockpile
 * first then buying the shortfall from the market when legal. Pure (no mutation).
 */
export function planResource(
  state: GameState,
  player: PlayerColor,
  resource: StockResource,
  count: number,
  loc?: string,
): ResourcePlan {
  const stock = getPlayer(state, player).resources[resource];
  const fromStock = Math.min(stock, count);
  const shortfall = count - fromStock;
  if (shortfall <= 0) {
    return { ok: true, fromStock, fromMarket: 0, marketCost: 0 };
  }
  if (resource === 'juice') {
    return {
      ok: false,
      fromStock,
      fromMarket: shortfall,
      marketCost: 0,
      reasonKey: 'flow.why.noJuice',
    };
  }
  if (!marketConnectionOk(state, resource, loc)) {
    return {
      ok: false,
      fromStock,
      fromMarket: shortfall,
      marketCost: 0,
      reasonKey: 'flow.why.noMarket',
    };
  }
  const market = resource === 'coal' ? state.coalMarket : state.ironMarket;
  return { ok: true, fromStock, fromMarket: shortfall, marketCost: buyCost(market, shortfall) };
}

/**
 * Consume `count` of `resource` for `player`: take from the stockpile first,
 * then buy the legal shortfall from the market (paying money + moving prices).
 * Emits one `RESOURCE_CONSUMED` event per unit so previews count exactly.
 * Throws if the requirement cannot be met (callers must `planResource` first).
 */
export function consumeResource(
  state: GameState,
  player: PlayerColor,
  resource: StockResource,
  count: number,
  loc: string | undefined,
  events: GameEvent[],
): void {
  if (count <= 0) return;
  const plan = planResource(state, player, resource, count, loc);
  if (!plan.ok) {
    throw new Error(`Cannot consume ${count} ${resource}: requirement not satisfiable`);
  }
  const p = getPlayer(state, player);
  for (let i = 0; i < plan.fromStock; i += 1) {
    p.resources[resource] -= 1;
    events.push({ t: 'RESOURCE_CONSUMED', resource, from: 'stock', player });
  }
  if (plan.fromMarket > 0) {
    const market = resource === 'coal' ? state.coalMarket : state.ironMarket;
    const cost = buyFromMarket(market, plan.fromMarket);
    if (cost > 0) spend(state, player, cost, events);
    for (let i = 0; i < plan.fromMarket; i += 1) {
      events.push({ t: 'RESOURCE_CONSUMED', resource, from: 'market', player });
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
      events.push({ t: 'RESOURCE_CONSUMED', resource: 'juice', from: 'stock', player });
    } else if (src.from === 'merchantJuice') {
      const merchant = state.merchants.find((m) => m.id === src.merchantId);
      if (!merchant || !merchant.hasJuice) {
        throw new Error(`Merchant juice ${src.merchantId} unavailable`);
      }
      merchant.hasJuice = false;
      merchantJuiceUsed.push(merchant.id);
      events.push({ t: 'RESOURCE_CONSUMED', resource: 'juice', from: merchant.id, player });
    } else {
      throw new Error('Invalid juice source for Sell');
    }
  }
  return merchantJuiceUsed;
}
