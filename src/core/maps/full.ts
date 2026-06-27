import type { MapDefinition } from './types.ts';
import { FULL_MAPS_AUTHORED } from './authored.ts';

/**
 * The 4 additional Full maps (the 5th Full map is the classic Birmingham map
 * in `birmingham.ts`). One of these — "Skyward Dominion" — declares a third
 * Air Era.
 */
export const FULL_MAPS: MapDefinition[] = FULL_MAPS_AUTHORED;
