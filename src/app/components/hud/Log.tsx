import { useTranslation } from 'react-i18next';
import type { GameState } from '../../../core/model/state.ts';
import type { GameEvent } from '../../../core/model/events.ts';
import { Panel } from '../ui.tsx';
import { logLine } from './logLines.ts';

/** Renders recent events as full, localized sentences (§7.13). */
export function Log(props: { game: GameState; events: GameEvent[] }): JSX.Element {
  const { t } = useTranslation();
  const lines = props.events.map((e) => logLine(t, props.game, e)).filter(Boolean) as string[];
  return (
    <Panel style={{ maxHeight: 160, overflow: 'auto', fontSize: 13 }}>
      {lines.length === 0 ? (
        <span style={{ color: 'var(--text-muted)' }}>…</span>
      ) : (
        lines.map((l, i) => (
          <div key={i} style={{ padding: '2px 0', borderBottom: '1px solid var(--border)' }}>
            {l}
          </div>
        ))
      )}
    </Panel>
  );
}
