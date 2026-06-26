import { useTranslation } from 'react-i18next';
import type { GameState } from '../../../core/model/state.ts';
import { LINK_LINES, TOWN_BY_ID, MERCHANT_BY_ID } from '../../../core/data/board.ts';
import { LOCATION_XY, BOARD_W, BOARD_H } from './layout.ts';
import { PLAYER_CSS_VAR } from '../ui.tsx';

const LINE_BY_ID = Object.fromEntries(LINK_LINES.map((l) => [l.id, l]));

const BAND_COLOR: Record<string, string> = {
  blue: '#3b6ea5',
  teal: '#2f8f8f',
  red: '#a5483b',
  yellow: '#b7951f',
  green: '#4f8a3d',
  farm: '#7a6a44',
  merchant: '#6a4f8a',
};

/**
 * SVG board: water background, link lines (placed + buildable), location nodes
 * coloured by banner, merchant posts, and the industry tiles built on each
 * location. Highlights show legal placement targets for the current action.
 */
export function BoardSvg(props: {
  game: GameState;
  highlightLocations?: Set<string>;
  highlightLines?: Set<string>;
  onLocationClick?: (id: string) => void;
  onLineClick?: (id: string) => void;
}): JSX.Element {
  const { game, highlightLocations, highlightLines, onLocationClick, onLineClick } = props;
  const { t } = useTranslation();

  return (
    <svg
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--board-water)',
        borderRadius: 'var(--radius)',
      }}
      role="img"
      aria-label="Game board"
    >
      {/* Link lines */}
      {LINK_LINES.map((line) => {
        const a = LOCATION_XY[line.a];
        const b = LOCATION_XY[line.b];
        if (!a || !b) return null;
        const placed = game.links.find((l) => l.lineId === line.id);
        const highlighted = highlightLines?.has(line.id);
        return (
          <line
            key={line.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={
              placed
                ? PLAYER_CSS_VAR[placed.owner]
                : highlighted
                  ? 'var(--accent)'
                  : 'rgba(255,255,255,0.18)'
            }
            strokeWidth={placed ? 7 : highlighted ? 6 : 3}
            strokeDasharray={placed ? undefined : '6 6'}
            style={{ cursor: highlighted ? 'pointer' : 'default' }}
            onClick={() => highlighted && onLineClick?.(line.id)}
          />
        );
      })}

      {/* Town nodes */}
      {Object.values(TOWN_BY_ID).map((loc) => {
        const xy = LOCATION_XY[loc.id];
        if (!xy) return null;
        const tiles = game.tiles.filter((tl) => tl.locationId === loc.id);
        const highlighted = highlightLocations?.has(loc.id);
        return (
          <g
            key={loc.id}
            transform={`translate(${xy.x},${xy.y})`}
            style={{ cursor: highlighted ? 'pointer' : 'default' }}
            onClick={() => highlighted && onLocationClick?.(loc.id)}
          >
            <rect
              x={-34}
              y={-20}
              width={68}
              height={40}
              rx={6}
              fill={BAND_COLOR[loc.colorBand] ?? '#555'}
              stroke={highlighted ? 'var(--accent)' : 'rgba(0,0,0,0.4)'}
              strokeWidth={highlighted ? 3 : 1}
              opacity={0.92}
            />
            <text x={0} y={-24} textAnchor="middle" fontSize={12} fill="var(--text)">
              {t(loc.name)}
            </text>
            {/* built tiles */}
            {tiles.map((tile, i) => (
              <g key={tile.id} transform={`translate(${-26 + i * 18},0)`}>
                <rect
                  x={-8}
                  y={-8}
                  width={16}
                  height={16}
                  rx={3}
                  fill={PLAYER_CSS_VAR[tile.owner]}
                  stroke={tile.flipped ? '#fff' : 'rgba(0,0,0,0.5)'}
                  strokeWidth={tile.flipped ? 2 : 1}
                />
                <text x={0} y={4} textAnchor="middle" fontSize={9} fill="#fff">
                  {tile.industry[0]!.toUpperCase()}
                  {tile.level}
                </text>
              </g>
            ))}
          </g>
        );
      })}

      {/* Merchant posts */}
      {Object.values(MERCHANT_BY_ID).map((m) => {
        const xy = LOCATION_XY[m.id];
        if (!xy) return null;
        const beer = game.merchants.some((mm) => mm.locationId === m.id && mm.hasBeer);
        return (
          <g key={m.id} transform={`translate(${xy.x},${xy.y})`}>
            <circle r={22} fill={BAND_COLOR.merchant} stroke="rgba(0,0,0,0.4)" />
            <text x={0} y={-26} textAnchor="middle" fontSize={11} fill="var(--text)">
              {t(m.name)}
            </text>
            <text x={0} y={4} textAnchor="middle" fontSize={9} fill="#fff">
              {m.bonus}
            </text>
            {beer && <circle cx={16} cy={-16} r={5} fill="var(--beer)" stroke="#000" />}
          </g>
        );
      })}
    </svg>
  );
}
