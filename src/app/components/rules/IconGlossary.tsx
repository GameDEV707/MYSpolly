import { useTranslation } from 'react-i18next';
import { INDUSTRY_TYPES } from '../../../core/model/types.ts';
import { INDUSTRY_ICON, RESOURCE_ICON, MERCHANT_BONUS_ICON } from '../board/icons.ts';

/**
 * Full icon glossary / legend page (§7.14.1 / 3T.3). Reuses the board icon set
 * so every glyph on the map has a one-line, localized meaning here.
 */

interface Entry {
  glyph: string;
  color?: string;
  nameKey: string;
  meaningKey: string;
}

function Group(props: { title: string; entries: Entry[] }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: 'var(--text-muted)',
        }}
      >
        {props.title}
      </div>
      {props.entries.map((e) => (
        <div
          key={e.nameKey + e.meaningKey}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
        >
          <span
            aria-hidden
            style={{
              width: 26,
              height: 26,
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              background: e.color ?? 'var(--surface)',
              fontSize: 15,
            }}
          >
            {e.glyph}
          </span>
          <div style={{ fontSize: 13 }}>
            <strong>{t(e.nameKey)}</strong>
            <span style={{ color: 'var(--text-muted)' }}> — {t(e.meaningKey)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function IconGlossary(): JSX.Element {
  const { t } = useTranslation();

  const industries: Entry[] = INDUSTRY_TYPES.map((i) => ({
    glyph: INDUSTRY_ICON[i].glyph,
    color: INDUSTRY_ICON[i].color,
    nameKey: `industry.${i}`,
    meaningKey: `rulesLib.glossary.m.${i}`,
  }));

  const resources: Entry[] = [
    {
      glyph: RESOURCE_ICON.coal.glyph,
      color: RESOURCE_ICON.coal.color,
      nameKey: 'legend.coal',
      meaningKey: 'rulesLib.glossary.m.coalCube',
    },
    {
      glyph: RESOURCE_ICON.iron.glyph,
      color: RESOURCE_ICON.iron.color,
      nameKey: 'legend.iron',
      meaningKey: 'rulesLib.glossary.m.ironCube',
    },
    {
      glyph: RESOURCE_ICON.juice.glyph,
      color: RESOURCE_ICON.juice.color,
      nameKey: 'legend.juice',
      meaningKey: 'rulesLib.glossary.m.juice',
    },
    {
      glyph: RESOURCE_ICON.vp.glyph,
      color: RESOURCE_ICON.vp.color,
      nameKey: 'legend.vp',
      meaningKey: 'rulesLib.glossary.m.vp',
    },
    {
      glyph: RESOURCE_ICON.money.glyph,
      color: RESOURCE_ICON.money.color,
      nameKey: 'legend.money',
      meaningKey: 'rulesLib.glossary.m.money',
    },
    {
      glyph: RESOURCE_ICON.income.glyph,
      color: RESOURCE_ICON.income.color,
      nameKey: 'legend.income',
      meaningKey: 'rulesLib.glossary.m.income',
    },
  ];

  const links: Entry[] = [
    { glyph: '┈', nameKey: 'legend.canal', meaningKey: 'rulesLib.glossary.m.canal' },
    { glyph: '━', nameKey: 'legend.rail', meaningKey: 'rulesLib.glossary.m.rail' },
    { glyph: '✦', nameKey: 'legend.specialLink', meaningKey: 'rulesLib.glossary.m.special' },
  ];

  const tiles: Entry[] = [
    {
      glyph: '■',
      color: 'var(--player-blue)',
      nameKey: 'legend.builtTile',
      meaningKey: 'rulesLib.glossary.m.builtTile',
    },
    {
      glyph: '★',
      color: '#ffe08a',
      nameKey: 'legend.flipped',
      meaningKey: 'rulesLib.glossary.m.flipped',
    },
    { glyph: '▢', nameKey: 'legend.buildSlot', meaningKey: 'rulesLib.glossary.m.buildSlot' },
    {
      glyph: '🧃',
      color: '#7a6a44',
      nameKey: 'legend.farmJuice',
      meaningKey: 'rulesLib.glossary.m.farmJuice',
    },
  ];

  const bonuses: Entry[] = (['develop', 'income', 'vp', 'money'] as const).map((b) => ({
    glyph: MERCHANT_BONUS_ICON[b].glyph,
    color: MERCHANT_BONUS_ICON[b].color,
    nameKey: MERCHANT_BONUS_ICON[b].labelKey,
    meaningKey: `rulesLib.glossary.m.bonus_${b}`,
  }));

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 18,
      }}
    >
      <Group title={t('legend.industries')} entries={industries} />
      <Group title={t('legend.resources')} entries={resources} />
      <Group title={t('legend.links')} entries={links} />
      <Group title={t('legend.title')} entries={tiles} />
      <Group title={t('legend.merchantBonuses')} entries={bonuses} />
    </div>
  );
}
