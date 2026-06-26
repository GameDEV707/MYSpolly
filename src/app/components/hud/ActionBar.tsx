import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '../../../core/model/state.ts';
import type { Action, ActionType } from '../../../core/model/actions.ts';
import { legalActions } from '../../../core/selectors/legalActions.ts';
import { Button, Panel } from '../ui.tsx';
import { describeAction } from './describe.ts';

const ACTION_TYPES: ActionType[] = ['BUILD', 'NETWORK', 'DEVELOP', 'SELL', 'LOAN', 'SCOUT', 'PASS'];

/**
 * Action bar + guided flow. Selecting an action type lists every legal concrete
 * action of that type (from `legalActions`, so illegal moves are impossible) with
 * a cost hint; clicking one dispatches it. This is the single human entry point
 * and mirrors how the AI chooses.
 */
export function ActionBar(props: {
  game: GameState;
  disabled?: boolean;
  onDispatch: (a: Action) => void;
}): JSX.Element {
  const { game, disabled, onDispatch } = props;
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ActionType | null>(null);

  const all = useMemo(() => legalActions(game), [game]);
  const byType = useMemo(() => {
    const map = new Map<ActionType, Action[]>();
    for (const a of all) {
      const arr = map.get(a.type) ?? [];
      arr.push(a);
      map.set(a.type, arr);
    }
    return map;
  }, [all]);

  const options = selected ? (byType.get(selected) ?? []) : [];

  return (
    <Panel style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ACTION_TYPES.map((type) => {
          const available = (byType.get(type)?.length ?? 0) > 0;
          return (
            <Button
              key={type}
              variant={selected === type ? 'primary' : 'ghost'}
              disabled={disabled || !available}
              onClick={() => setSelected(type)}
              title={t(`action.${type.toLowerCase()}Hint`)}
            >
              {t(`action.${type.toLowerCase()}`)}
            </Button>
          );
        })}
      </div>

      {selected && (
        <div
          style={{
            maxHeight: 220,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {t(`action.${selected.toLowerCase()}Hint`)} — {options.length} option(s)
          </div>
          {options.slice(0, 200).map((a, i) => (
            <button
              key={i}
              onClick={() => {
                setSelected(null);
                onDispatch(a);
              }}
              style={{
                textAlign: 'left',
                padding: '6px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              {describeAction(t, game, a)}
            </button>
          ))}
          {options.length === 0 && (
            <div style={{ color: 'var(--text-muted)' }}>{t('load.empty')}</div>
          )}
        </div>
      )}
    </Panel>
  );
}
