import type { GameState, PlacedTile, Card } from '../../model/state.ts';
import type { GameEvent } from '../../model/events.ts';
import type { BuildAction } from '../../model/actions.ts';
import type { IndustryType, PlayerColor } from '../../model/types.ts';
import { getLevelDef } from '../../data/industries.ts';
import { isProductionIndustry } from '../../data/economy.ts';
import { boardContext } from '../../maps/context.ts';
import { buildableInEra } from '../../maps/eraRules.ts';
import { getPlayer, spend, advanceIncome } from '../helpers.ts';
import { mintId } from '../setup.ts';
import { consumeResource, planResource, preferredSellers } from '../consume.ts';
import { playerNetwork, hasNoPresence } from '../../selectors/connectivity.ts';

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

  // Resource availability + sourcing (§7.17.3): each unit is drawn from the
  // player's stockpile first, then the connected market (coal/iron), then bought
  // from another player, then (non-market only) a fixed-price supply. Coal needs
  // the build location connected to a merchant for any market purchase.
  const ironPrefer = preferredSellers(a.ironSources);
  const coalPrefer = preferredSellers(a.coalSources);
  const ironPlan =
    def.costIron > 0
      ? planResource(state, player, 'iron', def.costIron, undefined, ironPrefer)
      : null;
  if (ironPlan && !ironPlan.ok) return 'Not enough iron (and none buyable)';
  const coalPlan =
    def.costCoal > 0
      ? planResource(state, player, 'coal', def.costCoal, a.locationId, coalPrefer)
      : null;
  if (coalPlan && !coalPlan.ok) return 'Not enough coal (no market connection or seller)';

  // Affordability: the FULL total cost (money + every resource purchase) must be
  // payable without going below £0 (§7.17.1). This also closes the £0-tile
  // loophole: a £0 tile (e.g. Pottery L2/L4) is only buildable when the player
  // can also pay for its required coal/iron.
  const resourceCost = (ironPlan?.totalCost ?? 0) + (coalPlan?.totalCost ?? 0);
  if (p.money < def.costMoney + resourceCost) return 'Not enough money for the full cost';

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

  // Consume iron then coal entirely from the acting player's own resources,
  // buying any shortfall (market → another player → fixed-price supply) per
  // §7.17.3. The UI picker's chosen sellers (if any) are honoured first.
  if (def.costIron > 0) {
    consumeResource(
      state,
      player,
      'iron',
      def.costIron,
      undefined,
      events,
      preferredSellers(a.ironSources),
    );
  }
  if (def.costCoal > 0) {
    consumeResource(
      state,
      player,
      'coal',
      def.costCoal,
      a.locationId,
      events,
      preferredSellers(a.coalSources),
    );
  }

  // In the MYSpolly economy, production buildings (Coal Mine / Iron Works /
  // Juice Works) carry no consumable cubes: they come online immediately
  // (flipped + income) and feed the owner's stockpile each round instead
  // (§7.16.2). All other tiles are placed unflipped as before.
  const isProducer = isProductionIndustry(a.industry);

  const tile: PlacedTile = {
    id: mintId(state, 't'),
    owner: player,
    industry: a.industry,
    level,
    locationId: a.locationId,
    slotId: a.slotId,
    flipped: isProducer,
    resourcesLeft: 0,
  };
  state.tiles.push(tile);
  events.push({
    t: 'TILE_PLACED',
    tile: { ...tile },
    ...(occupant ? { overbuilt: occupant.id } : {}),
  });

  // A freshly built production building comes online: advance income now and
  // score its VP at era end (it is flipped).
  if (isProducer) {
    events.push({
      t: 'TILE_FLIPPED',
      tileId: tile.id,
      incomeGain: def.incomeSpaces,
      player,
    });
    advanceIncome(state, player, def.incomeSpaces, events);
  }
}
