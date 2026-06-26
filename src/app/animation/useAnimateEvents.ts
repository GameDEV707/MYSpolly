import { useEffect, useRef, useState } from 'react';
import type { GameEvent } from '../../core/model/events.ts';
import { audio } from '../audio/sound.ts';
import { useSettings } from '../store/settings.ts';
import { eventToFx, scaledDuration } from './timelines.ts';

/**
 * Sequential animation/audio queue. Each batch of events emitted by `reduce` is
 * played in order: the matching SFX fires and a per-event duration elapses
 * (scaled by the animation-speed setting; 0 when reduced-motion/instant). Returns
 * the currently-animating event and an active full-screen banner key, plus a
 * `skip` to flush the queue. Animations are skipped entirely on AI turns when the
 * "skip AI animations" setting is on (the caller passes `skipAll`).
 */
export function useAnimateEvents(
  events: GameEvent[],
  skipAll = false,
): {
  current: GameEvent | null;
  banner: string | null;
  skip: () => void;
} {
  const { settings } = useSettings();
  const [current, setCurrent] = useState<GameEvent | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const queueRef = useRef<GameEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    queueRef.current = [...events];
    if (skipAll || settings.reducedMotion || settings.animationSpeed === 'instant') {
      // Fire all sounds at once-ish, no visual dwell.
      for (const e of events) {
        const fx = eventToFx(e);
        if (fx.sfx) audio.playSfx(fx.sfx);
      }
      setCurrent(null);
      setBanner(null);
      return;
    }
    if (!runningRef.current) pump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, skipAll]);

  function pump(): void {
    const next = queueRef.current.shift();
    if (!next) {
      runningRef.current = false;
      setCurrent(null);
      setBanner(null);
      return;
    }
    runningRef.current = true;
    const fx = eventToFx(next);
    if (fx.sfx) audio.playSfx(fx.sfx);
    setCurrent(next);
    setBanner(fx.banner ?? null);
    const dur = scaledDuration(fx.durationMs, settings.animationSpeed, settings.reducedMotion);
    timerRef.current = setTimeout(pump, Math.max(16, dur));
  }

  function skip(): void {
    if (timerRef.current) clearTimeout(timerRef.current);
    for (const e of queueRef.current) {
      const fx = eventToFx(e);
      if (fx.sfx) audio.playSfx(fx.sfx);
    }
    queueRef.current = [];
    runningRef.current = false;
    setCurrent(null);
    setBanner(null);
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { current, banner, skip };
}
