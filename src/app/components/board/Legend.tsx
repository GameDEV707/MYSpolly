import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INDUSTRY_TYPES } from '../../../core/model/types.ts';
import { INDUSTRY_ICON, RESOURCE_ICON, MERCHANT_BONUS_ICON } from './icons.ts';

/**
 * Always-available map key (§7.16). A toggle button opens a localized legend
 * explaining every glyph: industries, resources (coal/iron/juice/VP/£/income),
 * canal vs rail links, merchant bonuses, built tiles, build slots, and the
 * special Farm Juice spaces.
 */
function Row(props: { glyph: string; color?: string; label: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span
        style={{
          width: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          background: props.color ?? 'transparent',
          fontSize: 13,
          flex: '0 0 auto',
        }}
      >
        {props.glyph}
      </span>
      <span>{props.label}</span>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          letterSpacing: 0.5,
        }}
      >
        {props.title}
      </div>
      {props.children}
    </div>
  );
}

export function Legend(): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 6 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-panel)',
          color: 'var(--text)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        🗝 {t('board.legend')}
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            width: 250,
            maxHeight: '70vh',
            overflow: 'auto',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{t('legend.title')}</strong>
            <button
              onClick={() => setOpen(false)}
              aria-label={t('board.close')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              ✕
            </button>
          </div>

          <Section title={t('legend.industries')}>
            {INDUSTRY_TYPES.map((i) => (
              <Row
                key={i}
                glyph={INDUSTRY_ICON[i].glyph}
                color={INDUSTRY_ICON[i].color}
                label={t(`industry.${i}`)}
              />
            ))}
          </Section>

          <Section title={t('legend.resources')}>
            {(['coal', 'iron', 'juice', 'vp', 'money', 'income'] as const).map((k) => (
              <Row
                key={k}
                glyph={RESOURCE_ICON[k].glyph}
                color={RESOURCE_ICON[k].color}
                label={t(RESOURCE_ICON[k].labelKey)}
              />
            ))}
          </Section>

          <Section title={t('legend.links')}>
            <Row glyph="┈" label={t('legend.canal')} />
            <Row glyph="━" label={t('legend.rail')} />
            <Row glyph="✦" label={t('legend.specialLink')} />
          </Section>

          <Section title={t('legend.merchantBonuses')}>
            {(['develop', 'income', 'vp', 'money'] as const).map((b) => (
              <Row
                key={b}
                glyph={MERCHANT_BONUS_ICON[b].glyph}
                color={MERCHANT_BONUS_ICON[b].color}
                label={t(MERCHANT_BONUS_ICON[b].labelKey)}
              />
            ))}
          </Section>

          <Section title={t('legend.title')}>
            <Row glyph="■" color="var(--player-blue)" label={t('legend.builtTile')} />
            <Row glyph="★" color="#ffe08a" label={t('legend.flipped')} />
            <Row glyph="▢" label={t('legend.buildSlot')} />
            <Row glyph="🧃" color="#7a6a44" label={t('legend.farmJuice')} />
          </Section>
        </div>
      )}
    </div>
  );
}
