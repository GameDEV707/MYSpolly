import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store/appStore.ts';
import { Button, Panel, ScreenShell } from '../components/ui.tsx';
import { listNamedSaves, loadSlot, removeSlot } from '../../persistence/save.ts';
import type { SaveSlot } from '../../persistence/types.ts';

/** Load Game screen (§7.10.4): lists named save slots with metadata. */
export function LoadGame(): JSX.Element {
  const { t } = useTranslation();
  const goto = useApp((s) => s.goto);
  const loadGame = useApp((s) => s.loadGame);
  const [slots, setSlots] = useState<SaveSlot[]>([]);

  const refresh = (): void => {
    void listNamedSaves().then(setSlots);
  };
  useEffect(refresh, []);

  async function onLoad(id: string): Promise<void> {
    const state = await loadSlot(id);
    if (state) loadGame(state);
  }
  async function onDelete(id: string): Promise<void> {
    if (window.confirm(t('load.confirmDelete'))) {
      await removeSlot(id);
      refresh();
    }
  }

  return (
    <ScreenShell title={t('load.title')} onBack={() => goto('mainMenu')}>
      {slots.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('load.empty')}</p>
      ) : (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 640 }}
        >
          {slots.map((s) => (
            <Panel key={s.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div>
                  <strong>{s.name}</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {t(`game.${s.meta.era}`)} · {t('game.round', { round: s.meta.round })} ·{' '}
                    {s.meta.players}P · {new Date(s.meta.timestamp).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={() => void onLoad(s.id)}>{t('load.load')}</Button>
                  <Button variant="danger" onClick={() => void onDelete(s.id)}>
                    {t('load.delete')}
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </ScreenShell>
  );
}
