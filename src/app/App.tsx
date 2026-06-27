import { useEffect } from 'react';
import { useApp } from './store/appStore.ts';
import { useSettings } from './store/settings.ts';
import { initI18n } from './i18n/index.ts';
import { audio } from './audio/sound.ts';
import { Splash } from './screens/Splash.tsx';
import { MainMenu } from './screens/MainMenu.tsx';
import { GameSetup } from './screens/GameSetup.tsx';
import { LoadGame } from './screens/LoadGame.tsx';
import { SettingsScreen } from './screens/Settings.tsx';
import { Rules } from './screens/Rules.tsx';
import { Tutorial } from './screens/Tutorial.tsx';
import { Credits } from './screens/Credits.tsx';
import { GameScreen } from './screens/Game.tsx';
import { PauseMenu } from './screens/PauseMenu.tsx';
import { Results } from './screens/Results.tsx';

/**
 * Top-level screen router. The app ALWAYS boots to the Splash screen, which
 * auto-advances to the Main Menu — never directly into a game (see §7.10).
 */
export function App(): JSX.Element {
  const screen = useApp((s) => s.screen);
  const loadSettings = useSettings((s) => s.load);

  useEffect(() => {
    initI18n();
    void loadSettings();
  }, [loadSettings]);

  // Menu ambience on non-game screens; the Game screen drives era music itself.
  useEffect(() => {
    const inGame = screen === 'game' || screen === 'replay';
    if (!inGame) audio.playMusic('menu');
  }, [screen]);

  switch (screen) {
    case 'splash':
      return <Splash />;
    case 'mainMenu':
      return <MainMenu />;
    case 'setup':
      return <GameSetup />;
    case 'load':
      return <LoadGame />;
    case 'settings':
      return <SettingsScreen />;
    case 'rules':
      return <Rules />;
    case 'tutorial':
      return <Tutorial />;
    case 'credits':
      return <Credits />;
    case 'game':
      return <GameScreen />;
    case 'pause':
      return <PauseMenu />;
    case 'results':
      return <Results />;
    case 'replay':
      return <GameScreen replay />;
    default:
      return <MainMenu />;
  }
}
