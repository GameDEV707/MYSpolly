import type { GameState, Card, PlacedTile, PlacedLink } from '../../../core/model/state.ts';
import type { Action, ActionType } from '../../../core/model/actions.ts';
import type { GameEvent } from '../../../core/model/events.ts';
import type { IndustryType } from '../../../core/model/types.ts';
import { TOWN_BY_ID } from '../../../core/data/board.ts';
import { getLevelDef } from '../../../core/data/industries.ts';
import { validate, reduce } from '../../../core/engine/reduce.ts';
import type { FlowSel } from './flowStore.ts';

/**
 * Pure helpers that turn the engine's flat `legalActions` list + the player's
 * step-by-step selection (`FlowSel`) into the human-readable, guided choices the
 * UI presents (§7.13). No raw enumerations leak to the player: each step exposes
 * only the meaningful next choice, and the final concrete Action is reused from
 * `legalActions` (so resource sources / juice stay valid) or, for Scout, built and
 * validated directly.
 */

export const ACTION_ORDER: ActionType[] = [
  'BUILD',
  'NETWORK',
  'DEVELOP',
  'SELL',
  'LOAN',
  'SCOUT',
  'PASS',
];

export type Step =
  | 'action'
  | 'card'
  | 'buildLocation'
  | 'buildVariant'
  | 'network'
  | 'sellTile'
  | 'sellMerchant'
  | 'develop'
  | 'scout'
  | 'confirm';

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

export function currentStep(sel: FlowSel): Step {
  if (!sel.actionType) return 'action';
  if (!sel.cardId) return 'card';
  switch (sel.actionType) {
    case 'BUILD':
      if (!sel.locationId) return 'buildLocation';
      if (!(sel.industry && sel.slotId)) return 'buildVariant';
      return 'confirm';
    case 'NETWORK':
      return sel.lineIds.length === 0 ? 'network' : 'confirm';
    case 'SELL':
      if (!sel.locationId) return 'sellTile';
      if (!sel.merchantId) return 'sellMerchant';
      return 'confirm';
    case 'DEVELOP':
      return sel.removals.length === 0 ? 'develop' : 'confirm';
    case 'SCOUT':
      return sel.discardIds.length < 2 ? 'scout' : 'confirm';
    case 'LOAN':
    case 'PASS':
      return 'confirm';
    default:
      return 'confirm';
  }
}

/** Whether the current step expects the player to click the board. */
export function isBoardTargetStep(sel: FlowSel): boolean {
  const s = currentStep(sel);
  if (sel.actionType === 'BUILD') return s === 'buildLocation';
  if (sel.actionType === 'SELL') return s === 'sellTile';
  if (sel.actionType === 'NETWORK') return s === 'network' || s === 'confirm';
  return false;
}

export function availableActionTypes(acts: Action[]): Set<ActionType> {
  return new Set(acts.map((a) => a.type));
}

/** i18n key explaining why an action type is unavailable. */
export function whyDisabledKey(type: ActionType): string {
  return `flow.why.${type.toLowerCase()}`;
}

function tileLocation(game: GameState, tileId: string): string | undefined {
  return game.tiles.find((t) => t.id === tileId)?.locationId;
}

/** Distinct hand cards usable for the chosen action type. */
export function cardsForAction(game: GameState, acts: Action[], type: ActionType): Card[] {
  const hand = game.players[game.activePlayer]?.hand ?? [];
  const ids = new Set(acts.filter((a) => a.type === type).map((a) => a.card.cardId));
  return hand.filter((c) => ids.has(c.id));
}

export function buildLocations(acts: Action[], cardId: string): string[] {
  const set = new Set<string>();
  for (const a of acts) if (a.type === 'BUILD' && a.card.cardId === cardId) set.add(a.locationId);
  return [...set];
}

export interface BuildVariant {
  industry: IndustryType;
  slotId: string;
  slotIndex: number;
  costMoney: number;
}

