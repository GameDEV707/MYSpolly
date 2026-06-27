import type { TFunction } from 'i18next';
import type { GameState } from '../../../core/model/state.ts';
import type { GameEvent } from '../../../core/model/events.ts';
import type { PlayerColor } from '../../../core/model/types.ts';
import { boardContext } from '../../../core/maps/context.ts';
import { locName as resolveLocName } from '../board/names.ts';

function playerName(t: TFunction, game: GameState, color: PlayerColor): string {
  return game.players[color]?.name ?? t(`color.${color}`);
}

function locName(t: TFunction, game: GameState, id: string): string {
  return resolveLocName(t, game, id);
}

/**
 * Turn a semantic engine event into a full, localized sentence for the game log
 * (§7.13), e.g. "Blue built a Coal Mine in Dudley". Returns null for events that
 * should not appear as their own log line.
 */
export function logLine(t: TFunction, game: GameState, e: GameEvent): string | null {
  switch (e.t) {
    case 'TILE_PLACED':
      return t(e.overbuilt ? 'log.overbuilt' : 'log.built', {
        name: playerName(t, game, e.tile.owner),
        industry: t(`industry.${e.tile.industry}`),
        level: e.tile.level,
        location: locName(t, game, e.tile.locationId),
      });
    case 'LINK_PLACED': {
      const line = boardContext(game).lineById[e.link.lineId];
      return t('log.link', {
        name: playerName(t, game, e.link.owner),
        type: t(`linkType.${e.link.type}`),
        from: line ? locName(t, game, line.a) : '',
        to: line ? locName(t, game, line.b) : '',
      });
    }
    case 'CUBE_TO_MARKET':
      return t('log.cubeToMarket', {
        count: e.count,
        resource: t(`legend.${e.resource}`),
        income: e.income,
      });
    case 'TILE_FLIPPED':
      return t('log.flipped', { name: playerName(t, game, e.player), income: e.incomeGain });
    case 'MERCHANT_BONUS':
      return t('log.merchantBonus', {
        name: playerName(t, game, e.player),
        bonus: t(`legend.${e.kind}`),
      });
    case 'DEVELOP':
      return t('log.develop', {
        name: playerName(t, game, e.player),
        industry: t(`industry.${e.industry}`),
      });
    case 'LOAN_TAKEN':
      return t('log.loan', { name: playerName(t, game, e.player) });
    case 'SCOUT':
      return t('log.scout', { name: playerName(t, game, e.player) });
    case 'INCOME_COLLECTED':
      return t('log.income', { name: playerName(t, game, e.player), amount: e.amount });
    case 'RESOURCE_PRODUCED': {
      const parts: string[] = [];
      if (e.coal > 0) parts.push(`${e.coal} ${t('legend.coal')}`);
      if (e.iron > 0) parts.push(`${e.iron} ${t('legend.iron')}`);
      if (e.juice > 0) parts.push(`${e.juice} ${t('legend.juice')}`);
      if (parts.length === 0) return null;
      return t('log.produced', {
        name: playerName(t, game, e.player),
        summary: parts.join(', '),
      });
    }
    case 'SHORTFALL':
      return t('log.shortfall', {
        name: playerName(t, game, e.player),
        tiles: e.tilesSold,
        vp: e.vpLost,
      });
    case 'RESOURCE_CONSUMED': {
      // Only surface a peer-to-peer purchase as its own line; stockpile/market/
      // supply units are summarised in the action's own log line + preview.
      if (typeof e.from === 'string' && e.from.startsWith('player:') && (e.cost ?? 0) > 0) {
        const seller = e.from.slice('player:'.length) as PlayerColor;
        return t('log.resourceBought', {
          name: playerName(t, game, e.player),
          resource: t(`legend.${e.resource}`),
          seller: playerName(t, game, seller),
          amount: e.cost ?? 0,
        });
      }
      return null;
    }
    case 'BANKRUPTCY_STARTED':
      return t('log.bankruptcy', { name: playerName(t, game, e.player), due: e.due });
    case 'TILE_SOLD_TO_BANK':
      return t('log.soldToBank', { name: playerName(t, game, e.player), amount: e.refund });
    case 'AUCTION_OPENED':
      return t('log.auctionOpened', { name: playerName(t, game, e.seller), opening: e.opening });
    case 'AUCTION_BID':
      return t('log.auctionBid', { name: playerName(t, game, e.bidder), amount: e.amount });
    case 'AUCTION_RESULT':
      return e.toBank || !e.winner
        ? t('log.auctionToBank', { amount: e.price })
        : t('log.auctionWon', { winner: playerName(t, game, e.winner), amount: e.price });
    case 'ROUND_ENDED':
      return t('log.roundEnded', { round: e.round });
    case 'ERA_ENDED':
      return t('log.eraEnded', { era: t(`game.${e.era}`) });
    case 'ERA_MORPH':
      return t('log.eraMorph', { era: t(`game.${e.to}`) });
    case 'TURN_ENDED':
      return t('log.turn', { name: playerName(t, game, e.next) });
    case 'GAME_OVER':
      return t('log.gameOver', { name: playerName(t, game, e.ranking[0]!) });
    default:
      return null;
  }
}
