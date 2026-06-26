import type { CSSProperties, ReactNode } from 'react';

/** Small shared presentational primitives used across screens. */

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  title?: string;
  style?: CSSProperties;
}): JSX.Element {
  const { children, onClick, disabled, variant = 'primary', title, style } = props;
  const bg =
    variant === 'primary'
      ? 'var(--accent)'
      : variant === 'danger'
        ? 'var(--player-red)'
        : 'transparent';
  const color = variant === 'primary' ? '#1a1207' : 'var(--text)';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '10px 18px',
        borderRadius: 'var(--radius)',
        border: variant === 'ghost' ? '1px solid var(--border)' : 'none',
        background: disabled ? 'var(--surface)' : bg,
        color: disabled ? 'var(--text-muted)' : color,
        fontSize: 16,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'transform var(--anim-fast), background var(--anim-fast)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Panel(props: { children: ReactNode; style?: CSSProperties }): JSX.Element {
  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-4)',
        boxShadow: 'var(--shadow-1)',
        ...props.style,
      }}
    >
      {props.children}
    </div>
  );
}

export function ScreenShell(props: {
  title?: string;
  children: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}): JSX.Element {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-8)',
        gap: 'var(--space-6)',
        overflow: 'auto',
      }}
    >
      {props.title && (
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>{props.title}</h1>
      )}
      <div style={{ flex: 1 }}>{props.children}</div>
      {props.onBack && (
        <div>
          <Button variant="ghost" onClick={props.onBack}>
            ← {props.backLabel ?? 'Back'}
          </Button>
        </div>
      )}
    </div>
  );
}

export const PLAYER_CSS_VAR: Record<string, string> = {
  red: 'var(--player-red)',
  blue: 'var(--player-blue)',
  green: 'var(--player-green)',
  yellow: 'var(--player-yellow)',
};
