import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { GameState, PlacedTile } from '../../../core/model/state.ts';
import type { IndustryType } from '../../../core/model/types.ts';
import { LINK_LINES, TOWN_BY_ID, MERCHANT_BY_ID } from '../../../core/data/board.ts';
import { playerNetwork } from '../../../core/selectors/connectivity.ts';
import { LOCATION_XY, BOARD_W, BOARD_H } from './layout.ts';
import { INDUSTRY_ICON, MERCHANT_BONUS_ICON, BAND_COLOR } from './icons.ts';
import { PLAYER_CSS_VAR } from '../ui.tsx';
import type { Lod } from './useBoardCamera.ts';

const LINE_BY_ID = Object.fromEntries(LINK_LINES.map((l) => [l.id, l]));

/** Unique allowed industries across a location's slots. */
function buildableIndustries(slots: { allowed: IndustryType[] }[]): IndustryType[] {
  const set = new Set<IndustryType>();
  for (const s of slots) for (const a of s.allowed) set.add(a);
  return [...set];
}

function tileTooltip(t: TFunction, tile: PlacedTile): string {
  const ind = t(`industry.${tile.industry}`);
  const owner = t(`color.${tile.owner}`);
  const lvl = `L${tile.level}`;
  const state = tile.flipped ? ` (${t('legend.flipped')})` : '';
  return `${owner} · ${ind} ${lvl}${state}`;
}

/**
 * SVG board (§7.12). Renders the water, canal/rail link lines (built, buildable,
 * neutral), self-explanatory location nodes (region band, name, build slots with
 * industry icons, built tiles with owner/level/cubes/flip), and merchants
 * (accepted goods, bonus icon, juice barrel). Level-of-detail (`lod`) controls
 * density; valid targets glow and, while an action is targeting, invalid ones dim.
 */
