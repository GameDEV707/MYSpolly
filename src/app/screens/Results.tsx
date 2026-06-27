import { useTranslation } from 'react-i18next';
import { useApp } from '../store/appStore.ts';
import { fullBreakdown } from '../../core/selectors/standings.ts';
import { Button, Panel, ScreenShell, PLAYER_CSS_VAR } from '../components/ui.tsx';

/** Final results with standings and Rematch / Main Menu / Replay options. */
export function Results(): JSX.Element {
  const { t } = useTranslation();
  const game = useApp((s) => s.game);
  const goto = useApp((s) => s.goto);
  const lastConfig = useApp((s) => s.lastConfig);
  const newGame = useApp((s) => s.newGame);
  const startReplay = useApp((s) => s.startReplay);

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
                <th style={{ textAlign: 'right' }} title={t('results.inPlayTip')}>
                  {t('results.inPlay')}
                </th>
                <th style={{ textAlign: 'right' }} title={t('results.linksTip')}>
                  {t('results.links')}
                </th>
                <th style={{ textAlign: 'right' }} title={t('results.tilesTip')}>
                  {t('results.tiles')}
                </th>
                <th style={{ textAlign: 'right' }}>{t('results.total')}</th>
              </tr>
            </thead>
            <tbody>
              {game.ranking.map((color, i) => {
                const p = game.players[color]!;
                const b = fullBreakdown(game, color);
                // Fold the intro-variant bonus (Canal-only games) into the
                // in-play column so the row always reads inPlay + links + tiles
                // = total; a tooltip notes the included bonus.
                const inPlayShown = b.inPlay + b.intro;
                const inPlayTip = b.intro !== 0 ? t('results.inPlayBonusTip', { n: b.intro }) : t('results.inPlayTip');
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
                    <td style={{ textAlign: 'right' }} title={inPlayTip}>
                      {inPlayShown}
                    </td>
                    <td style={{ textAlign: 'right' }}>{b.links}</td>
                    <td style={{ textAlign: 'right' }}>{b.tiles}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{b.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
            {t('results.breakdownNote')}
          </p>
        </Panel>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {lastConfig && (
            <Button onClick={() => newGame(lastConfig)}>{t('results.rematch')}</Button>
          )}
          <Button variant="ghost" onClick={() => goto('mainMenu')}>
            {t('results.mainMenu')}
          </Button>
          <Button variant="ghost" onClick={() => startReplay()}>
            {t('results.viewReplay')}
          </Button>
        </div>
      </div>
    </ScreenShell>
  );
}
