import type { GameState, PlacedTile, Card } from '../../model/state.ts';
import type { GameEvent } from '../../model/events.ts';
import type { BuildAction } from '../../model/actions.ts';
import type { IndustryType, PlayerColor } from '../../model/types.ts';
import { getLevelDef, juiceBarrelsForEra } from '../../data/industries.ts';
import { boardContext } from '../../maps/context.ts';
import { buildableInEra } from '../../maps/eraRules.ts';
import { getPlayer, spend } from '../helpers.ts';
import { mintId } from '../setup.ts';
import { consumeCoal, consumeIron, resolveCoal, resolveIron } from '../consume.ts';
import { playerNetwork, hasNoPresence } from '../../selectors/connectivity.ts';
import { isConnectedToMerchant } from '../../selectors/resources.ts';
import { sellToMarket } from '../market.ts';
import { advanceIncome } from '../helpers.ts';

function occupantAt(state: GameState, locationId: string, slotId: string): PlacedTile | undefined {
  return state.tiles.find((t) => t.locationId === locationId && t.slotId === slotId);
}

function cardPermitsLocation(card: Card, locationId: string, isFarm: boolean): boolean {
  if (card.kind === 'location') return card.locationId === locationId;
  if (card.kind === 'wildLocation') return !isFarm; // wild location can't build the 2 farm juiceWorks
  return true; // industry / wildIndustry cards are not location-restricted here
}

function cardPermitsIndustry(card: Card, industry: IndustryType): boolean {
  if (card.kind === 'industry') return (card.industries ?? []).includes(industry);
  if (card.kind === 'wildIndustry') return true;
  return true; // location / wildLocation cards permit any industry
}

/** Validate a Build action; returns an error message or null if legal. */
export function validateBuild(
  state: GameState,
  player: PlayerColor,
  a: BuildAction,
): string | null {
  const p = getPlayer(state, player);
  const card = p.hand.find((c) => c.id === a.card.cardId);
  if (!card) return 'Card not in hand';

  const loc = boardContext(state).locationById[a.locationId];
  if (!loc) return 'Unknown or non-buildable location';
  const isFarm = loc.isFarmJuice === true;

  const slot = loc.slots.find((s) => s.id === a.slotId);
  if (!slot) return 'Unknown slot';
  if (!slot.allowed.includes(a.industry)) return 'Slot does not allow that industry';

  // Farm juiceWorks: only a Juice / Wild Industry card may build (a juice).
  if (isFarm) {
    if (a.industry !== 'juice') return 'Farm spaces only take juiceWorks';
    if (card.kind === 'location' || card.kind === 'wildLocation') {
      return 'Farm juiceWorks need a Juice or Wild Industry card';
    }
  }

  if (!cardPermitsLocation(card, a.locationId, isFarm)) return 'Card does not permit that location';
  if (!cardPermitsIndustry(card, a.industry)) return 'Card does not permit that industry';

  // Industry / wild-industry cards: location must be in network (unless no presence).
  if (card.kind === 'industry' || card.kind === 'wildIndustry') {
    if (!hasNoPresence(state, player)) {
      if (!playerNetwork(state, player).has(a.locationId)) {
        return 'Location is not in your network';
      }
    }
  }

  // Tile availability (lowest level on mat).
  const stack = p.matStacks[a.industry];
  if (!stack || stack.length === 0) return 'No tiles of that industry left on your mat';
  const level = stack[0] as number;
  const def = getLevelDef(a.industry, level);
  if (!buildableInEra(def, state.era)) {
    return 'That tile cannot be built in the current era';
  }

  // One tile per player per location.
  if (
    state.tiles.some(
      (t) => t.owner === player && t.locationId === a.locationId && !a.overbuildTileId,
    )
  ) {
    return 'You already have a tile in that location';
  }

  // Slot occupancy / overbuild.
  const occupant = occupantAt(state, a.locationId, a.slotId);
  if (occupant) {
    if (!a.overbuildTileId || a.overbuildTileId !== occupant.id) {
      return 'Slot is occupied (set overbuildTileId to overbuild)';
    }
    const ob = overbuildError(state, player, occupant, a.industry, level);
    if (ob) return ob;
  } else if (a.overbuildTileId) {
    return 'overbuildTileId set but slot is empty';
  }

  // Resource availability.
  if (def.costIron > 0 && !resolveIron(state, def.costIron)) return 'Cannot obtain required iron';
  if (def.costCoal > 0 && !resolveCoal(state, a.locationId, def.costCoal)) {
    return 'Cannot obtain required coal (need a connection)';
  }

  // Affordability (money cost + market purchases).
  const ironCost = def.costIron > 0 ? (resolveIron(state, def.costIron)?.marketCost ?? 0) : 0;
  const coalCost =
    def.costCoal > 0 ? (resolveCoal(state, a.locationId, def.costCoal)?.marketCost ?? 0) : 0;
  if (p.money < def.costMoney + ironCost + coalCost) return 'Not enough money';

  return null;
}

