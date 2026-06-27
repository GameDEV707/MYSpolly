import type { GameState } from '../model/state.ts';
import type { GameEvent } from '../model/events.ts';
import type { PlayerColor } from '../model/types.ts';
import {
  applyStockpileCap,
  isProductionIndustry,
  productionForLevel,
  type StockResource,
} from '../data/economy.ts';
import { getPlayer } from './helpers.ts';

/** What a single production building contributes per round. */
export interface BuildingProduction {
  tileId: string;
  industry: StockResource;
  level: number;
  amount: number;
}

/** A player's per-round production: totals + per-building breakdown. */
export interface ProductionBreakdown {
  coal: number;
  iron: number;
  juice: number;
  buildings: BuildingProduction[];
}

/**
 * Compute how much a player's owned production buildings will add to their
 * stockpile next round (§7.16.2). Pure — used by both the income step and the
 * "produces next round" HUD preview. Reflects the buildings' CURRENT levels, so
 * a develop/upgrade is automatically counted from the next round on (§7.16.5).
 */
export function playerProduction(state: GameState, color: PlayerColor): ProductionBreakdown {
  const out: ProductionBreakdown = { coal: 0, iron: 0, juice: 0, buildings: [] };
  for (const tile of state.tiles) {
    if (tile.owner !== color) continue;
    if (!isProductionIndustry(tile.industry)) continue;
    const resource = tile.industry as StockResource;
    const amount = productionForLevel(resource, tile.level);
    if (amount <= 0) continue;
    out[resource] += amount;
    out.buildings.push({ tileId: tile.id, industry: resource, level: tile.level, amount });
  }
  return out;
}

/**
 * Apply a player's per-round production to their stockpile (clamped to the
 * optional caps) and emit a `RESOURCE_PRODUCED` event with the amounts actually
 * added and the new totals. No-op (no event) when nothing is produced.
 */
export function produceResources(state: GameState, color: PlayerColor, events: GameEvent[]): void {
  const prod = playerProduction(state, color);
  const p = getPlayer(state, color);
  const added: Record<StockResource, number> = { coal: 0, iron: 0, juice: 0 };
  for (const resource of ['coal', 'iron', 'juice'] as StockResource[]) {
    const before = p.resources[resource];
    const capped = applyStockpileCap(resource, before + prod[resource]);
    added[resource] = capped - before;
    p.resources[resource] = capped;
  }
  if (added.coal === 0 && added.iron === 0 && added.juice === 0) return;
  events.push({
    t: 'RESOURCE_PRODUCED',
    player: color,
    coal: added.coal,
    iron: added.iron,
    juice: added.juice,
    totals: { ...p.resources },
  });
}
