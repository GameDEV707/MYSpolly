import { useTranslation } from 'react-i18next';
import { useApp } from '../store/appStore.ts';
import { Panel, ScreenShell } from '../components/ui.tsx';

/** Credits screen — project & asset attribution. */
export function Credits(): JSX.Element {
  const { t } = useTranslation();
  const goto = useApp((s) => s.goto);
  return (
    <ScreenShell title={t('credits.title')} onBack={() => goto('mainMenu')}>
      <div
        style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
      >
        <Panel>
          <p>{t('credits.fanProject')}</p>
          <p>{t('credits.assets')}</p>
        </Panel>
        <Panel>
          <p style={{ color: 'var(--text-muted)' }}>
            MYSpolly — engine, UI &amp; art © the project authors.
          </p>
        </Panel>
      </div>
    </ScreenShell>
  );
}
