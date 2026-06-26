import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp, type UiSeat, type NewGameConfig } from '../store/appStore.ts';
import { useSettings } from '../store/settings.ts';
import { Button, Panel, ScreenShell, PLAYER_CSS_VAR } from '../components/ui.tsx';
import type { PlayerColor } from '../../core/model/types.ts';
import type { Difficulty } from '../../ai/bot.ts';

const COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow'];

function defaultSeats(n: number): UiSeat[] {
  return COLORS.slice(0, n).map((color, i) => ({
    color,
    name: i === 0 ? 'Player 1' : `Bot ${i}`,
    isAI: i !== 0,
    difficulty: 'normal' as Difficulty,
  }));
}

/** New-game setup (§3.5 / Phase 3.5): players, human/AI, colours, board, lang. */
export function GameSetup(): JSX.Element {
  const { t } = useTranslation();
  const goto = useApp((s) => s.goto);
  const newGame = useApp((s) => s.newGame);
  const { settings } = useSettings();

  const [count, setCount] = useState(2);
  const [seats, setSeats] = useState<UiSeat[]>(defaultSeats(2));
  const [introMode, setIntroMode] = useState(false);

  function setPlayers(n: number): void {
    setCount(n);
    setSeats(defaultSeats(n));
  }
  function patchSeat(i: number, patch: Partial<UiSeat>): void {
    setSeats((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function start(): void {
    const config: NewGameConfig = {
      seats,
      introMode,
      boardSide: settings.boardSide,
      lang: settings.lang,
    };
    newGame(config);
  }

  return (
    <ScreenShell
      title={t('setup.title')}
      onBack={() => goto('mainMenu')}
      backLabel={t('setup.back')}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 640 }}
      >
        <Panel>
          <label style={{ fontWeight: 600 }}>{t('setup.players')}</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[2, 3, 4].map((n) => (
              <Button
                key={n}
                variant={count === n ? 'primary' : 'ghost'}
                onClick={() => setPlayers(n)}
              >
                {n}
              </Button>
            ))}
          </div>
        </Panel>

        {seats.map((seat, i) => (
          <Panel key={seat.color}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: PLAYER_CSS_VAR[seat.color],
                  display: 'inline-block',
                }}
              />
              <input
                value={seat.name}
                onChange={(e) => patchSeat(i, { name: e.target.value })}
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '6px 8px',
                }}
              />
              <Button
                variant={seat.isAI ? 'ghost' : 'primary'}
                onClick={() => patchSeat(i, { isAI: false })}
              >
                {t('setup.human')}
              </Button>
              <Button
                variant={seat.isAI ? 'primary' : 'ghost'}
                onClick={() => patchSeat(i, { isAI: true })}
              >
                {t('setup.ai')}
              </Button>
              {seat.isAI && (
                <select
                  value={seat.difficulty}
                  onChange={(e) => patchSeat(i, { difficulty: e.target.value as Difficulty })}
                  style={{
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '6px',
                  }}
                >
                  <option value="easy">{t('setup.easy')}</option>
                  <option value="normal">{t('setup.normal')}</option>
                  <option value="hard">{t('setup.hard')}</option>
                </select>
              )}
            </div>
          </Panel>
        ))}

        <Panel>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={introMode}
              onChange={(e) => setIntroMode(e.target.checked)}
            />
            {t('setup.introVariant')}
          </label>
        </Panel>

        <Button onClick={start} style={{ alignSelf: 'flex-start' }}>
          {t('setup.start')}
        </Button>
      </div>
    </ScreenShell>
  );
}
