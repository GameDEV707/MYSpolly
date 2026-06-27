import { useTranslation } from 'react-i18next';
import type { MarketTrack } from '../../../core/model/state.ts';
import { Panel } from '../ui.tsx';
import { HelpButton } from '../help/HelpButton.tsx';

function MarketColumn(props: { title: string; market: MarketTrack; color: string }): JSX.Element {
  const { market, title, color } = props;
  const { t } = useTranslation();
  // Cubes occupy the priciest (top) spaces; empties are the cheapest (bottom).
  const filledFrom = market.capacity - market.cubes;
  return (
    <div style={{ textAlign: 'center' }} title={t('help.market')}>
      <div style={{ fontSize: 13, marginBottom: 4 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 2 }}>
        {market.priceLadder.map((price, i) => {
          const filled = i >= filledFrom;
          return (
            <div
              key={i}
              title={`£${price}`}
              style={{
                width: 26,
                height: 14,
                borderRadius: 3,
                border: '1px solid var(--border)',
                background: filled ? color : 'transparent',
                fontSize: 9,
                color: filled ? '#fff' : 'var(--text-muted)',
                lineHeight: '14px',
              }}
            >
              {price}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
        {market.cubes} left
      </div>
    </div>
  );
}

/** Coal & Iron market panels with the price ladder + remaining cubes. */
export function Markets(props: { coal: MarketTrack; iron: MarketTrack }): JSX.Element {
  const { t } = useTranslation();
  return (
    <Panel
      style={{
        display: 'flex',
        gap: 'var(--space-4)',
        justifyContent: 'space-around',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 8, right: 8 }}>
        <HelpButton topic="markets" from="game" />
      </div>
      <MarketColumn title={t('game.coalMarket')} market={props.coal} color="var(--coal)" />
      <MarketColumn title={t('game.ironMarket')} market={props.iron} color="var(--iron)" />
    </Panel>
  );
}
