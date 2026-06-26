import { useEffect, useState } from 'react';

/**
 * M0 placeholder application shell.
 *
 * This renders a minimal "Hello Brass" screen so the offline web build is
 * runnable from the very first phase. It will be replaced in Phase 3 by the
 * full screen router (Splash → Main Menu → Game …) described in §7.10 of
 * MYSpolly.md. The application must always boot to the Main Menu and never
 * auto-start a game.
 */
export function App(): JSX.Element {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 'var(--space-4)',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 48, margin: 0 }}>MYSpolly</h1>
      <p style={{ color: 'var(--text-muted)', margin: 0 }}>Brass: Birmingham — Desktop Edition</p>
      <p style={{ color: 'var(--accent)' }}>{ready ? 'Hello Brass!' : 'Loading…'}</p>
    </div>
  );
}
