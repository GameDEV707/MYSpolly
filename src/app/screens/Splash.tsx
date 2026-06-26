import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store/appStore.ts';

/**
 * Branded splash screen. Preloads settings/saved data (handled by App) and
 * auto-advances to the Main Menu after a short delay. Skippable on key/click.
 * It NEVER advances straight into a game.
 */
export function Splash(): JSX.Element {
  const { t } = useTranslation();
  const goto = useApp((s) => s.goto);

  useEffect(() => {
    const timer = setTimeout(() => goto('mainMenu'), 1600);
    const skip = (): void => goto('mainMenu');
    window.addEventListener('keydown', skip);
    window.addEventListener('click', skip);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('click', skip);
    };
  }, [goto]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        background: 'radial-gradient(circle at 50% 40%, var(--bg-elevated), var(--bg))',
      }}
    >
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 72, margin: 0, letterSpacing: 4 }}>
        {t('app.title')}
      </h1>
      <p style={{ color: 'var(--text-muted)' }}>{t('app.subtitle')}</p>
      <p style={{ color: 'var(--accent)', marginTop: 'var(--space-8)' }}>{t('app.loading')}</p>
    </div>
  );
}