function overbuildError(
  state: GameState,
  player: PlayerColor,
  occupant: PlacedTile,
  industry: IndustryType,
  newLevel: number,
): string | null {
  if (occupant.industry !== industry) return 'Overbuild must be the same industry';
  if (newLevel <= occupant.level) return 'Overbuild must be a higher level';
  if (occupant.owner !== player) {
    if (industry !== 'coal' && industry !== 'iron') {
      return "Can only overbuild an opponent's Coal Mine or Iron Works";
    }
    // Only when no cubes of that resource exist anywhere (board + market).
    const resource = industry === 'coal' ? 'coal' : 'iron';
    const onBoard = state.tiles
      .filter((t) => t.industry === resource)
      .reduce((s, t) => s + t.resourcesLeft, 0);
    const inMarket = resource === 'coal' ? state.coalMarket.cubes : state.ironMarket.cubes;
    if (onBoard + inMarket > 0)
      return `Can only overbuild when no ${resource} cubes remain anywhere`;
  }
  return null;
}

/** Apply a validated Build action. */
export function applyBuild(
  state: GameState,
  player: PlayerColor,
  a: BuildAction,
  events: GameEvent[],
): void {
  const p = getPlayer(state, player);
  const stack = p.matStacks[a.industry];
  const level = stack.shift() as number;
  const def = getLevelDef(a.industry, level);

  // Overbuilt tile leaves the game (no scoring; prior gains kept).
  const occupant = occupantAt(state, a.locationId, a.slotId);
  if (occupant && a.overbuildTileId === occupant.id) {
    state.tiles = state.tiles.filter((t) => t.id !== occupant.id);
  }

  // Pay money cost.
  spend(state, player, def.costMoney, events);

  // Consume iron (any works, else market) and coal (connected, else market).
  if (def.costIron > 0) {
    const sources =
      a.ironSources.length > 0 ? a.ironSources : (resolveIron(state, def.costIron)?.sources ?? []);
    consumeIron(state, player, sources.slice(0, def.costIron), events);
  }
  if (def.costCoal > 0) {
    const sources =
      a.coalSources.length > 0
        ? a.coalSources
        : (resolveCoal(state, a.locationId, def.costCoal)?.sources ?? []);
    consumeCoal(state, player, a.locationId, sources.slice(0, def.costCoal), events);
  }

  // Determine cubes/juice produced on the new tile.
  let resourcesLeft = 0;
  if (a.industry === 'coal' || a.industry === 'iron') {
    resourcesLeft = def.resourceCount;
  } else if (a.industry === 'juice') {
    resourcesLeft = juiceBarrelsForEra(state.era);
  }

  const tile: PlacedTile = {
    id: mintId(state, 't'),
    owner: player,
    industry: a.industry,
    level,
    locationId: a.locationId,
    slotId: a.slotId,
    flipped: false,
    resourcesLeft,
  };
  state.tiles.push(tile);
  events.push({
    t: 'TILE_PLACED',
    tile: { ...tile },
    ...(occupant ? { overbuilt: occupant.id } : {}),
  });

  // Move produced coal/iron to market on build.
  if (a.industry === 'coal' && isConnectedToMerchant(state, a.locationId)) {
    moveCubesToMarket(state, tile, 'coal', events);
  } else if (a.industry === 'iron') {
    moveCubesToMarket(state, tile, 'iron', events);
  }
}

/** Move as many cubes as possible from a freshly built mine/works to its market. */
function moveCubesToMarket(
  state: GameState,
  tile: PlacedTile,
  resource: 'coal' | 'iron',
  events: GameEvent[],
): void {
  const market = resource === 'coal' ? state.coalMarket : state.ironMarket;
  const { revenue, sold } = sellToMarket(market, tile.resourcesLeft);
  if (sold > 0) {
    tile.resourcesLeft -= sold;
    if (revenue > 0) {
      const p = getPlayer(state, tile.owner);
      p.money += revenue;
      events.push({ t: 'MONEY_CHANGED', player: tile.owner, delta: revenue, total: p.money });
    }
    events.push({ t: 'CUBE_TO_MARKET', resource, from: tile.id, count: sold, income: revenue });
  }
  // If the last cube left the tile during this move, flip it and advance income.
  if (tile.resourcesLeft === 0 && !tile.flipped) {
    tile.flipped = true;
    const def = getLevelDef(tile.industry, tile.level);
    events.push({
      t: 'TILE_FLIPPED',
      tileId: tile.id,
      incomeGain: def.incomeSpaces,
      player: tile.owner,
    });
    advanceIncome(state, tile.owner, def.incomeSpaces, events);
  }
}

export { occupantAt };
