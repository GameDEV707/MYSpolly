import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { PLAYER_CSS_VAR } from '../ui.tsx';
import type { HandoffState } from './useTurnHandoff.ts';

/**
 * Prominent "Player X's turn" transition cue (§7.13 / task 3R.26). In `banner`
 * mode it briefly animates in the active player's colour (with an avatar) and
 * fades out on its own. In `confirm` mode it covers the screen until the next
 * human taps "Ready", so hot-seat hands stay secret between players.
 */
export function TurnHandoff(props: {
  handoff: HandoffState | null;
  onReady: () => void;
}): JSX.Element | null {
  const { handoff, onReady } = props;
  const { t } = useTranslation();
  if (!handoff) return null;

  const color = PLAYER_CSS_VAR[handoff.color] ?? 'var(--accent)';
  const confirm = handoff.mode === 'confirm';
  const initial = handoff.name.slice(0, 1).toUpperCase();

  const headline = handoff.isAI
    ? t('handoff.aiPlaying', { name: handoff.name })
    : confirm
      ? t('handoff.passDevice', { name: handoff.name })
      : t('handoff.turnOf', { name: handoff.name });

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-4)',
    zIndex: 260,
    pointerEvents: confirm ? 'auto' : 'none',
    background: confirm ? 'var(--bg)' : 'transparent',
  };

  const cardStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: '28px 48px',
    borderRadius: 'var(--radius)',
    border: `3px solid ${color}`,
    background: 'rgba(0,0,0,0.62)',
    boxShadow: `0 12px 48px -8px ${color}, var(--shadow-2)`,
    // Restart the entrance animation on each handoff via the token-based key.
    animation: confirm
      ? undefined
      : 'handoffIn calc(2000ms * max(var(--anim-scale), 0.0001)) ease-out',
    color: 'var(--text)',
    textAlign: 'center',
    maxWidth: 460,
  };

  const avatarStyle: CSSProperties = {
    width: 84,
    height: 84,
    borderRadius: '50%',
    background: color,
    border: '3px solid rgba(255,255,255,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 40,
    fontWeight: 800,
    color: '#fff',
    textShadow: '0 2px 6px rgba(0,0,0,0.6)',
    position: 'relative',
    animation: 'handoffAvatarPop calc(500ms * max(var(--anim-scale), 0.0001)) ease-out',
  };

  return (
    <div style={overlayStyle} role={confirm ? 'dialog' : 'status'} aria-live="polite">
      <div key={handoff.token} style={cardStyle}>
        <div style={avatarStyle} aria-hidden>
          <span style={{ position: 'absolute', top: -22, fontSize: 26 }}>🎩</span>
          {initial}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: confirm ? 30 : 40,
            lineHeight: 1.1,
            textShadow: '0 3px 16px rgba(0,0,0,0.8)',
          }}
        >
          {headline}
        </div>
        {!handoff.isAI && !confirm && (
          <div style={{ color, fontSize: 16, fontWeight: 600 }}>{t('handoff.getReady')}</div>
        )}
        {confirm && (
          <>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              {t('handoff.passDeviceHint', { name: handoff.name })}
            </div>
            <button
              onClick={onReady}
              autoFocus
              style={{
                marginTop: 4,
                padding: '12px 28px',
                borderRadius: 'var(--radius)',
                border: 'none',
                background: color,
                color: '#fff',
                fontSize: 18,
                fontWeight: 700,
                cursor: 'pointer',
                textShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }}
            >
              {t('handoff.ready')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
