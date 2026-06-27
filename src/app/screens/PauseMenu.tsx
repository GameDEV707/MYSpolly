import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store/appStore.ts';
import { Button, Panel } from '../components/ui.tsx';
import { saveNamed } from '../../persistence/save.ts';

/** In-game pause overlay (§7.10.5). Game state is untouched while paused. */
export function PauseMenu(): JSX.Element {
  const { t } = useTranslation();
  const goto = useApp((s) => s.goto);
  const openSettings = useApp((s) => s.openSettings);
  const openRules = useApp((s) => s.openRules);
  const abandon = useApp((s) => s.abandon);
  const game = useApp((s) => s.game);
  const [saved, setSaved] = useState(false);

  async function onSave(): Promise<void> {
    if (!game) return;
    const name = window.prompt('Save name', `${t(`game.${game.era}`)} R${game.round}`);
    if (name) {
      await saveNamed(name, game);
      setSaved(true);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <Panel
        style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
      >
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>{t('pause.title')}</h2>
        <Button onClick={() => goto('game')}>{t('pause.resume')}</Button>
        <Button variant="ghost" onClick={() => openSettings('pause')}>
          {t('pause.settings')}
        </Button>
        <Button variant="ghost" onClick={() => void onSave()}>
          {t('pause.save')} {saved ? '✓' : ''}
        </Button>
        <Button variant="ghost" onClick={() => openRules('pause')}>
          {t('pause.howToPlay')}
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            if (game) await saveNamed('Quick save', game);
            abandon();
          }}
        >
          {t('pause.saveQuit')}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (window.confirm(t('pause.confirmAbandon'))) abandon();
          }}
        >
          {t('pause.abandon')}
        </Button>
      </Panel>
    </div>
  );
}
