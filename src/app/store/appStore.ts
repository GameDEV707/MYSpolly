import { create } from 'zustand';
import type { GameState } from '../../core/model/state.ts';
import type { Action } from '../../core/model/actions.ts';
import type { GameEvent } from '../../core/model/events.ts';
import type { PlayerColor } from '../../core/model/types.ts';
import { buildInitialState, type PlayerSeat } from '../../core/engine/setup.ts';
import { reduce } from '../../core/engine/reduce.ts';
import { makeBot, type Bot, type Difficulty } from '../../ai/bot.ts';
import { autosave, loadAutosave } from '../../persistence/save.ts';

export type AppScreen =
  | 'splash'
  | 'mainMenu'
  | 'setup'
  | 'load'
  | 'settings'
  | 'rules'
  | 'credits'
  | 'game'
  | 'pause'
  | 'results'
  | 'replay';

export interface UiSeat {
  color: PlayerColor;
  name: string;
  isAI: boolean;
  difficulty: Difficulty;
}

export interface NewGameConfig {
  seats: UiSeat[];
  introMode: boolean;
  boardSide: 'day' | 'night';
  lang: 'en' | 'ru' | 'uz';
  seed?: number;
}

/** Bots live outside the serializable state (functions aren't JSON). */
const bots = new Map<PlayerColor, Bot>();
let aiTimer: ReturnType<typeof setTimeout> | null = null;

const AI_DELAY: Record<string, number> = { slow: 1200, normal: 600, fast: 150 };

interface AppStore {
  screen: AppScreen;
  /** Screen to return to after Settings (Main Menu or Pause). */
  settingsReturn: AppScreen;
  game: GameState | null;
  /** Recent events, for the log + animation queue. */
  events: GameEvent[];
  /** The action log (for replays): seed + actions reproduce the game. */
  actionLog: Action[];
  lastConfig: NewGameConfig | null;
  aiThinking: boolean;

  goto: (screen: AppScreen) => void;
  openSettings: (from: AppScreen) => void;
  newGame: (config: NewGameConfig) => void;
  continueGame: () => Promise<boolean>;
  loadGame: (state: GameState) => void;
  dispatch: (action: Action) => void;
  abandon: () => void;
}

function rebuildBots(
  state: GameState,
  difficulties: Map<PlayerColor, Difficulty>,
  seed: number,
): void {
  bots.clear();
  let i = 0;
  for (const color of state.turnOrder) {
    const p = state.players[color];
    if (p?.isAI) {
      bots.set(color, makeBot(difficulties.get(color) ?? 'normal', seed + i + 1));
    }
    i += 1;
  }
}

export const useApp = create<AppStore>((set, get) => ({
  screen: 'splash',
  settingsReturn: 'mainMenu',
  game: null,
  events: [],
  actionLog: [],
  lastConfig: null,
  aiThinking: false,

  goto(screen) {
    set({ screen });
  },

  openSettings(from) {
    set({ screen: 'settings', settingsReturn: from });
  },

  newGame(config) {
    if (aiTimer) clearTimeout(aiTimer);
    const seed = config.seed ?? Math.floor(Math.random() * 2 ** 31);
    const seats: PlayerSeat[] = config.seats.map((s) => ({
      color: s.color,
      name: s.name,
      isAI: s.isAI,
    }));
    const game = buildInitialState({
      seats,
      seed,
      introMode: config.introMode,
      boardSide: config.boardSide,
      lang: config.lang,
    });
    const difficulties = new Map(config.seats.map((s) => [s.color, s.difficulty]));
    rebuildBots(game, difficulties, seed);
    set({ game, events: [], actionLog: [], screen: 'game', lastConfig: { ...config, seed } });
    void autosave(game);
    maybeRunAi(get, set);
  },

  async continueGame() {
    const game = await loadAutosave();
    if (!game) return false;
    // Difficulties aren't stored in the save; AI seats resume at 'normal'.
    rebuildBots(game, new Map(), game.seed);
    set({ game, events: [], actionLog: [], screen: 'game' });
    maybeRunAi(get, set);
    return true;
  },

  loadGame(state) {
    rebuildBots(state, new Map(), state.seed);
    set({ game: state, events: [], actionLog: [], screen: 'game' });
    maybeRunAi(get, set);
  },

  dispatch(action) {
    const { game } = get();
    if (!game || game.phase !== 'playing') return;
    const { state, events } = reduce(game, action);
    set((s) => ({ game: state, events, actionLog: [...s.actionLog, action] }));
    void autosave(state);
    if (state.phase === 'gameOver') {
      set({ screen: 'results' });
      return;
    }
    maybeRunAi(get, set);
  },

  abandon() {
    if (aiTimer) clearTimeout(aiTimer);
    bots.clear();
    set({ game: null, events: [], actionLog: [], screen: 'mainMenu' });
  },
}));

/** If the active player is an AI, schedule its move (with a "thinking" delay). */
function maybeRunAi(get: () => AppStore, set: (p: Partial<AppStore>) => void): void {
  const { game } = get();
  if (!game || game.phase !== 'playing') return;
  const active = game.players[game.activePlayer];
  if (!active?.isAI) {
    set({ aiThinking: false });
    return;
  }
  set({ aiThinking: true });
  // Pace AI moves; the speed is read lazily so settings changes apply.
  if (aiTimer) clearTimeout(aiTimer);
  aiTimer = setTimeout(() => {
    const cur = get().game;
    if (!cur || cur.phase !== 'playing') {
      set({ aiThinking: false });
      return;
    }
    const bot = bots.get(cur.activePlayer);
    if (!bot) {
      set({ aiThinking: false });
      return;
    }
    try {
      const action = bot.chooseAction(cur, cur.activePlayer);
      get().dispatch(action);
    } catch {
      set({ aiThinking: false });
    }
  }, AI_DELAY.normal);
}
