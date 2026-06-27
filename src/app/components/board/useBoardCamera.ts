import { useCallback, useEffect, useRef, useState } from 'react';
import { BOARD_W, BOARD_H } from './layout.ts';

/**
 * Interactive board camera (§7.11). Owns a 2D transform `{ scale, tx, ty }` as
 * pure UI state (a ref — never part of the serializable GameState) and applies
 * it imperatively via a CSS `transform` on the content element, so panning and
 * zooming never trigger a React re-render (steady 60 fps). A lightweight `lod`
 * state changes only when the zoom crosses a level-of-detail threshold.
 *
 * Supports: mouse-wheel zoom toward the cursor, click/middle-drag panning,
 * touch/trackpad pinch-zoom + two-finger pan, clamped pan bounds with generous
 * over-pan, keyboard (arrows pan, +/- zoom, 0 reset), on-screen zoom/fit
 * controls, auto fit-to-screen on load + resize, and per-session persistence.
 */

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 3.2;

export type Lod = 'low' | 'mid' | 'high';

interface Cam {
  scale: number;
  tx: number;
  ty: number;
}

export interface BoardCameraApi {
  viewportRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  /** Current level-of-detail bucket (drives map rendering density). */
  lod: Lod;
  /** Current zoom as a percentage, for the on-screen readout (settles, not per-frame). */
  zoomPct: number;
  /** Settled camera + viewport size, for the optional mini-map (updates at rest). */
  view: { scale: number; tx: number; ty: number; vw: number; vh: number };
  zoomIn: () => void;
  zoomOut: () => void;
  /** Fit the whole board into the viewport and centre it. */
  fit: () => void;
}

const STORAGE_KEY = 'myspolly.boardCamera';

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lodFor(scale: number): Lod {
  if (scale < 0.62) return 'low';
  if (scale < 1.15) return 'mid';
  return 'high';
}