export function BoardSvg(props: {
  game: GameState;
  lod?: Lod;
  highlightLocations?: Set<string>;
  highlightLines?: Set<string>;
  dimUnhighlighted?: boolean;
  showTooltips?: boolean;
  onLocationClick?: (id: string) => void;
  onLineClick?: (id: string) => void;
}): JSX.Element {
  const {
    game,
    lod = 'high',
    highlightLocations,
    highlightLines,
    dimUnhighlighted,
    showTooltips = true,
    onLocationClick,
    onLineClick,
  } = props;
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<string | null>(null);

  const network = useMemo(
    () => playerNetwork(game, game.activePlayer),
    [game.tiles, game.links, game.activePlayer],
  );

  const showSlots = lod !== 'low';
  const showDetail = lod === 'high';

  return (
    <svg
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      style={{ width: '100%', height: '100%', background: 'transparent', display: 'block' }}
      role="img"
      aria-label="Game board"
    >
      <defs>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="var(--accent)" />
        </filter>
      </defs>

      {/* Link lines (canal vs rail visually distinct). */}
      <g>
        {LINK_LINES.map((line) => {
          const a = LOCATION_XY[line.a];
          const b = LOCATION_XY[line.b];
          if (!a || !b) return null;
          const placed = game.links.find((l) => l.lineId === line.id);
          const highlighted = highlightLines?.has(line.id) ?? false;
          const dim = dimUnhighlighted && !highlighted && !placed;
          const canalOnly = line.types.length === 1 && line.types[0] === 'canal';
          const railOnly = line.types.length === 1 && line.types[0] === 'rail';
          const isCanal = placed ? placed.type === 'canal' : canalOnly;

          const stroke = placed
            ? PLAYER_CSS_VAR[placed.owner]
            : highlighted
              ? 'var(--accent)'
              : canalOnly
                ? 'rgba(120,170,210,0.4)'
                : railOnly
                  ? 'rgba(200,150,110,0.4)'
                  : 'rgba(255,255,255,0.18)';
          const width = placed ? 7 : highlighted ? 6 : 3;
          // Canal = dotted (water), rail = solid with light "tie" overlay.
          const dash = isCanal ? '1 10' : highlighted ? '10 8' : undefined;

          return (
            <g key={line.id} style={{ opacity: dim ? 0.25 : 1 }}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={stroke}
                strokeWidth={width}
                strokeLinecap="round"
                strokeDasharray={dash}
                style={{ cursor: highlighted ? 'pointer' : 'default' }}
                onClick={() => highlighted && onLineClick?.(line.id)}
              >
                {showTooltips && (
                  <title>
                    {`${t(TOWN_BY_ID[line.a]?.name ?? MERCHANT_BY_ID[line.a]?.name ?? line.a)} ↔ ${t(
                      TOWN_BY_ID[line.b]?.name ?? MERCHANT_BY_ID[line.b]?.name ?? line.b,
                    )} · ${isCanal ? t('legend.canal') : t('legend.rail')}`}
                  </title>
                )}
              </line>
              {/* Rail "ties": a light dashed overlay so rail reads differently to canal. */}
              {placed && !isCanal && (
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth={2}
                  strokeDasharray="3 9"
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
      </g>

      {/* Town nodes. */}
      {Object.values(TOWN_BY_ID).map((loc) => {
        const xy = LOCATION_XY[loc.id];
        if (!xy) return null;
        const tiles = game.tiles.filter((tl) => tl.locationId === loc.id);
        const highlighted = highlightLocations?.has(loc.id) ?? false;
        const inNetwork = network.has(loc.id);
        const dim = dimUnhighlighted && !highlighted;
        const isHover = hovered === loc.id;

        const n = loc.slots.length;
        const cell = 22;
        const gap = 4;
        const pad = 8;
        const w = showSlots ? Math.max(78, pad * 2 + n * cell + (n - 1) * gap) : 80;
        const h = showSlots ? 60 : 26;
        const allowed = buildableIndustries(loc.slots);

        const tooltip = showTooltips
          ? [
              t(loc.name),
              `${t('board.buildSlots')}: ${allowed.map((i) => t(`industry.${i}`)).join(', ')}`,
              tiles.length
                ? `${t('board.tilesHere')}: ${tiles.map((tl) => tileTooltip(t, tl)).join('; ')}`
                : t('board.noTiles'),
              inNetwork ? t('board.inNetwork') : t('board.notInNetwork'),
            ].join('\n')
          : undefined;

        return (
          <g
            key={loc.id}
            transform={`translate(${xy.x},${xy.y})`}
            style={{ cursor: highlighted ? 'pointer' : 'default', opacity: dim ? 0.32 : 1 }}
            onClick={() => highlighted && onLocationClick?.(loc.id)}
            onMouseEnter={() => setHovered(loc.id)}
            onMouseLeave={() => setHovered((c) => (c === loc.id ? null : c))}
          >
            {tooltip && <title>{tooltip}</title>}
            <rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              rx={8}
              fill="var(--bg-panel, #1c1a17)"
              stroke={highlighted ? 'var(--accent)' : isHover ? '#fff' : 'rgba(0,0,0,0.5)'}
              strokeWidth={highlighted ? 3 : isHover ? 2 : 1}
              filter={highlighted ? 'url(#glow)' : undefined}
            />
            {/* Region colour band. */}
            <rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={6}
              rx={3}
              fill={BAND_COLOR[loc.colorBand] ?? '#555'}
            />
            {inNetwork && (
              <circle cx={w / 2 - 7} cy={-h / 2 + 13} r={3.5} fill="var(--accent)">
                {showTooltips && <title>{t('board.inNetwork')}</title>}
              </circle>
            )}
            <text
              x={0}
              y={-h / 2 + (showSlots ? 17 : 17)}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="var(--text)"
            >
              {t(loc.name)}
            </text>

            {showSlots &&
              loc.slots.map((slot, si) => {
                const x0 = -w / 2 + pad + si * (cell + gap);
                const cy = h / 2 - pad - cell / 2;
                const tile = tiles.find((tl) => tl.slotId === slot.id);
                return (
                  <g key={slot.id} transform={`translate(${x0 + cell / 2},${cy})`}>
                    {tile ? (
                      <BuiltTile tile={tile} showDetail={showDetail} t={t} cell={cell} />
                    ) : (
                      <EmptySlot allowed={slot.allowed} showDetail={showDetail} cell={cell} />
                    )}
                  </g>
                );
              })}
          </g>
        );
      })}

      {/* Merchants. */}
      {Object.values(MERCHANT_BY_ID).map((m) => {
        const xy = LOCATION_XY[m.id];
        if (!xy) return null;
        const states = game.merchants.filter((mm) => mm.locationId === m.id);
        const anyJuice = states.some((mm) => mm.hasJuice);
        const accepts = [...new Set(states.flatMap((mm) => mm.accepts))];
        const bonus = MERCHANT_BONUS_ICON[m.bonus];
        const highlighted = highlightLocations?.has(m.id) ?? false;
        const dim = dimUnhighlighted && !highlighted;
        const isHover = hovered === m.id;

        const tooltip = showTooltips
          ? [
              t(m.name),
              accepts.length
                ? `${t('board.accepts')}: ${accepts.map((a) => t(`industry.${a}`)).join(', ')}`
                : '—',
              `${t('board.bonus')}: ${t(bonus.labelKey)}`,
              anyJuice ? t('board.merchantJuice') : '',
            ]
              .filter(Boolean)
              .join('\n')
          : undefined;

        return (
          <g
            key={m.id}
            transform={`translate(${xy.x},${xy.y})`}
            style={{ cursor: highlighted ? 'pointer' : 'default', opacity: dim ? 0.32 : 1 }}
            onClick={() => highlighted && onLocationClick?.(m.id)}
            onMouseEnter={() => setHovered(m.id)}
            onMouseLeave={() => setHovered((c) => (c === m.id ? null : c))}
          >
            {tooltip && <title>{tooltip}</title>}
            <circle
              r={24}
              fill={BAND_COLOR.merchant}
              stroke={highlighted ? 'var(--accent)' : isHover ? '#fff' : 'rgba(0,0,0,0.4)'}
              strokeWidth={highlighted ? 3 : isHover ? 2 : 1}
              filter={highlighted ? 'url(#glow)' : undefined}
            />
            <text
              x={0}
              y={-28}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="var(--text)"
            >
              {t(m.name)}
            </text>
            {/* Bonus type icon. */}
            <text x={0} y={-4} textAnchor="middle" fontSize={14}>
              {bonus.glyph}
            </text>
            {/* Accepted goods icons. */}
            {showSlots && (
              <text x={0} y={13} textAnchor="middle" fontSize={11}>
                {accepts.length ? accepts.map((a) => INDUSTRY_ICON[a].glyph).join('') : '—'}
              </text>
            )}
            {/* Merchant juice barrel. */}
            {anyJuice && (
              <g transform="translate(18,-16)">
                <circle r={7} fill="var(--juice, #e8943a)" stroke="#000" strokeWidth={1} />
                <text x={0} y={3} textAnchor="middle" fontSize={8}>
                  🧃
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** A built industry tile inside a slot: owner colour, level, cubes/juice, flip. */
function BuiltTile(props: {
  tile: PlacedTile;
  showDetail: boolean;
  t: TFunction;
  cell: number;
}): JSX.Element {
  const { tile, showDetail, cell } = props;
  const r = cell / 2;
  const meta = INDUSTRY_ICON[tile.industry];
  return (
    <g>
      <rect
        x={-r}
        y={-r}
        width={cell}
        height={cell}
        rx={4}
        fill={PLAYER_CSS_VAR[tile.owner]}
        stroke={tile.flipped ? '#ffe08a' : 'rgba(0,0,0,0.55)'}
        strokeWidth={tile.flipped ? 2.5 : 1}
      />
      <text x={0} y={showDetail ? -1 : 4} textAnchor="middle" fontSize={showDetail ? 10 : 12}>
        {meta.glyph}
      </text>
      {showDetail && (
        <text x={0} y={9} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">
          L{tile.level}
        </text>
      )}
      {/* Remaining cubes / juice badge. */}
      {tile.resourcesLeft > 0 && (
        <g transform={`translate(${r - 2},${-r + 2})`}>
          <circle r={6} fill="#111" stroke="#fff" strokeWidth={0.75} />
          <text x={0} y={3} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">
            {tile.resourcesLeft}
          </text>
        </g>
      )}
      {tile.flipped && (
        <text x={-r + 3} y={-r + 7} textAnchor="middle" fontSize={8}>
          ★
        </text>
      )}
    </g>
  );
}

/** An empty build slot showing which industries it allows. */
function EmptySlot(props: {
  allowed: IndustryType[];
  showDetail: boolean;
  cell: number;
}): JSX.Element {
  const { allowed, showDetail, cell } = props;
  const r = cell / 2;
  return (
    <g>
      <rect
        x={-r}
        y={-r}
        width={cell}
        height={cell}
        rx={4}
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={1}
        strokeDasharray="3 2"
      />
      {showDetail ? (
        <text x={0} y={4} textAnchor="middle" fontSize={allowed.length > 1 ? 8 : 12} opacity={0.85}>
          {allowed.map((a) => INDUSTRY_ICON[a].glyph).join('')}
        </text>
      ) : (
        <text x={0} y={4} textAnchor="middle" fontSize={11} opacity={0.6} fill="var(--text-muted)">
          {allowed.length}
        </text>
      )}
    </g>
  );
}
