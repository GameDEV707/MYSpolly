import { useTranslation } from 'react-i18next';
import { useApp } from '../store/appStore.ts';
import { Panel, ScreenShell } from '../components/ui.tsx';

/** How-to-Play screen — a localized summary of the core rules. */
export function Rules(): JSX.Element {
  const { t } = useTranslation();
  const back = useApp((s) => s.settingsReturn);
  const screen = useApp((s) => s.screen);
  const goto = useApp((s) => s.goto);
  void screen;

  return (
    <ScreenShell
      title={t('rules.title')}
      onBack={() => goto(back === 'pause' ? 'pause' : 'mainMenu')}
    >
      <div
        style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
      >
        <Panel>
          <p>
            Build industries, lay canals and railways across the West Midlands (1770–1870), sell
            goods through merchants, and grow your income. Two eras — Canal then Rail — each end
            with scoring of your links and flipped industry tiles. Most Victory Points wins.
          </p>
        </Panel>
        <Panel>
          <h3>{t('action.build')}</h3>
          <p>
            {t('action.buildHint')}. {t('cost.preview')}: money + coal + iron. Coal needs a
            connection.
          </p>
          <h3>{t('action.network')}</h3>
          <p>
            {t('action.networkHint')}. Canal: £3. Rail: £5 (one) or £15 + beer (two); each rail link
            burns coal.
          </p>
          <h3>{t('action.sell')}</h3>
          <p>
            {t('action.sellHint')}. Consume the beer shown on the tile; merchant beer grants a
            bonus.
          </p>
          <h3>
            {t('action.develop')} / {t('action.loan')} / {t('action.scout')} / {t('action.pass')}
          </h3>
          <p>
            {t('action.developHint')}. {t('action.loanHint')}. {t('action.scoutHint')}.{' '}
            {t('action.passHint')}.
          </p>
        </Panel>
      </div>
    </ScreenShell>
  );
}
