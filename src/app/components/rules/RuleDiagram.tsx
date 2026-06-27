import type { CSSProperties, ReactNode } from 'react';
import type { DiagramId } from '../../data/rules.ts';
import { INDUSTRY_ICON, RESOURCE_ICON } from '../board/icons.ts';

/**
 * Lightweight, language-neutral diagrams that illustrate the rules pages
 * (§7.14.1 / 3T.4). They reuse the board icon set so the explanations match the
 * map. All wording lives in the caption rendered by the page, so the diagrams
 * themselves need no translation.
 */

const wrap: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: '14px 12px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: 15,
};

function Node(props: { label: string; color?: string; sub?: string }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '8px 12px',
        borderRadius: 8,
        border: `2px solid ${props.color ?? 'var(--border)'}`,
        background: 'var(--bg-panel)',
        minWidth: 70,
      }}
    >
      <span style={{ fontWeight: 700 }}>{props.label}</span>
      {props.sub && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{props.sub}</span>}
    </div>
  );
}

function Arrow({ glyph = '→' }: { glyph?: string }): JSX.Element {
  return <span style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 700 }}>{glyph}</span>;
}

function Chip(props: { children: ReactNode; color?: string }): JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 999,
        background: 'var(--bg-panel)',
        border: `1px solid ${props.color ?? 'var(--border)'}`,
      }}
    >
      {props.children}
    </span>
  );
}

export function RuleDiagram({ id }: { id: DiagramId }): JSX.Element {
  switch (id) {
    case 'connection':
      return (
        <div style={wrap}>
          <Node label="🏭" sub="A" color="var(--player-blue)" />
          <span style={{ letterSpacing: 2, color: 'var(--accent)' }}>━━━</span>
          <Node label="🏪" sub="B" />
          <span style={{ letterSpacing: 2, color: 'var(--text-muted)' }}>┈┈┈</span>
          <Node label="🏭" sub="C" color="var(--player-red)" />
        </div>
      );
    case 'turnFlow':
      return (
        <div style={wrap}>
          <Chip>1️⃣ 🎴</Chip>
          <Arrow />
          <Chip>2️⃣ 🎴</Chip>
          <Arrow />
          <Chip color="var(--accent)">🔁 8</Chip>
        </div>
      );
    case 'marketTrack':
      return (
        <div style={wrap}>
          <Chip color={RESOURCE_ICON.coal.color}>
            {RESOURCE_ICON.coal.glyph}
            {RESOURCE_ICON.coal.glyph}
            {RESOURCE_ICON.coal.glyph}
          </Chip>
          <Arrow glyph="⇄" />
          <Chip color={RESOURCE_ICON.money.color}>£1 £2 £3 £4 £5 £6 £7 £8</Chip>
        </div>
      );
    case 'tileFlip':
      return (
        <div style={wrap}>
          <Node label="🏭" sub="●●" color="var(--player-green)" />
          <Arrow glyph="⤳" />
          <Node label="⭐" sub="↑📈" color="var(--accent)" />
        </div>
      );
    case 'sellChain':
      return (
        <div style={wrap}>
          <Node label={INDUSTRY_ICON.cotton.glyph} sub="🧵" color={INDUSTRY_ICON.cotton.color} />
          <span style={{ letterSpacing: 2, color: 'var(--accent)' }}>━━</span>
          <Chip color={RESOURCE_ICON.juice.color}>{RESOURCE_ICON.juice.glyph}</Chip>
          <Arrow />
          <Node label="🏪" sub="✓" color="var(--player-yellow)" />
        </div>
      );
    case 'incomeTrack':
      return (
        <div style={wrap}>
          <Chip>📈 0</Chip>
          <Arrow />
          <Chip>📈 +1</Chip>
          <Arrow />
          <Chip color={RESOURCE_ICON.money.color}>£ {RESOURCE_ICON.money.glyph}</Chip>
        </div>
      );
    case 'eraTimeline':
      return (
        <div style={wrap}>
          <Node label="🚣 Canal" sub="1770–1830" color="var(--board-water)" />
          <Arrow />
          <Node label="🚂 Rail" sub="1830–1870" color="var(--iron)" />
        </div>
      );
    default:
      return <div style={wrap}>—</div>;
  }
}
