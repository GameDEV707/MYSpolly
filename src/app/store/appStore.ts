import { create } from 'zustand';
import type { GameState } from '../../core/model/state.ts';
import type { Action } from '../../core/model/actions.ts';
import type { GameEvent } from '../../core/model/events.ts';
import type { PlayerColor } from '../../core/model/types.ts';
import { buildInitialState, type PlayerSeat } from '../../core/engine/setup.ts';
import { reduce } from '../../core/engine/reduce.ts';
import { makeBot, type Bot, type Difficulty } from '../../ai/bot.ts';
import { autosave, loadAutosave } from '../../persistence/save.ts';
import { useSettings } from './settings.ts';

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
  /** When opening the Rules Library via a deep link, the chapter id to show. */
  rulesChapter: string | null;
  game: GameState | null;
  /** Recent events, for the log + animation queue. */
  events: GameEvent[];
  /** The action log (for replays): seed + actions reproduce the game. */
  actionLog: Action[];
  lastConfig: NewGameConfig | null;
  aiThinking: boolean;

  goto: (screen: AppScreen) => void;
  openSettings: (from: AppScreen) => void;
  /** Open the Rules Library, optionally at a chapter, returning to `from`. */
  openRules: (from: AppScreen, chapter?: string | null) => void;
  newGame: (config: NewGameConfig) => void;
  continueGame: () => Promise<boolean>;
  loadGame: (state: GameState) => void;
  dispatch: (action: Action) => void;
  abandon: () => void;
  startReplay: () => void;
  replayStep: (dir: number) => void;
  replayIndex: number;
  replayActions: Action[];
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
  rulesChapter: null,
  game: null,
  events: [],
  actionLog: [],
  lastConfig: null,
  aiThinking: false,
  replayIndex: 0,
  replayActions: [],

  goto(screen) {
    set({ screen });
  },

  openSettings(from) {
    set({ screen: 'settings', settingsReturn: from });
  },

  openRules(from, chapter = null) {
    set({ screen: 'rules', settingsReturn: from, rulesChapter: chapter });
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

  /** Start replaying the just-finished game from its seed + recorded actions. */
  startReplay() {
    if (aiTimer) clearTimeout(aiTimer);
    const { lastConfig, actionLog } = get();
    if (!lastConfig) return;
    const base = rebuildFromConfig(lastConfig);
    set({
      game: base,
      replayActions: [...actionLog],
      replayIndex: 0,
      screen: 'replay',
      events: [],
    });
  },

  /** Step the replay forwards/backwards, recomputing state from the seed. */
  replayStep(dir) {
    const { lastConfig, replayActions, replayIndex } = get();
    if (!lastConfig) return;
    const idx = Math.max(0, Math.min(replayActions.length, replayIndex + dir));
    let state = rebuildFromConfig(lastConfig);
    let events: GameEvent[] = [];
    for (let i = 0; i < idx; i += 1) {
      const res = reduce(state, replayActions[i]!);
      state = res.state;
      events = res.events;
    }
    set({ game: state, replayIndex: idx, events });
  },
}));

function rebuildFromConfig(config: NewGameConfig): GameState {
  return buildInitialState({
    seats: config.seats.map((s) => ({ color: s.color, name: s.name, isAI: s.isAI })),
    seed: config.seed ?? 0,
    introMode: config.introMode,
    boardSide: config.boardSide,
    lang: config.lang,
  });
}

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
  // Pace AI moves; the speed is read from settings so changes apply immediately.
  if (aiTimer) clearTimeout(aiTimer);
  const speed = useSettings.getState().settings.aiThinkSpeed;
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
  }, AI_DELAY[speed] ?? AI_DELAY.normal);
}
