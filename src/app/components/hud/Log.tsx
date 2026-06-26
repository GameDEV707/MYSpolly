import type { GameEvent } from '../../../core/model/events.ts';
import { Panel } from '../ui.tsx';

/** Renders a short human-readable line for the most recent events. */
function line(e: GameEvent): string {
  switch (e.t) {
    case 'TILE_PLACED':
      return `${e.tile.owner} built ${e.tile.industry} L${e.tile.level} in ${e.tile.locationId}`;
    case 'LINK_PLACED':
      return `${e.link.owner} placed a ${e.link.type} link`;
    case 'CUBE_TO_MARKET':
      return `${e.count} ${e.resource} → market (+£${e.income})`;
    case 'TILE_FLIPPED':
      return `${e.player} flipped a tile (+${e.incomeGain} income)`;
    case 'MERCHANT_BONUS':
      return `${e.player} got a merchant ${e.kind} bonus`;
    case 'LOAN_TAKEN':
      return `${e.player} took a loan`;
    case 'SCOUT':
      return `${e.player} scouted`;
    case 'ROUND_ENDED':
      return `— Round ${e.round} ended —`;
    case 'ERA_ENDED':
      return `=== ${e.era} era ended ===`;
    case 'GAME_OVER':
      return `Game over. Winner: ${e.ranking[0]}`;
    case 'INCOME_COLLECTED':
      return `${e.player} collected £${e.amount} income`;
    case 'TURN_ENDED':
      return `→ ${e.next}'s turn`;
    default:
      return '';
  }
}

export function Log(props: { events: GameEvent[] }): JSX.Element {
  const lines = props.events.map(line).filter(Boolean);
  return (
    <Panel style={{ maxHeight: 160, overflow: 'auto', fontSize: 12, fontFamily: 'monospace' }}>
      {lines.length === 0 ? (
        <span style={{ color: 'var(--text-muted)' }}>…</span>
      ) : (
        lines.map((l, i) => <div key={i}>{l}</div>)
      )}
    </Panel>
  );
}
