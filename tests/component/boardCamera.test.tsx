import { StrictMode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { BoardCamera } from '../../src/app/components/board/BoardCamera.tsx';
import { initI18n } from '../../src/app/i18n/index.ts';

initI18n('en');

/**
 * Regression coverage for the board-camera zoom bugfix (MYSpolly.md §7.11,
 * tasks 3R.Z1–3R.Z4). The camera eases its transform via requestAnimationFrame
 * and keeps the live transform on the content element's inline `style`. These
 * tests drive a deterministic rAF queue, then read the resulting `scale(...)`
 * from the transformed content layer to confirm that wheel-up, wheel-down, the
 * on-screen `+`/`−` buttons, and Reset/Fit each move the zoom as expected.
 */

// --- Deterministic requestAnimationFrame harness ---------------------------
let nextRafId = 1;
let rafQueue = new Map<number, FrameRequestCallback>();

/** Drain the rAF queue until the easing loop settles (or a safety cap hits). */
function flushFrames(max = 5000): void {
  let n = 0;
  while (rafQueue.size > 0 && n++ < max) {
    const first = rafQueue.entries().next().value as
      | [number, FrameRequestCallback]
      | undefined;
    if (!first) break;
    const [id, cb] = first;
    rafQueue.delete(id);
    cb(Date.now());
  }
}

function getContentEl(container: HTMLElement): HTMLElement {
  const el = Array.from(container.querySelectorAll('div')).find(
    (d) => (d as HTMLElement).style.willChange === 'transform',
  );
  if (!el) throw new Error('camera content layer not found');
  return el as HTMLElement;
}

function getScale(container: HTMLElement): number {
  const transform = getContentEl(container).style.transform;
  const m = /scale\(([-\d.]+)\)/.exec(transform);
  if (!m) throw new Error(`no scale in transform: "${transform}"`);
  return parseFloat(m[1]!);
}

function getViewport(container: HTMLElement): HTMLElement {
  const vp = container.querySelector('[tabindex="0"]');
  if (!vp) throw new Error('camera viewport not found');
  return vp as HTMLElement;
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === label,
  );
  if (!btn) throw new Error(`button "${label}" not found`);
  return btn as HTMLButtonElement;
}

function wheel(viewport: HTMLElement, deltaY: number): void {
  act(() => {
    viewport.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY,
        deltaX: 0,
        clientX: 400,
        clientY: 300,
        bubbles: true,
        cancelable: true,
      }),
    );
    flushFrames();
  });
}

function click(btn: HTMLButtonElement): void {
  act(() => {
    fireEvent.click(btn);
    flushFrames();
  });
}

let clientWidthSpy: PropertyDescriptor | undefined;
let clientHeightSpy: PropertyDescriptor | undefined;

beforeEach(() => {
  nextRafId = 1;
  rafQueue = new Map();
  // The camera persists its view to sessionStorage on settle; clear it so each
  // test starts from a deterministic fit-to-screen rather than a restored view.
  sessionStorage.clear();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    const id = nextRafId++;
    rafQueue.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    rafQueue.delete(id);
  });
  // jsdom reports 0 for client sizes; give the viewport a real size so the
  // initial fit-to-screen lands at a mid-range zoom with room to move both ways.
  clientWidthSpy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  clientHeightSpy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (clientWidthSpy) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidthSpy);
  else Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
  if (clientHeightSpy) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeightSpy);
  else Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
});

describe('BoardCamera zoom', () => {
  it('wheel-up zooms in and wheel-down zooms out (3R.Z1)', () => {
    const { container } = render(<BoardCamera>{() => <div data-testid="b" />}</BoardCamera>);
    act(() => flushFrames()); // settle initial fit-to-screen
    const vp = getViewport(container);

    const start = getScale(container);
    // Wheel up (negative deltaY) => zoom IN.
    wheel(vp, -120);
    const zoomedIn = getScale(container);
    expect(zoomedIn).toBeGreaterThan(start);

    // Wheel down (positive deltaY) => zoom OUT.
    wheel(vp, 120);
    const zoomedOut = getScale(container);
    expect(zoomedOut).toBeLessThan(zoomedIn);
  });

  it('the on-screen + and − buttons zoom in and out (3R.Z2)', () => {
    const { container } = render(<BoardCamera>{() => <div data-testid="b" />}</BoardCamera>);
    act(() => flushFrames());

    const start = getScale(container);
    click(findButton(container, '+'));
    const afterPlus = getScale(container);
    expect(afterPlus).toBeGreaterThan(start);

    click(findButton(container, '−'));
    const afterMinus = getScale(container);
    expect(afterMinus).toBeLessThan(afterPlus);
  });

  it('keeps zoom clamped and Reset/Fit returns to the default view (3R.Z3)', () => {
    const { container } = render(<BoardCamera>{() => <div data-testid="b" />}</BoardCamera>);
    act(() => flushFrames());
    const fitScale = getScale(container);
    const vp = getViewport(container);

    // Hammer zoom-in well past the max; scale must never exceed MAX_ZOOM (3.2).
    for (let i = 0; i < 40; i++) wheel(vp, -300);
    expect(getScale(container)).toBeLessThanOrEqual(3.2 + 1e-6);

    // Hammer zoom-out well past the min; scale must never drop below MIN_ZOOM (0.4).
    for (let i = 0; i < 40; i++) wheel(vp, 300);
    expect(getScale(container)).toBeGreaterThanOrEqual(0.4 - 1e-6);

    // Reset / Fit-to-screen returns to the computed default view.
    click(findButton(container, '⤢'));
    expect(getScale(container)).toBeCloseTo(fitScale, 5);
  });

  it('zoom still works after a StrictMode re-mount (the original regression)', () => {
    // React.StrictMode double-invokes the mount effect with a cleanup between.
    // The bug left the rAF scheduler deadlocked so wheel/buttons silently did
    // nothing. This guards that the easing loop recovers after the re-mount.
    const { container } = render(
      <StrictMode>
        <BoardCamera>{() => <div data-testid="b" />}</BoardCamera>
      </StrictMode>,
    );
    act(() => flushFrames());
    const vp = getViewport(container);

    const start = getScale(container);
    wheel(vp, -150);
    const zoomedIn = getScale(container);
    expect(zoomedIn).toBeGreaterThan(start);

    click(findButton(container, '−'));
    expect(getScale(container)).toBeLessThan(zoomedIn);
  });
});
