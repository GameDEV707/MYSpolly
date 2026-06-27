import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../core/model/state.ts';
import type { GameEvent } from '../../core/model/events.ts';
import { boardContext } from '../../core/maps/context.ts';
import { shortestPath } from '../../core/selectors/connectivity.ts';
import { BOARD_W, BOARD_H } from '../components/board/layout.ts';
import { audio, type Sfx } from '../audio/sound.ts';
import { useSettings } from '../store/settings.ts';
import type { RouteType } from '../../core/maps/types.ts';

/**
 * Era goods-delivery transport animation (§7.4.1 / Phase 8G).
 *
 * On every `GOODS_SOLD` event, an era-appropriate vehicle (Canal → boat, Rail →
 * train, Air → cargo plane) spawns at the producing factory, carries a visible
 * cargo token **along the actual link route** to the destination merchant,
 * delivers it (the tile-flip/income beats play via the main animation queue),
 * then returns to its origin and despawns. Multiple deliveries in one Sell are
 * staggered. Honours animation speed/skip and reduced-motion (degrades to a
 * quick straight cargo hop), and falls back to a straight line if no link route
 * exists.
 */

interface Pt {
  x: number;
  y: number;
}

interface Delivery {
  key: number;
  points: Pt[];
  routeType: RouteType;
  /** Start delay (stagger) in ms. */
  delay: number;
  /** Forward travel duration in ms (scaled by the speed setting). */
  travelMs: number;
  reduced: boolean;
}

const VEHICLE_GLYPH: Record<RouteType, string> = { canal: '🛶', rail: '🚂', air: '✈️' };
const VEHICLE_SFX: Record<RouteType, Sfx> = {
  canal: 'boatHorn',
  rail: 'trainWhistle',
  air: 'planeFlyby',
};

const SPEED_SCALE: Record<string, number> = { slow: 1.6, normal: 1, fast: 0.5, instant: 0 };

let keySeq = 0;

export function GoodsDeliveryLayer(props: {
  game: GameState;
  events: GameEvent[];
  skipAll?: boolean;
}): JSX.Element | null {
  const { game, events, skipAll } = props;
  const { settings } = useSettings();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => {
    const sold = events.filter(
      (e): e is Extract<GameEvent, { t: 'GOODS_SOLD' }> => e.t === 'GOODS_SOLD',
    );
    if (sold.length === 0) return;

    const reduced = settings.reducedMotion;
    const instant = settings.animationSpeed === 'instant';
    // On AI-skip or instant speed, we don't animate vehicles at all (the sale's
    // flip/income still resolve via the main queue).
    if (skipAll || instant) return;

    const ctx = boardContext(game);
    const layout = ctx.map.layout[game.era] ?? {};
    const scale = SPEED_SCALE[settings.animationSpeed] ?? 1;

    const next: Delivery[] = [];
    sold.forEach((s, i) => {
      const path = shortestPath(game, s.from, s.merchantLocationId);
      const ids = path && path.length >= 2 ? path : [s.from, s.merchantLocationId];
      const points = ids.map((id) => layout[id]).filter((p): p is Pt => !!p);
      if (points.length < 2) return;
      next.push({
        key: (keySeq += 1),
        points,
        routeType: ctx.eraDef.routeType,
        delay: i * 350,
        travelMs: Math.max(700, points.length * 420) * scale,
        reduced,
      });
    });
    if (next.length > 0) setDeliveries((cur) => [...cur, ...next]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const remove = (key: number): void => {
    setDeliveries((cur) => cur.filter((d) => d.key !== key));
  };

  if (deliveries.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 4,
      }}
      aria-hidden
    >
      {deliveries.map((d) => (
        <Vehicle key={d.key} delivery={d} onDone={() => remove(d.key)} />
      ))}
    </svg>
  );
}

/** Cumulative-length helper for traversing a polyline at parameter t∈[0,1]. */
function makeTraverser(points: Pt[]): (t: number) => { p: Pt; angle: number } {
  const segLen: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segLen.push(len);
    total += len;
  }
  return (t: number) => {
    const target = Math.max(0, Math.min(1, t)) * total;
    let acc = 0;
    for (let i = 0; i < segLen.length; i += 1) {
      const len = segLen[i]!;
      if (acc + len >= target || i === segLen.length - 1) {
        const a = points[i]!;
        const b = points[i + 1]!;
        const f = len > 0 ? (target - acc) / len : 0;
        return {
          p: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
          angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
        };
      }
      acc += len;
    }
    const last = points[points.length - 1]!;
    return { p: last, angle: 0 };
  };
}

/**
 * One vehicle: forward (carry cargo) → deliver dwell → return → despawn, driven
 * by requestAnimationFrame (imperative transform, no per-frame React render).
 */
function Vehicle(props: { delivery: Delivery; onDone: () => void }): JSX.Element {
  const { delivery, onDone } = props;
  const groupRef = useRef<SVGGElement | null>(null);
  const cargoRef = useRef<SVGTextElement | null>(null);
  const traverse = useRef(makeTraverser(delivery.points));

  useEffect(() => {
    const travel = delivery.travelMs;
    const dwell = 260;
    const startAt = performance.now() + delivery.delay;
    let raf = 0;
    let sfxPlayed = false;

    const apply = (t: number, carrying: boolean): void => {
      const { p, angle } = traverse.current(t);
      const g = groupRef.current;
      if (g) {
        const rot = delivery.routeType === 'air' ? ` rotate(${angle})` : '';
        g.setAttribute('transform', `translate(${p.x},${p.y})${rot}`);
        g.style.opacity = '1';
      }
      if (cargoRef.current) cargoRef.current.style.opacity = carrying ? '1' : '0';
    };

    const frame = (now: number): void => {
      if (now < startAt) {
        if (groupRef.current) groupRef.current.style.opacity = '0';
        raf = requestAnimationFrame(frame);
        return;
      }
      if (!sfxPlayed) {
        sfxPlayed = true;
        audio.playSfx(VEHICLE_SFX[delivery.routeType]);
      }
      const elapsed = now - startAt;
      const total = travel + dwell + travel;
      if (elapsed >= total) {
        onDone();
        return;
      }
      if (elapsed < travel) {
        apply(elapsed / travel, true); // forward, carrying cargo
      } else if (elapsed < travel + dwell) {
        apply(1, false); // delivered: drop cargo at the merchant
      } else {
        const rt = (elapsed - travel - dwell) / travel;
        apply(1 - rt, false); // return empty to origin
      }
      raf = requestAnimationFrame(frame);
    };

    // Reduced motion: jump cargo to the merchant briefly, then done.
    if (delivery.reduced) {
      apply(1, true);
      const id = setTimeout(onDone, 350);
      return () => clearTimeout(id);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <g ref={groupRef} style={{ opacity: 0 }}>
      <circle r={13} fill="rgba(0,0,0,0.35)" />
      <text textAnchor="middle" y={5} fontSize={18}>
        {VEHICLE_GLYPH[delivery.routeType]}
      </text>
      <text ref={cargoRef} textAnchor="middle" y={-12} fontSize={11}>
        📦
      </text>
    </g>
  );
}
