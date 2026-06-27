import type { GameEvent } from '../../../core/model/events.ts';
import type { PlayerColor } from '../../../core/model/types.ts';

/**
 * Pure view model for the bankruptcy / auction modal (§7.17.5 / task 11.13).
 *
 * The engine resolves a shortfall deterministically and emits a step-by-step
 * event trail; this module groups that trail into displayable episodes so the
 * modal (and the log) can recap exactly what happened. Kept free of React/JSX so
 * it is unit-testable on its own.
 */

export interface BankruptcyStep {
  kind: 'soldToBank' | 'auctionOpened' | 'auctionBid' | 'auctionWon' | 'auctionToBank';
  tileId: string;
  /** Money amount relevant to this step (refund / opening / bid / price). */
  amount: number;
  /** The acting player (seller for opens, bidder for bids, winner for wins). */
  who?: PlayerColor;
}

export interface BankruptcyEpisode {
  debtor: PlayerColor;
  due: number;
  steps: BankruptcyStep[];
  raised: number;
  vpLost: number;
  stillOwed: number;
}

/**
 * Group a flat event list into bankruptcy episodes (one per BANKRUPTCY_STARTED).
 */
export function bankruptcyEpisodes(events: GameEvent[]): BankruptcyEpisode[] {
  const episodes: BankruptcyEpisode[] = [];
  let cur: BankruptcyEpisode | null = null;
  for (const e of events) {
    switch (e.t) {
      case 'BANKRUPTCY_STARTED':
        cur = { debtor: e.player, due: e.due, steps: [], raised: 0, vpLost: 0, stillOwed: 0 };
        episodes.push(cur);
        break;
      case 'TILE_SOLD_TO_BANK':
        cur?.steps.push({ kind: 'soldToBank', tileId: e.tileId, amount: e.refund, who: e.player });
        break;
      case 'AUCTION_OPENED':
        cur?.steps.push({
          kind: 'auctionOpened',
          tileId: e.tileId,
          amount: e.opening,
          who: e.seller,
        });
        break;
      case 'AUCTION_BID':
        cur?.steps.push({ kind: 'auctionBid', tileId: e.tileId, amount: e.amount, who: e.bidder });
        break;
      case 'AUCTION_RESULT':
        cur?.steps.push({
          kind: e.toBank || !e.winner ? 'auctionToBank' : 'auctionWon',
          tileId: e.tileId,
          amount: e.price,
          who: e.winner ?? undefined,
        });
        break;
      case 'BANKRUPTCY_RESOLVED':
        if (cur) {
          cur.raised = e.raised;
          cur.vpLost = e.vpLost;
          cur.stillOwed = e.stillOwed;
        }
        cur = null;
        break;
      default:
        break;
    }
  }
  return episodes;
}
