import type { GameState, Card } from '../model/state.ts';
import type { Action, ResourceSource, SellSpec } from '../model/actions.ts';
import { INDUSTRY_TYPES, type IndustryType, type PlayerColor } from '../model/types.ts';
import { LOCATIONS, LINK_LINES } from '../data/board.ts';
import { getLevelDef } from '../data/industries.ts';
import { validate } from '../engine/reduce.ts';
import { breweryBeerOptions } from './resources.ts';
import { reachableFrom } from './connectivity.ts';

const SELLABLE: IndustryType[] = ['cotton', 'manufacturer', 'pottery'];

/** Beer sources (length === count) available to sell `tile` at `merchant`, or null. */
function autoBeerForSell(
  state: GameState,
  player: PlayerColor,
  tileLoc: string,
  merchantId: string,
  count: number,
): ResourceSource[] | null {
  if (count === 0) return [];
  const slots: ResourceSource[] = [];
  for (const b of breweryBeerOptions(state, player, tileLoc)) {
    for (let i = 0; i < b.resourcesLeft; i += 1) slots.push({ from: 'tile', tileId: b.id });
  }
  const merchant = state.merchants.find((m) => m.id === merchantId);
  if (merchant?.hasBeer) slots.push({ from: 'merchantBeer', merchantId });
  if (slots.length < count) return null;
  return slots.slice(0, count);
}

/**
 * Enumerate legal actions for the active player. Resource sources for Build,
 * Network and Develop are auto-resolved (cheapest-first) by the engine, so they
 * are left empty here; Sell actions include explicit auto-resolved beer. Every
 * returned action passes `validate`. This is a practical (not exhaustive over
 * all resource permutations) enumeration that drives the UI affordances and AI.
 */
export function legalActions(state: GameState): Action[] {
  if (state.phase !== 'playing') return [];
  const player = state.activePlayer;
  const p = state.players[player];
  if (!p) return [];
  const out: Action[] = [];
  const push = (a: Action): void => {
    if (validate(state, a) === null) out.push(a);
  };

  const hand = p.hand;

  for (const card of hand) {
    const ref = { cardId: card.id };

    // PASS & LOAN with this card.
    push({ type: 'PASS', card: ref });
    push({ type: 'LOAN', card: ref });

    // BUILD: industry × location × slot.
    for (const industry of INDUSTRY_TYPES) {
      const stack = p.matStacks[industry];
      if (!stack || stack.length === 0) continue;
      for (const loc of LOCATIONS) {
        for (const slot of loc.slots) {
          if (!slot.allowed.includes(industry)) continue;
          push({
            type: 'BUILD',
            card: ref,
            industry,
            locationId: loc.id,
            slotId: slot.id,
            coalSources: [],
            ironSources: [],
          });
        }
      }
    }

    // DEVELOP: one or two removals.
    for (const i1 of INDUSTRY_TYPES) {
      push({ type: 'DEVELOP', card: ref, removals: [i1], ironSources: [] });
      for (const i2 of INDUSTRY_TYPES) {
        push({ type: 'DEVELOP', card: ref, removals: [i1, i2], ironSources: [] });
      }
    }

    // NETWORK: single links (canal & rail handled by validate via era).
    for (const line of LINK_LINES) {
      push({ type: 'NETWORK', card: ref, links: [{ lineId: line.id }] });
    }
    // Rail double links (a sample of adjacent pairs to keep this tractable).
    if (state.era === 'rail') {
      for (let i = 0; i < LINK_LINES.length; i += 1) {
        const l1 = LINK_LINES[i]!;
        for (let j = i + 1; j < LINK_LINES.length; j += 1) {
          const l2 = LINK_LINES[j]!;
          if (l1.a === l2.a || l1.a === l2.b || l1.b === l2.a || l1.b === l2.b) {
            push({ type: 'NETWORK', card: ref, links: [{ lineId: l1.id }, { lineId: l2.id }] });
          }
        }
      }
    }

    // SELL: single-tile sales.
    for (const tile of state.tiles) {
      if (tile.owner !== player || tile.flipped || !SELLABLE.includes(tile.industry)) continue;
      const reachable = reachableFrom(state, tile.locationId);
      const def = getLevelDef(tile.industry, tile.level);
      for (const merchant of state.merchants) {
        if (!merchant.accepts.includes(tile.industry)) continue;
        if (!reachable.has(merchant.locationId)) continue;
        const beer = autoBeerForSell(state, player, tile.locationId, merchant.id, def.beerToSell);
        if (!beer) continue;
        const sale: SellSpec = { tileId: tile.id, merchantId: merchant.id, beer };
        push({ type: 'SELL', card: ref, sales: [sale] });
      }
    }
  }

  // SCOUT: discard the action card + two others (one representative combo).
  const nonWild = hand.filter((c: Card) => c.kind !== 'wildLocation' && c.kind !== 'wildIndustry');
  if (nonWild.length >= 3) {
    const [a, b, c] = nonWild;
    if (a && b && c) {
      push({
        type: 'SCOUT',
        card: { cardId: a.id },
        extraDiscards: [{ cardId: b.id }, { cardId: c.id }],
      });
    }
  }

  return out;
}

/** Convenience: does the active player have any legal non-pass action? */
export function hasNonPassAction(state: GameState): boolean {
  return legalActions(state).some((a) => a.type !== 'PASS');
}
