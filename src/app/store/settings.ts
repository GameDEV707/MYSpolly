import { create } from 'zustand';
import type { Lang } from '../i18n/index.ts';
import { setLanguage } from '../i18n/index.ts';
import { getSetting, setSetting } from '../../persistence/db.ts';
import { audio } from '../audio/sound.ts';

export type AnimSpeed = 'slow' | 'normal' | 'fast' | 'instant';
export type AiSpeed = 'slow' | 'normal' | 'fast';

export interface Settings {
  lang: Lang;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  animationSpeed: AnimSpeed;
  reducedMotion: boolean;
  skipAiAnimations: boolean;
  boardSide: 'day' | 'night';
  colorBlind: boolean;
  confirmEndTurn: boolean;
  showLegalMoves: boolean;
  showTooltips: boolean;
  rulesHints: boolean;
  passDevicePrompt: boolean;
  tutorialDone: boolean;
  aiThinkSpeed: AiSpeed;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en',
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  muted: false,
  animationSpeed: 'normal',
  reducedMotion: false,
  skipAiAnimations: true,
  boardSide: 'night',
  colorBlind: false,
  confirmEndTurn: true,
  showLegalMoves: true,
  showTooltips: true,
  rulesHints: true,
  passDevicePrompt: true,
  tutorialDone: false,
  aiThinkSpeed: 'normal',
};

const SETTINGS_KEY = 'settings';

const ANIM_SCALE: Record<AnimSpeed, string> = {
  slow: '1.6',
  normal: '1',
  fast: '0.5',
  instant: '0',
};

/** Apply settings that affect the DOM (theme, animation speed, palette). */
export function applySettingsToDom(s: Settings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-board', s.boardSide);
  root.setAttribute('data-palette', s.colorBlind ? 'colorblind' : 'default');
  root.setAttribute('data-anim', s.reducedMotion ? 'instant' : s.animationSpeed);
  root.style.setProperty('--anim-scale', s.reducedMotion ? '0' : ANIM_SCALE[s.animationSpeed]);
}

interface SettingsStore {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    const saved = await getSetting<Settings>(SETTINGS_KEY);
    const settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
    set({ settings, loaded: true });
    applySettingsToDom(settings);
    audio.applySettings(settings);
    setLanguage(settings.lang);
  },
  update(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    applySettingsToDom(settings);
    audio.applySettings(settings);
    if (patch.lang) setLanguage(patch.lang);
    void setSetting(SETTINGS_KEY, settings);
  },
  reset() {
    set({ settings: DEFAULT_SETTINGS });
    applySettingsToDom(DEFAULT_SETTINGS);
    audio.applySettings(DEFAULT_SETTINGS);
    setLanguage(DEFAULT_SETTINGS.lang);
    void setSetting(SETTINGS_KEY, DEFAULT_SETTINGS);
  },
}));
