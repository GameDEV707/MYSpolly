import { useTranslation } from 'react-i18next';

/** Full-screen cinematic banner for era transitions / round / game-over beats. */
export function Banner(props: { messageKey: string | null }): JSX.Element | null {
  const { t } = useTranslation();
  if (!props.messageKey) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 200,
        animation: 'bannerFade var(--anim-slow) ease-out',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 56,
          color: 'var(--accent)',
          textShadow: '0 4px 24px rgba(0,0,0,0.8)',
          background: 'rgba(0,0,0,0.55)',
          padding: '24px 56px',
          borderRadius: 'var(--radius)',
        }}
      >
        {t(props.messageKey)}
      </div>
    </div>
  );
}