export function buildVariants(
  game: GameState,
  acts: Action[],
  cardId: string,
  locationId: string,
): BuildVariant[] {
  const p = game.players[game.activePlayer]!;
  const loc = TOWN_BY_ID[locationId];
  const out: BuildVariant[] = [];
  const seen = new Set<string>();
  for (const a of acts) {
    if (a.type !== 'BUILD' || a.card.cardId !== cardId || a.locationId !== locationId) continue;
    const key = `${a.industry}/${a.slotId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const level = p.matStacks[a.industry]?.[0];
    const costMoney = level !== undefined ? getLevelDef(a.industry, level).costMoney : 0;
    out.push({
      industry: a.industry,
      slotId: a.slotId,
      slotIndex: (loc?.slots.findIndex((s) => s.id === a.slotId) ?? 0) + 1,
      costMoney,
    });
  }
  return out;
}

export function sellLocations(game: GameState, acts: Action[], cardId: string): string[] {
  const set = new Set<string>();
  for (const a of acts) {
    if (a.type !== 'SELL' || a.card.cardId !== cardId) continue;
    const loc = tileLocation(game, a.sales[0]!.tileId);
    if (loc) set.add(loc);
  }
  return [...set];
}

export function sellMerchants(
  game: GameState,
  acts: Action[],
  cardId: string,
  locationId: string,
): string[] {
  const set = new Set<string>();
  for (const a of acts) {
    if (a.type !== 'SELL' || a.card.cardId !== cardId) continue;
    if (tileLocation(game, a.sales[0]!.tileId) !== locationId) continue;
    set.add(a.sales[0]!.merchantId);
  }
  return [...set];
}

export function developFirstOptions(acts: Action[], cardId: string): IndustryType[] {
  const set = new Set<IndustryType>();
  for (const a of acts) {
    if (a.type === 'DEVELOP' && a.card.cardId === cardId) set.add(a.removals[0]!);
  }
  return [...set];
}

export function developSecondOptions(
  acts: Action[],
  cardId: string,
  first: IndustryType,
): IndustryType[] {
  const set = new Set<IndustryType>();
  for (const a of acts) {
    if (a.type !== 'DEVELOP' || a.card.cardId !== cardId || a.removals.length !== 2) continue;
    if (a.removals[0] === first) set.add(a.removals[1]!);
  }
  return [...set];
}

/** Network link lines that can be added given the current selection. */
export function networkAddable(acts: Action[], cardId: string, lineIds: string[]): string[] {
  const nets = acts.filter((a) => a.type === 'NETWORK' && a.card.cardId === cardId);
  if (lineIds.length === 0) {
    const set = new Set<string>();
    for (const a of nets) if (a.type === 'NETWORK') a.links.forEach((l) => set.add(l.lineId));
    return [...set];
  }
  if (lineIds.length === 1) {
    const set = new Set<string>();
    for (const a of nets) {
      if (a.type !== 'NETWORK' || a.links.length !== 2) continue;
      const ids = a.links.map((l) => l.lineId);
      if (ids.includes(lineIds[0]!)) ids.filter((x) => x !== lineIds[0]).forEach((x) => set.add(x));
    }
    return [...set];
  }
  return [];
}

/** Build the final concrete Action from the selection, or null if incomplete. */
export function finalAction(game: GameState, acts: Action[], sel: FlowSel): Action | null {
  if (!sel.actionType || !sel.cardId) return null;
  const cardId = sel.cardId;

  if (sel.actionType === 'SCOUT') {
    if (sel.discardIds.length !== 2) return null;
    const action: Action = {
      type: 'SCOUT',
      card: { cardId },
      extraDiscards: [{ cardId: sel.discardIds[0]! }, { cardId: sel.discardIds[1]! }],
    };
    return validate(game, action) === null ? action : null;
  }

  for (const a of acts) {
    if (a.type !== sel.actionType || a.card.cardId !== cardId) continue;
    switch (a.type) {
      case 'BUILD':
        if (
          a.locationId === sel.locationId &&
          a.industry === sel.industry &&
          a.slotId === sel.slotId
        )
          return a;
        break;
      case 'NETWORK':
        if (
          sameSet(
            a.links.map((l) => l.lineId),
            sel.lineIds,
          )
        )
          return a;
        break;
      case 'SELL':
        if (
          tileLocation(game, a.sales[0]!.tileId) === sel.locationId &&
          a.sales[0]!.merchantId === sel.merchantId
        )
          return a;
        break;
      case 'DEVELOP':
        if (sameSet(a.removals, sel.removals)) return a;
        break;
      case 'LOAN':
      case 'PASS':
        return a;
      default:
        break;
    }
  }
  return null;
}

export interface ActionPreview {
  money: number;
  vp: number;
  income: number;
  coal: number;
  iron: number;
  juice: number;
  flips: number;
  placedTiles: PlacedTile[];
  placedLinks: PlacedLink[];
}

/**
 * Cost & effect preview (§7.13) computed by dry-running the pure reducer and
 * reading the events that belong to the action itself (everything up to and
 * including `ACTION_DONE`, before any end-of-turn bookkeeping).
 */
export function previewAction(game: GameState, action: Action): ActionPreview | null {
  let events: GameEvent[];
  try {
    events = reduce(game, action).events;
  } catch {
    return null;
  }
  const idx = events.findIndex((e) => e.t === 'ACTION_DONE');
  const slice = idx >= 0 ? events.slice(0, idx + 1) : events;
  const player = game.activePlayer;
  const p: ActionPreview = {
    money: 0,
    vp: 0,
    income: 0,
    coal: 0,
    iron: 0,
    juice: 0,
    flips: 0,
    placedTiles: [],
    placedLinks: [],
  };
  for (const e of slice) {
    if (e.t === 'MONEY_CHANGED' && e.player === player) p.money += e.delta;
    else if (e.t === 'VP_CHANGED' && e.player === player) p.vp += e.delta;
    else if (e.t === 'INCOME_CHANGED' && e.player === player) p.income += e.delta;
    else if (e.t === 'RESOURCE_CONSUMED' && e.player === player) {
      if (e.resource === 'coal') p.coal += 1;
      else if (e.resource === 'iron') p.iron += 1;
      else if (e.resource === 'juice') p.juice += 1;
    } else if (e.t === 'TILE_FLIPPED' && e.player === player) p.flips += 1;
    else if (e.t === 'TILE_PLACED') p.placedTiles.push(e.tile);
    else if (e.t === 'LINK_PLACED') p.placedLinks.push(e.link);
  }
  return p;
}

/** Locations / lines to glow for the current targeting step. */
export function flowHighlights(
  game: GameState,
  acts: Action[],
  sel: FlowSel,
): { locs: Set<string>; lines: Set<string> } {
  const locs = new Set<string>();
  const lines = new Set<string>();
  if (!sel.actionType || !sel.cardId) return { locs, lines };
  if (sel.actionType === 'BUILD') {
    if (!sel.locationId) buildLocations(acts, sel.cardId).forEach((l) => locs.add(l));
    else locs.add(sel.locationId);
  } else if (sel.actionType === 'SELL') {
    if (!sel.locationId) sellLocations(game, acts, sel.cardId).forEach((l) => locs.add(l));
    else locs.add(sel.locationId);
  } else if (sel.actionType === 'NETWORK') {
    sel.lineIds.forEach((l) => lines.add(l));
    networkAddable(acts, sel.cardId, sel.lineIds).forEach((l) => lines.add(l));
  }
  return { locs, lines };
}

export interface PromptInfo {
  key: string;
  params?: Record<string, string | number>;
}

/** A concise localized prompt for the current step (drives the Turn HUD). */
export function promptInfo(t: (k: string) => string, sel: FlowSel): PromptInfo {
  const step = currentStep(sel);
  const action = sel.actionType ? t(`action.${sel.actionType.toLowerCase()}`) : '';
  const loc = sel.locationId ? t(TOWN_BY_ID[sel.locationId]?.name ?? sel.locationId) : '';
  switch (step) {
    case 'action':
      return { key: 'flow.prompt.action' };
    case 'card':
      return { key: 'flow.prompt.card', params: { action } };
    case 'buildLocation':
      return { key: 'flow.prompt.buildLocation' };
    case 'buildVariant':
      return { key: 'flow.prompt.buildVariant', params: { location: loc } };
    case 'network':
      return { key: 'flow.prompt.network' };
    case 'sellTile':
      return { key: 'flow.prompt.sellTile' };
    case 'sellMerchant':
      return { key: 'flow.prompt.sellMerchant', params: { location: loc } };
    case 'develop':
      return { key: 'flow.prompt.develop' };
    case 'scout':
      return { key: 'flow.prompt.scout' };
    case 'confirm':
      return { key: 'flow.prompt.confirm', params: { action } };
    default:
      return { key: 'flow.prompt.action' };
  }
}
