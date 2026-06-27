import type { GameState } from '../../model/state.ts';
import type { GameEvent } from '../../model/events.ts';
import type { DevelopAction } from '../../model/actions.ts';
import type { PlayerColor } from '../../model/types.ts';
import { getLevelDef } from '../../data/industries.ts';
import { getPlayer } from '../helpers.ts';
import { consumeResource, planResource } from '../consume.ts';

export function validateDevelop(
  state: GameState,
  player: PlayerColor,
  a: DevelopAction,
): string | null {
  const p = getPlayer(state, player);
  if (!p.hand.find((c) => c.id === a.card.cardId)) return 'Card not in hand';
  if (a.removals.length < 1 || a.removals.length > 2) return 'Develop removes 1 or 2 tiles';

  // Validate each removal against the (decreasing) mat stacks.
  const stacks: Record<string, number[]> = {};
  for (const ind of a.removals) {
    const stack = stacks[ind] ?? [...p.matStacks[ind]];
    stacks[ind] = stack;
    const level = stack.shift();
    if (level === undefined) return `No ${ind} tiles left to develop`;
    if (!getLevelDef(ind, level).developable) return `${ind} tile cannot be developed (lightbulb)`;
  }

  // Develop consumes 1 iron per removal, from the player's own stockpile (else
  // the iron market).
  const ironNeeded = a.removals.length;
  const plan = planResource(state, player, 'iron', ironNeeded);
  if (!plan.ok) return 'Not enough iron to develop';
  if (p.money < plan.marketCost) return 'Not enough money for market iron';
  return null;
}

export function applyDevelop(
  state: GameState,
  player: PlayerColor,
  a: DevelopAction,
  events: GameEvent[],
): void {
  const p = getPlayer(state, player);
  consumeResource(state, player, 'iron', a.removals.length, undefined, events);

  for (const ind of a.removals) {
    p.matStacks[ind].shift(); // lowest tile removed from the game
    events.push({ t: 'DEVELOP', player, industry: ind });
  }
}
