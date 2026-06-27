import type { TFunction } from 'i18next';
import type { GameState } from '../../../core/model/state.ts';
import { boardContext } from '../../../core/maps/context.ts';

/**
 * Map-aware display-name resolution for the UI (§7.15 / Phase 10.1).
 *
 * Every location, merchant and link line resolves its localized name through
 * the active map's board context — NOT the Birmingham-only static board data —
 * so no raw internal id (e.g. `a1`, `am1`, `q1`) can ever leak onto the board,
 * the guided action flow, the log or a tooltip. The location/merchant `name`
 * field is always a registered i18n key; if a key ever fails to resolve we warn
 * in development and fall back to a humanized label rather than the raw id.
 */

/** Resolve the i18n key for a location or merchant id on the active map. */
export function locNameKey(game: GameState, id: string): string | undefined {
  const ctx = boardContext(game);
  return ctx.locationById[id]?.name ?? ctx.merchantById[id]?.name;
}

/** Humanize a raw id as a last-resort label (never shown if keys resolve). */
function humanize(id: string): string {
  const cleaned = id.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Localized name of a location/merchant on the active map (never a raw id). */
export function locName(t: TFunction, game: GameState, id: string): string {
  const key = locNameKey(game, id);
  if (key === undefined) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] no location/merchant for id "${id}" on map "${game.options.mapId}"`);
    }
    return humanize(id);
  }
  const resolved = t(key);
  if (resolved === key) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] missing name translation for key "${key}" (id "${id}")`);
    }
    return humanize(id);
  }
  return resolved;
}

/** Localized "A ↔ B" label for a link line on the active map. */
export function lineName(t: TFunction, game: GameState, lineId: string): string {
  const line = boardContext(game).lineById[lineId];
  if (!line) return humanize(lineId);
  return `${locName(t, game, line.a)} ↔ ${locName(t, game, line.b)}`;
}
