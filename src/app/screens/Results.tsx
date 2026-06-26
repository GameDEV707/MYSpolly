import { useTranslation } from 'react-i18next';
import { useApp } from '../store/appStore.ts';
import { Button, Panel, ScreenShell, PLAYER_CSS_VAR } from '../components/ui.tsx';

/** Final results with standings and Rematch / Main Menu / Replay options. */
export function Results(): JSX.Element {
  const { t } = useTranslation();
  const game = useApp((s) => s.game);
  const goto = useApp((s) => s.goto);
  const lastConfig = useApp((s) => s.lastConfig);
  const newGame = useApp((s) => s.newGame);

  if (!game || !game.ranking) {
    return (
      <ScreenShell title={t('results.title')} onBack={() => goto('mainMenu')}>
        <p>{t('load.empty')}</p>
      </ScreenShell>
    );
  }

  const winner = game.players[game.ranking[0]!]!;
  const tie =
    game.ranking.length > 1 &&
    game.players[game.ranking[1]!]!.vp === winner.vp &&
    game.players[game.ranking[1]!]!.incomeLevel === winner.incomeLevel &&
    game.players[game.ranking[1]!]!.money === winner.money;

  return (
    <ScreenShell title={t('results.title')}>
      <div
        style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <h2 style={{ fontFamily: 'var(--font-display)' }}>
          {tie ? t('results.tie') : t('results.winner', { name: winner.name })}
        </h2>
        <Panel>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                <th>#</th>
                <th></th>
                <th>
                  {t('setup.human')}/{t('setup.ai')}
                </th>
                <th style={{ textAlign: 'right' }}>{t('game.income')}</th>
                <th style={{ textAlign: 'right' }}>{t('game.money')}</th>
                <th style={{ textAlign: 'right' }}>{t('results.total')}</th>
              </tr>
            </thead>
            <tbody>
              {game.ranking.map((color, i) => {
                const p = game.players[color]!;
                return (
                  <tr key={color}>
                    <td>{i + 1}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: PLAYER_CSS_VAR[color],
                          }}
                        />
                        {p.name}
                      </span>
                    </td>
                    <td>{p.isAI ? t('setup.ai') : t('setup.human')}</td>
                    <td style={{ textAlign: 'right' }}>{p.incomeLevel}</td>
                    <td style={{ textAlign: 'right' }}>£{p.money}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.vp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {lastConfig && (
            <Button onClick={() => newGame(lastConfig)}>{t('results.rematch')}</Button>
          )}
          <Button variant="ghost" onClick={() => goto('mainMenu')}>
            {t('results.mainMenu')}
          </Button>
          <Button variant="ghost" onClick={() => goto('replay')}>
            {t('results.viewReplay')}
          </Button>
        </div>
      </div>
    </ScreenShell>
  );
}
