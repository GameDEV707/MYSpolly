import type { GameState } from '../../model/state.ts';
import type { GameEvent } from '../../model/events.ts';
import type { SellAction } from '../../model/actions.ts';
import { INDUSTRY_TYPES, type IndustryType, type PlayerColor } from '../../model/types.ts';
import { getLevelDef } from '../../data/industries.ts';
import { boardContext } from '../../maps/context.ts';
import { getPlayer, changeMoney, changeVp, advanceIncome, flipTile, findTile } from '../helpers.ts';
import { consumeJuice } from '../consume.ts';
import { reachableFrom } from '../../selectors/connectivity.ts';

const SELLABLE: IndustryType[] = ['cotton', 'manufacturer', 'pottery'];

export function validateSell(state: GameState, player: PlayerColor, a: SellAction): string | null {
  const p = getPlayer(state, player);
  if (!p.hand.find((c) => c.id === a.card.cardId)) return 'Card not in hand';
  if (a.sales.length === 0) return 'No sales specified';

  for (const sale of a.sales) {
    const tile = state.tiles.find((t) => t.id === sale.tileId);
    if (!tile) return 'Sale tile not found';
    if (tile.owner !== player) return 'Can only sell your own tiles';
    if (!SELLABLE.includes(tile.industry)) return 'That industry cannot be sold';
    if (tile.flipped) return 'Tile already sold';

    const merchant = state.merchants.find((m) => m.id === sale.merchantId);
    if (!merchant) return 'Unknown merchant';
    if (!merchant.accepts.includes(tile.industry)) return 'Merchant does not buy that good';
    if (!reachableFrom(state, tile.locationId).has(merchant.locationId)) {
      return 'Merchant is not connected to that tile';
    }

    const def = getLevelDef(tile.industry, tile.level);
    if (sale.juice.length !== def.juiceToSell) {
      return `That tile needs exactly ${def.juiceToSell} juice to sell`;
    }
  }
  return null;
}

export function applySell(
  state: GameState,
  player: PlayerColor,
  a: SellAction,
  events: GameEvent[],
): void {
  for (const sale of a.sales) {
    const tile = findTile(state, sale.tileId);
    const merchantJuiceUsed = consumeJuice(state, player, tile.locationId, sale.juice, events);
    flipTile(state, tile, events);
    for (const merchantId of merchantJuiceUsed) {
      applyMerchantBonus(state, player, merchantId, events);
    }
  }
}

/** Apply a merchant juice bonus (Develop / Income / VP / Money). */
function applyMerchantBonus(
  state: GameState,
  player: PlayerColor,
  merchantId: string,
  events: GameEvent[],
): void {
  const merchant = state.merchants.find((m) => m.id === merchantId);
  if (!merchant) return;
  const def = boardContext(state).merchantById[merchant.locationId];
  if (!def) return;
  events.push({ t: 'MERCHANT_BONUS', player, merchantId, kind: def.bonus });
  switch (def.bonus) {
    case 'money':
      changeMoney(state, player, def.bonusMoney ?? 0, events);
      break;
    case 'income':
      advanceIncome(state, player, def.bonusIncome ?? 0, events);
      break;
    case 'vp':
      changeVp(state, player, def.bonusVp ?? 0, events);
      break;
    case 'develop': {
      // Free develop: remove the lowest developable tile of some industry.
      const p = getPlayer(state, player);
      for (const ind of INDUSTRY_TYPES) {
        const stack = p.matStacks[ind];
        const level = stack[0];
        if (level !== undefined && getLevelDef(ind, level).developable) {
          stack.shift();
          events.push({ t: 'DEVELOP', player, industry: ind });
          break;
        }
      }
      break;
    }
  }
}
