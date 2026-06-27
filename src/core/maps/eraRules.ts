import type { Era, IndustryLevelDef } from '../model/types.ts';

/**
 * Era-aware rule helpers. Eras beyond the first two (i.e. the optional Air Era)
 * mirror the Rail-Era pattern for tile buildability unless a map overrides it
 * (§7.15.4).
 */

/** Whether an industry-level tile may be built in the given era. */
export function buildableInEra(def: IndustryLevelDef, era: Era): boolean {
  if (era === 'canal') return def.buildableInCanal;
  // Rail and Air both use the "later era" buildability flag.
  return def.buildableInRail;
}
