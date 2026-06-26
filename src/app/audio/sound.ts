import { Howl, Howler } from 'howler';
import type { Settings } from '../store/settings.ts';

/**
 * Audio engine (Howler.js). A small mixer with master / SFX / music channels,
 * driven by the persisted settings. Every clip fails soft: if an asset is
 * missing the game keeps running silently (assets are added in `public/assets/
 * audio/` as CC0 / original — see ASSETS_CREDITS.md).
 */

export type Sfx =
  | 'tilePlace'
  | 'linkPlace'
  | 'cube'
  | 'coin'
  | 'cardDraw'
  | 'cardDiscard'
  | 'flip'
  | 'button'
  | 'error'
  | 'eraFanfare'
  | 'victory';

export type Music = 'menu' | 'canal' | 'rail';

const SFX_SRC: Record<Sfx, string> = {
  tilePlace: 'assets/audio/sfx/tile-place.mp3',
  linkPlace: 'assets/audio/sfx/link-place.mp3',
  cube: 'assets/audio/sfx/cube.mp3',
  coin: 'assets/audio/sfx/coin.mp3',
  cardDraw: 'assets/audio/sfx/card-draw.mp3',
  cardDiscard: 'assets/audio/sfx/card-discard.mp3',
  flip: 'assets/audio/sfx/flip.mp3',
  button: 'assets/audio/sfx/button.mp3',
  error: 'assets/audio/sfx/error.mp3',
  eraFanfare: 'assets/audio/sfx/era-fanfare.mp3',
  victory: 'assets/audio/sfx/victory.mp3',
};

const MUSIC_SRC: Record<Music, string> = {
  menu: 'assets/audio/music/menu.mp3',
  canal: 'assets/audio/music/canal.mp3',
  rail: 'assets/audio/music/rail.mp3',
};

class AudioEngine {
  private sfx = new Map<Sfx, Howl>();
  private music = new Map<Music, Howl>();
  private currentMusic: Music | null = null;
  private settings: Settings | null = null;

  private getSfx(name: Sfx): Howl {
    let h = this.sfx.get(name);
    if (!h) {
      h = new Howl({ src: [SFX_SRC[name]], volume: 1, preload: true, html5: false });
      this.sfx.set(name, h);
    }
    return h;
  }

  private getMusic(name: Music): Howl {
    let h = this.music.get(name);
    if (!h) {
      h = new Howl({ src: [MUSIC_SRC[name]], volume: 1, loop: true, html5: true });
      this.music.set(name, h);
    }
    return h;
  }

  applySettings(s: Settings): void {
    this.settings = s;
    Howler.mute(s.muted);
    Howler.volume(s.masterVolume);
    if (this.currentMusic) {
      this.getMusic(this.currentMusic).volume(s.musicVolume);
    }
  }

  playSfx(name: Sfx): void {
    if (!this.settings || this.settings.muted) return;
    try {
      const h = this.getSfx(name);
      h.volume(this.settings.sfxVolume);
      h.play();
    } catch {
      /* missing asset → silent */
    }
  }

  playMusic(name: Music): void {
    if (this.currentMusic === name) return;
    this.stopMusic();
    this.currentMusic = name;
    if (!this.settings) return;
    try {
      const h = this.getMusic(name);
      h.volume(this.settings.musicVolume);
      h.play();
    } catch {
      /* missing asset → silent */
    }
  }

  stopMusic(): void {
    if (this.currentMusic) {
      try {
        this.getMusic(this.currentMusic).stop();
      } catch {
        /* ignore */
      }
      this.currentMusic = null;
    }
  }
}

export const audio = new AudioEngine();
