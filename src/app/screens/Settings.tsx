import { useTranslation } from 'react-i18next';
import { useApp } from '../store/appStore.ts';
import { useSettings, type AnimSpeed, type AiSpeed } from '../store/settings.ts';
import { Button, Panel, ScreenShell } from '../components/ui.tsx';
import { LANGUAGES, type Lang } from '../i18n/index.ts';
import { downloadText, pickTextFile } from '../util/file.ts';
import { loadAutosave } from '../../persistence/save.ts';
import { serializeState, deserializeState } from '../../persistence/serialize.ts';

function Row(props: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: '6px 0',
      }}
    >
      <span>{props.label}</span>
      <div>{props.children}</div>
    </div>
  );
}

/** Settings screen (§7.10.3), reachable from Main Menu and Pause; applies live. */
export function SettingsScreen(): JSX.Element {
  const { t } = useTranslation();
  const back = useApp((s) => s.settingsReturn);
  const goto = useApp((s) => s.goto);
  const loadGame = useApp((s) => s.loadGame);
  const { settings, update, reset } = useSettings();

  async function exportSave(): Promise<void> {
    const game = await loadAutosave();
    if (game) downloadText('myspolly-save.json', serializeState(game));
  }
  async function importSave(): Promise<void> {
    const text = await pickTextFile();
    if (!text) return;
    try {
      loadGame(deserializeState(text));
    } catch {
      window.alert('Invalid or incompatible save file.');
    }
  }

  return (
    <ScreenShell
      title={t('settings.title')}
      onBack={() => goto(back)}
      backLabel={t('settings.back')}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 560 }}
      >
        <Panel>
          <h3>{t('settings.language')}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {LANGUAGES.map((l) => (
              <Button
                key={l.code}
                variant={settings.lang === l.code ? 'primary' : 'ghost'}
                onClick={() => update({ lang: l.code as Lang })}
              >
                {l.flag} {l.label}
              </Button>
            ))}
          </div>
        </Panel>

        <Panel>
          <h3>{t('settings.audio')}</h3>
          <Row label={t('settings.masterVolume')}>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.masterVolume * 100}
              onChange={(e) => update({ masterVolume: Number(e.target.value) / 100 })}
            />
          </Row>
          <Row label={t('settings.musicVolume')}>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.musicVolume * 100}
              onChange={(e) => update({ musicVolume: Number(e.target.value) / 100 })}
            />
          </Row>
          <Row label={t('settings.sfxVolume')}>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.sfxVolume * 100}
              onChange={(e) => update({ sfxVolume: Number(e.target.value) / 100 })}
            />
          </Row>
          <Row label={t('settings.mute')}>
            <input
              type="checkbox"
              checked={settings.muted}
              onChange={(e) => update({ muted: e.target.checked })}
            />
          </Row>
        </Panel>

        <Panel>
          <h3>{t('settings.animations')}</h3>
          <Row label={t('settings.animationSpeed')}>
            <select
              value={settings.animationSpeed}
              onChange={(e) => update({ animationSpeed: e.target.value as AnimSpeed })}
              style={{
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 6,
              }}
            >
              <option value="slow">{t('settings.slow')}</option>
              <option value="normal">{t('settings.normal')}</option>
              <option value="fast">{t('settings.fast')}</option>
              <option value="instant">{t('settings.instant')}</option>
            </select>
          </Row>
          <Row label={t('settings.reducedMotion')}>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => update({ reducedMotion: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.skipAiAnimations')}>
            <input
              type="checkbox"
              checked={settings.skipAiAnimations}
              onChange={(e) => update({ skipAiAnimations: e.target.checked })}
            />
          </Row>
        </Panel>

        <Panel>
          <h3>{t('settings.board')}</h3>
          <Row label={t('setup.boardSide')}>
            <Button
              variant={settings.boardSide === 'day' ? 'primary' : 'ghost'}
              onClick={() => update({ boardSide: 'day' })}
            >
              {t('setup.day')}
            </Button>{' '}
            <Button
              variant={settings.boardSide === 'night' ? 'primary' : 'ghost'}
              onClick={() => update({ boardSide: 'night' })}
            >
              {t('setup.night')}
            </Button>
          </Row>
          <Row label={t('settings.colorBlind')}>
            <input
              type="checkbox"
              checked={settings.colorBlind}
              onChange={(e) => update({ colorBlind: e.target.checked })}
            />
          </Row>
        </Panel>

        <Panel>
          <h3>{t('settings.gameplay')}</h3>
          <Row label={t('settings.confirmEndTurn')}>
            <input
              type="checkbox"
              checked={settings.confirmEndTurn}
              onChange={(e) => update({ confirmEndTurn: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.showLegalMoves')}>
            <input
              type="checkbox"
              checked={settings.showLegalMoves}
              onChange={(e) => update({ showLegalMoves: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.showTooltips')}>
            <input
              type="checkbox"
              checked={settings.showTooltips}
              onChange={(e) => update({ showTooltips: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.aiThinkSpeed')}>
            <select
              value={settings.aiThinkSpeed}
              onChange={(e) => update({ aiThinkSpeed: e.target.value as AiSpeed })}
              style={{
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 6,
              }}
            >
              <option value="slow">{t('settings.slow')}</option>
              <option value="normal">{t('settings.normal')}</option>
              <option value="fast">{t('settings.fast')}</option>
            </select>
          </Row>
        </Panel>

        <Panel>
          <h3>{t('settings.data')}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => void exportSave()}>
              Export save
            </Button>
            <Button variant="ghost" onClick={() => void importSave()}>
              Import save
            </Button>
          </div>
        </Panel>

        <Button variant="danger" onClick={reset} style={{ alignSelf: 'flex-start' }}>
          {t('settings.resetDefaults')}
        </Button>
      </div>
    </ScreenShell>
  );
}
