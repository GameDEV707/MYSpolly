import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BOARD_W, BOARD_H } from './layout.ts';
import { useBoardCamera, type Lod } from './useBoardCamera.ts';

/**
 * Viewport wrapper that makes the board a fully interactive camera (§7.11):
 * mouse-wheel zoom-to-cursor, drag pan, pinch/trackpad, clamped bounds, on-screen
 * zoom + fit controls, keyboard, and an optional mini-map. The board (passed as a
 * render child receiving the current level-of-detail) is rendered inside a
 * GPU-transformed layer, so navigation never re-renders React per frame.
 */
export function BoardCamera(props: { children: (lod: Lod) => ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const cam = useBoardCamera();

  // Mini-map geometry (settled, not per-frame): show the board + a viewport box.
  const miniW = 132;
  const miniH = Math.round((miniW * BOARD_H) / BOARD_W);
  const k = miniW / BOARD_W;
  const { scale, tx, ty, vw, vh } = cam.view;
  const boxX = Math.max(0, (-tx / scale) * k);
  const boxY = Math.max(0, (-ty / scale) * k);
  const boxW = Math.min(miniW, (vw / scale) * k);
  const boxH = Math.min(miniH, (vh / scale) * k);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background: 'var(--board-water)',
        touchAction: 'none',
      }}
    >
      <div
        ref={cam.viewportRef}
        tabIndex={0}
        aria-label={t('board.cameraHint')}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          outline: 'none',
          touchAction: 'none',
        }}
      >
        <div
          ref={cam.contentRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: BOARD_W,
            height: BOARD_H,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          {props.children(cam.lod)}
        </div>
      </div>

      {/* On-screen controls (zoom in/out + fit). */}
      <div
        style={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          zIndex: 5,
        }}
      >
        <CamButton label="+" title={t('board.zoomIn')} onClick={cam.zoomIn} />
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '2px 0',
          }}
        >
          {cam.zoomPct}%
        </div>
        <CamButton label="−" title={t('board.zoomOut')} onClick={cam.zoomOut} />
        <CamButton label="⤢" title={t('board.fit')} onClick={cam.fit} />
      </div>

      {/* Mini-map. */}
      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          width: miniW,
          height: miniH,
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'color-mix(in srgb, var(--board-water) 70%, #000)',
          zIndex: 5,
          overflow: 'hidden',
          opacity: 0.9,
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        <div
          style={{
            position: 'absolute',
            left: Math.max(0, Math.min(miniW - boxW, boxX)),
            top: Math.max(0, Math.min(miniH - boxH, boxY)),
            width: boxW,
            height: boxH,
            border: '1.5px solid var(--accent)',
            borderRadius: 2,
            background: 'rgba(255,255,255,0.08)',
          }}
        />
      </div>
    </div>
  );
}

function CamButton(props: { label: string; title: string; onClick: () => void }): JSX.Element {
  return (
    <button
      title={props.title}
      aria-label={props.title}
      onClick={props.onClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg-panel)',
        color: 'var(--text)',
        fontSize: 18,
        lineHeight: '1',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {props.label}
    </button>
  );
}