export function useBoardCamera(): BoardCameraApi {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Live camera (applied every frame) + target (eased toward for wheel/keys).
  const cam = useRef<Cam>({ scale: 1, tx: 0, ty: 0 });
  const target = useRef<Cam>({ scale: 1, tx: 0, ty: 0 });
  const raf = useRef<number | null>(null);
  const animating = useRef(false);

  const [lod, setLod] = useState<Lod>('mid');
  const [zoomPct, setZoomPct] = useState(100);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0, vw: 1, vh: 1 });

  /** Keep at least this many px of the board visible inside the viewport. */
  const keepVisible = useCallback((): number => {
    const vp = viewportRef.current;
    if (!vp) return 120;
    return clamp(Math.min(vp.clientWidth, vp.clientHeight) * 0.35, 80, 260);
  }, []);

  const clampCam = useCallback(
    (c: Cam): Cam => {
      const vp = viewportRef.current;
      if (!vp) return c;
      const vw = vp.clientWidth;
      const vh = vp.clientHeight;
      const cw = BOARD_W * c.scale;
      const ch = BOARD_H * c.scale;
      const m = keepVisible();
      return {
        scale: c.scale,
        tx: clamp(c.tx, m - cw, vw - m),
        ty: clamp(c.ty, m - ch, vh - m),
      };
    },
    [keepVisible],
  );

  const applyNow = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const c = cam.current;
    el.style.transform = `translate3d(${c.tx}px, ${c.ty}px, 0) scale(${c.scale})`;
  }, []);

  const settle = useCallback((c: Cam) => {
    const pct = Math.round(c.scale * 100);
    setZoomPct((prev) => (prev === pct ? prev : pct));
    const next = lodFor(c.scale);
    setLod((prev) => (prev === next ? prev : next));
    const vp = viewportRef.current;
    setView({
      scale: c.scale,
      tx: c.tx,
      ty: c.ty,
      vw: vp?.clientWidth ?? 1,
      vh: vp?.clientHeight ?? 1,
    });
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } catch {
      /* sessionStorage may be unavailable; persistence is best-effort. */
    }
  }, []);

  /** Ease the live camera toward the target; stops when close enough. */
  const tick = useCallback(() => {
    const c = cam.current;
    const tg = target.current;
    const ds = tg.scale - c.scale;
    const dx = tg.tx - c.tx;
    const dy = tg.ty - c.ty;
    if (Math.abs(ds) < 0.001 && Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4) {
      cam.current = { ...tg };
      applyNow();
      animating.current = false;
      raf.current = null;
      settle(cam.current);
      return;
    }
    cam.current = {
      scale: c.scale + ds * 0.28,
      tx: c.tx + dx * 0.28,
      ty: c.ty + dy * 0.28,
    };
    applyNow();
    // Update LOD live (cheap; only re-renders when the bucket actually changes).
    const next = lodFor(cam.current.scale);
    setLod((prev) => (prev === next ? prev : next));
    raf.current = requestAnimationFrame(tick);
  }, [applyNow, settle]);

  const startAnim = useCallback(() => {
    if (animating.current) return;
    animating.current = true;
    raf.current = requestAnimationFrame(tick);
  }, [tick]);

  const setTarget = useCallback(
    (c: Cam) => {
      target.current = clampCam(c);
      startAnim();
    },
    [clampCam, startAnim],
  );

  /** Set the camera immediately (used while dragging, where easing feels laggy). */
  const setImmediate = useCallback(
    (c: Cam) => {
      const cc = clampCam(c);
      cam.current = cc;
      target.current = cc;
      applyNow();
      const next = lodFor(cc.scale);
      setLod((prev) => (prev === next ? prev : next));
    },
    [applyNow, clampCam],
  );

  const fit = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const scale = clamp(Math.min(vw / BOARD_W, vh / BOARD_H) * 0.94, MIN_ZOOM, MAX_ZOOM);
    setTarget({
      scale,
      tx: (vw - BOARD_W * scale) / 2,
      ty: (vh - BOARD_H * scale) / 2,
    });
  }, [setTarget]);

  /** Zoom toward a viewport-relative point, keeping that world point fixed. */
  const zoomToPoint = useCallback(
    (factor: number, px: number, py: number, immediate = false) => {
      const base = immediate ? cam.current : target.current;
      const scale = clamp(base.scale * factor, MIN_ZOOM, MAX_ZOOM);
      const k = scale / base.scale;
      const tx = px - (px - base.tx) * k;
      const ty = py - (py - base.ty) * k;
      if (immediate) setImmediate({ scale, tx, ty });
      else setTarget({ scale, tx, ty });
    },
    [setImmediate, setTarget],
  );

  const zoomCentered = useCallback(
    (factor: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      zoomToPoint(factor, vp.clientWidth / 2, vp.clientHeight / 2);
    },
    [zoomToPoint],
  );

  // ---- Pointer / wheel / touch / keyboard wiring -------------------------
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    // Restore a persisted view, otherwise fit-to-screen on load.
    let restored = false;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as Cam;
        if (typeof c.scale === 'number') {
          setImmediate(c);
          restored = true;
        }
      }
    } catch {
      /* ignore */
    }
    if (!restored) fit();

    const rect = (): DOMRect => vp.getBoundingClientRect();

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const r = rect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      // Trackpad two-finger pan (ctrlKey === false, deltaMode pixels): pan.
      if (!e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        setImmediate({
          scale: cam.current.scale,
          tx: cam.current.tx - e.deltaX,
          ty: cam.current.ty - e.deltaY,
        });
        return;
      }
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomToPoint(factor, px, py);
    };

    // Drag-to-pan (left or middle button) + pinch (two pointers).
    const pointers = new Map<number, { x: number; y: number }>();
    let dragging = false;
    let last = { x: 0, y: 0 };
    let pinchDist = 0;
    let pinchMid = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 0 && e.button !== 1) return;
      const r = rect();
      pointers.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
      vp.setPointerCapture(e.pointerId);
      if (pointers.size === 1) {
        dragging = true;
        last = { x: e.clientX, y: e.clientY };
        vp.style.cursor = 'grabbing';
      } else if (pointers.size === 2) {
        dragging = false;
        const pts = [...pointers.values()];
        pinchDist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        pinchMid = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
      }
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (!pointers.has(e.pointerId)) return;
      const r = rect();
      pointers.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
      if (pointers.size >= 2) {
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        const mid = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
        if (pinchDist > 0) {
          zoomToPoint(dist / pinchDist, mid.x, mid.y, true);
          // Pan with the moving midpoint.
          setImmediate({
            scale: cam.current.scale,
            tx: cam.current.tx + (mid.x - pinchMid.x),
            ty: cam.current.ty + (mid.y - pinchMid.y),
          });
        }
        pinchDist = dist;
        pinchMid = mid;
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      setImmediate({ scale: cam.current.scale, tx: cam.current.tx + dx, ty: cam.current.ty + dy });
    };

    const endPointer = (e: PointerEvent): void => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 0) {
        dragging = false;
        vp.style.cursor = 'grab';
        settle(cam.current);
      }
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const step = 80;
      switch (e.key) {
        case 'ArrowLeft':
          setTarget({ ...target.current, tx: target.current.tx + step });
          break;
        case 'ArrowRight':
          setTarget({ ...target.current, tx: target.current.tx - step });
          break;
        case 'ArrowUp':
          setTarget({ ...target.current, ty: target.current.ty + step });
          break;
        case 'ArrowDown':
          setTarget({ ...target.current, ty: target.current.ty - step });
          break;
        case '+':
        case '=':
          zoomCentered(1.2);
          break;
        case '-':
        case '_':
          zoomCentered(1 / 1.2);
          break;
        case '0':
          fit();
          break;
        default:
          return;
      }
    };

    vp.style.cursor = 'grab';
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('pointerdown', onPointerDown);
    vp.addEventListener('pointermove', onPointerMove);
    vp.addEventListener('pointerup', endPointer);
    vp.addEventListener('pointercancel', endPointer);
    vp.addEventListener('keydown', onKeyDown);

    const onResize = (): void => setImmediate(cam.current);
    window.addEventListener('resize', onResize);

    return () => {
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('pointerdown', onPointerDown);
      vp.removeEventListener('pointermove', onPointerMove);
      vp.removeEventListener('pointerup', endPointer);
      vp.removeEventListener('pointercancel', endPointer);
      vp.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    viewportRef,
    contentRef,
    lod,
    zoomPct,
    view,
    zoomIn: () => zoomCentered(1.25),
    zoomOut: () => zoomCentered(1 / 1.25),
    fit,
  };
}
