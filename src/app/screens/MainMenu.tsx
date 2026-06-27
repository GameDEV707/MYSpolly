import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store/appStore.ts';
import { useSettings } from '../store/settings.ts';
import { hasAutosave, loadAutosave } from '../../persistence/save.ts';
import { LANGUAGES } from '../i18n/index.ts';
import { Button, Panel } from '../components/ui.tsx';
import type { SaveMeta } from '../../persistence/types.ts';
import { makeSaveMeta } from '../../persistence/serialize.ts';

/**
 * Main Menu (§7.10.2). Continue is enabled only when an autosave exists.
 * Keyboard navigable, localized, with a quick language selector + mute.
 */
export function MainMenu(): JSX.Element {
  const { t } = useTranslation();
  const goto = useApp((s) => s.goto);
  const openSettings = useApp((s) => s.openSettings);
  const openRules = useApp((s) => s.openRules);
  const startTutorial = useApp((s) => s.startTutorial);
  const continueGame = useApp((s) => s.continueGame);
  const { settings, update, loaded } = useSettings();
  const [autosaveMeta, setAutosaveMeta] = useState<SaveMeta | null>(null);

  useEffect(() => {
    void (async () => {
      if (await hasAutosave()) {
        const g = await loadAutosave();
        if (g) setAutosaveMeta(makeSaveMeta(g));
      }
    })();
  }, []);

  const canContinue = autosaveMeta !== null;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        background: 'radial-gradient(circle at 50% 30%, var(--bg-elevated), var(--bg))',
        position: 'relative',
      }}
    >
      {/* Quick language + mute */}
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={() => update({ lang: l.code })}
            title={l.label}
            style={{
              fontSize: 20,
              background: settings.lang === l.code ? 'var(--surface)' : 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            {l.flag}
          </button>
        ))}
        <button
          onClick={() => update({ muted: !settings.muted })}
          title={t('settings.mute')}
          style={{
            fontSize: 20,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            padding: '2px 6px',
          }}
        >
          {settings.muted ? '🔇' : '🔊'}
        </button>
      </div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 80, margin: 0, letterSpacing: 4 }}>
        {t('app.title')}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)' }}>
        {t('app.subtitle')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: 280 }}>
        <Button
          onClick={() => void continueGame()}
          disabled={!canContinue}
          title={
            canContinue && autosaveMeta
              ? t('menu.continueSummary', {
                  era: t(`game.${autosaveMeta.era}`),
                  round: autosaveMeta.round,
                  players: autosaveMeta.players,
                })
              : t('menu.noGameInProgress')
          }
        >
          {t('menu.continue')}
        </Button>
        <Button onClick={() => goto('setup')}>{t('menu.newGame')}</Button>
        <Button variant="ghost" onClick={() => goto('load')}>
          {t('menu.loadGame')}
        </Button>
        <Button variant="ghost" onClick={() => openSettings('mainMenu')}>
          {t('menu.settings')}
        </Button>
        <Button variant="ghost" onClick={() => openRules('mainMenu')}>
          {t('menu.howToPlay')}
        </Button>
        <Button variant="ghost" onClick={() => startTutorial('mainMenu')}>
          {t('menu.tutorial')}
        </Button>
        <Button variant="ghost" onClick={() => goto('credits')}>
          {t('menu.credits')}
        </Button>
      </div>

      <p style={{ position: 'absolute', bottom: 12, color: 'var(--text-muted)', fontSize: 12 }}>
        v0.1.0
      </p>

      {/* First-launch tutorial offer (skippable, shown once). */}
      {loaded && !settings.tutorialDone && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
          }}
        >
          <Panel
            style={{
              width: 360,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40 }}>🎓</div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>
              {t('tutorial.offerTitle')}
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>{t('tutorial.offerBody')}</p>
            <Button onClick={() => startTutorial('mainMenu')}>{t('tutorial.offerStart')}</Button>
            <Button variant="ghost" onClick={() => update({ tutorialDone: true })}>
              {t('tutorial.offerSkip')}
            </Button>
          </Panel>
        </div>
      )}
    </div>
  );
}
