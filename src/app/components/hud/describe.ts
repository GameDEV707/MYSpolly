import type { TFunction } from 'i18next';
import type { GameState } from '../../../core/model/state.ts';
import type { Action } from '../../../core/model/actions.ts';
import { getLevelDef } from '../../../core/data/industries.ts';
import { LINK_LINES, TOWN_BY_ID } from '../../../core/data/board.ts';

const LINE_BY_ID = Object.fromEntries(LINK_LINES.map((l) => [l.id, l]));

function lineName(t: TFunction, lineId: string): string {
  const line = LINE_BY_ID[lineId];
  if (!line) return lineId;
  return `${t(TOWN_BY_ID[line.a]?.name ?? line.a)} ↔ ${t(TOWN_BY_ID[line.b]?.name ?? line.b)}`;
}

/** Human-readable label + cost hint for a concrete action (drives the guided UI). */
export function describeAction(t: TFunction, game: GameState, action: Action): string {
  const p = game.players[game.activePlayer]!;
  switch (action.type) {
    case 'BUILD': {
      const level = p.matStacks[action.industry]?.[0];
      const cost = level !== undefined ? getLevelDef(action.industry, level).costMoney : 0;
      return `${t(`industry.${action.industry}`)} → ${t(TOWN_BY_ID[action.locationId]?.name ?? action.locationId)} (£${cost})`;
    }
    case 'NETWORK':
      return action.links.map((l) => lineName(t, l.lineId)).join(' + ');
    case 'DEVELOP':
      return action.removals.map((i) => t(`industry.${i}`)).join(', ');
    case 'SELL':
      return action.sales
        .map((s) => {
          const tile = game.tiles.find((tt) => tt.id === s.tileId);
          return tile ? `${t(`industry.${tile.industry}`)}` : s.tileId;
        })
        .join(', ');
    case 'LOAN':
      return t('action.loanHint');
    case 'SCOUT':
      return t('action.scoutHint');
    case 'PASS':
      return t('action.passHint');
    default:
      return '';
  }
}
