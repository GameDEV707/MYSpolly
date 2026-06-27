import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { GameState } from '../../../core/model/state.ts';
import type { Action, ActionType } from '../../../core/model/actions.ts';
import { legalActions } from '../../../core/selectors/legalActions.ts';
import { boardContext } from '../../../core/maps/context.ts';
import { Panel } from '../ui.tsx';
import { HelpButton } from '../help/HelpButton.tsx';
import { useSettings } from '../../store/settings.ts';
import { INDUSTRY_ICON, MERCHANT_BONUS_ICON, RESOURCE_ICON } from '../board/icons.ts';
import { locName, lineName } from '../board/names.ts';
import { cardLabel, cardKindLabel } from '../cards/cardText.ts';
import { useFlow } from './flowStore.ts';
import {
  ACTION_ORDER,
  availableActionTypes,
  buildLocations,
  buildVariants,
  cardsForAction,
  currentStep,
  developFirstOptions,
  developSecondOptions,
  finalAction,
  networkAddable,
  previewAction,
  promptInfo,
  sellLocations,
  sellMerchants,
  whyDisabledKey,
} from './flow.ts';

const ACTION_GLYPH: Record<ActionType, string> = {
  BUILD: '🏗',
  NETWORK: '🛤',
  DEVELOP: '⚒',
  SELL: '💰',
  LOAN: '🏦',
  SCOUT: '🔍',
  PASS: '⏭',
};

/** Small selectable row button used throughout the flow. */
function Choice(props: {
  onClick: () => void;
  selected?: boolean;
  children: React.ReactNode;
  title?: string;
}): JSX.Element {
  return (
    <button
      onClick={props.onClick}
      title={props.title}
      style={{
        textAlign: 'left',
        padding: '8px 10px',
        background: props.selected ? 'var(--accent)' : 'var(--surface)',
        border: `1px solid ${props.selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 8,
        color: props.selected ? '#1a1207' : 'var(--text)',
        cursor: 'pointer',
        fontSize: 13,
        width: '100%',
      }}
    >
      {props.children}
    </button>
  );
}

/**
 * Guided, human-readable action flow (§7.13). The player picks an action (each
 * with an icon, name and one-line description; illegal ones disabled with a
 * "why" tooltip), then a readable card, then a target — clicking the highlighted
 * board element or a labelled choice — resolving any variant/merchant/removals,
 * and finally confirms against a live cost & effect preview. Cancel/Back are
 * available at every step. No raw `legalActions` enumeration is ever shown.
 */
export function GuidedActionBar(props: {
  game: GameState;
  onDispatch: (a: Action) => void;
}): JSX.Element {
  const { game, onDispatch } = props;
  const { t } = useTranslation();
  const flow = useFlow();
  const rulesHints = useSettings((s) => s.settings.rulesHints);
  const acts = useMemo(() => legalActions(game), [game]);
  const avail = useMemo(() => availableActionTypes(acts), [acts]);

  // Reset the in-progress selection whenever the turn context changes.
  useEffect(() => {
    flow.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.activePlayer, game.actionsLeftThisTurn, game.round, game.era]);

  const step = currentStep(flow);
  const prompt = promptInfo(t, game, flow);
  const final = useMemo(() => finalAction(game, acts, flow), [game, acts, flow]);

  // ---- Step 0: choose an action -----------------------------------------
  if (step === 'action') {
    return (
      <Panel style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('flow.prompt.action')}</div>
          <HelpButton topic="actions" from="game" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {ACTION_ORDER.map((type) => {
            const ok = avail.has(type);
            return (
              <button
                key={type}
                disabled={!ok}
                onClick={() => flow.start(type)}
                title={ok ? t(`action.${type.toLowerCase()}Desc`) : t(whyDisabledKey(type))}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: ok ? 'var(--surface)' : 'var(--bg-panel)',
                  color: ok ? 'var(--text)' : 'var(--text-muted)',
                  cursor: ok ? 'pointer' : 'not-allowed',
                  opacity: ok ? 1 : 0.55,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {ACTION_GLYPH[type]} {t(`action.${type.toLowerCase()}`)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t(`action.${type.toLowerCase()}Desc`)}
                </span>
              </button>
            );
          })}
        </div>
        {rulesHints && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('help.actionHint')}</div>
        )}
      </Panel>
    );
  }

  const actionType = flow.actionType!;
  const isPass = actionType === 'PASS';

  return (
    <Panel style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header: chosen action + step prompt + Back / Cancel. */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <strong style={{ fontSize: 14 }}>
          {ACTION_GLYPH[actionType]} {t(`action.${actionType.toLowerCase()}`)}
        </strong>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <HelpButton topic={actionType.toLowerCase()} from="game" />
          <SmallBtn onClick={flow.back}>← {t('flow.back')}</SmallBtn>
          <SmallBtn onClick={flow.reset}>✕ {t('game.cancel')}</SmallBtn>
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t(prompt.key, prompt.params)}</div>

      {/* Chosen card chip. */}
      {flow.cardId &&
        (() => {
          const card = game.players[game.activePlayer]!.hand.find((c) => c.id === flow.cardId);
          return card ? (
            <div style={{ fontSize: 12 }}>
              {t('flow.usingCard')}: <strong>{cardLabel(t, card)}</strong> ({cardKindLabel(t, card)}
              )
            </div>
          ) : null;
        })()}

      {/* Step: choose a card. */}
      {step === 'card' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cardsForAction(game, acts, actionType).map((c) => (
            <Choice key={c.id} onClick={() => flow.chooseCard(c.id)}>
              <strong>{cardLabel(t, c)}</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>· {cardKindLabel(t, c)}</span>
            </Choice>
          ))}
        </div>
      )}

      {/* BUILD: pick location, then variant. */}
      {actionType === 'BUILD' && flow.cardId && step !== 'card' && (
        <>
          {!flow.locationId ? (
            <BoardPickList
              t={t}
              game={game}
              ids={buildLocations(acts, flow.cardId)}
              onPick={flow.pickLocation}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {buildVariants(game, acts, flow.cardId, flow.locationId).map((v) => (
                <Choice
                  key={`${v.industry}/${v.slotId}`}
                  selected={flow.industry === v.industry && flow.slotId === v.slotId}
                  onClick={() => flow.chooseVariant(v.industry, v.slotId)}
                >
                  {INDUSTRY_ICON[v.industry].glyph} <strong>{t(`industry.${v.industry}`)}</strong>{' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    · {t('flow.slot')} {v.slotIndex} · £{v.costMoney}
                  </span>
                </Choice>
              ))}
            </div>
          )}
        </>
      )}

      {/* NETWORK: pick one or two links from the board. */}
      {actionType === 'NETWORK' && flow.cardId && step !== 'card' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {flow.lineIds.map((id) => (
            <Choice key={id} selected onClick={() => flow.pickLine(id)}>
              ✓ {lineName(t, game, id)}{' '}
              <span style={{ color: '#1a1207' }}>· {t('flow.tapRemove')}</span>
            </Choice>
          ))}
          {networkAddable(acts, flow.cardId, flow.lineIds).map((id) => (
            <Choice key={id} onClick={() => flow.pickLine(id)}>
              + {lineName(t, game, id)}
            </Choice>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('flow.clickBoardLine')}</div>
        </div>
      )}

      {/* SELL: pick the goods tile, then a merchant. */}
      {actionType === 'SELL' && flow.cardId && step !== 'card' && (
        <>
          {!flow.locationId ? (
            <BoardPickList
              t={t}
              game={game}
              ids={sellLocations(game, acts, flow.cardId)}
              onPick={flow.pickLocation}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sellMerchants(game, acts, flow.cardId, flow.locationId).map((mid) => {
                const m = game.merchants.find((mm) => mm.id === mid);
                const bonus = m ? boardContext(game).merchantById[m.locationId]?.bonus : undefined;
                return (
                  <Choice
                    key={mid}
                    selected={flow.merchantId === mid}
                    onClick={() => flow.chooseMerchant(mid)}
                  >
                    <strong>{m ? locName(t, game, m.locationId) : mid}</strong>
                    {bonus && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        {' '}
                        · {MERCHANT_BONUS_ICON[bonus].glyph}{' '}
                        {t(MERCHANT_BONUS_ICON[bonus].labelKey)}
                      </span>
                    )}
                  </Choice>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* DEVELOP: choose 1–2 industries to remove. */}
      {actionType === 'DEVELOP' && flow.cardId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {developFirstOptions(acts, flow.cardId).map((ind) => (
            <Choice
              key={ind}
              selected={flow.removals.includes(ind)}
              onClick={() => flow.toggleRemoval(ind)}
            >
              {INDUSTRY_ICON[ind].glyph} {t(`industry.${ind}`)}
            </Choice>
          ))}
          {flow.removals.length >= 1 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('flow.developSecond')}
            </div>
          )}
          {flow.removals.length >= 1 &&
            developSecondOptions(acts, flow.cardId, flow.removals[0]!)
              .filter((ind) => ind !== flow.removals[0])
              .map((ind) => (
                <Choice
                  key={`2-${ind}`}
                  selected={flow.removals.includes(ind)}
                  onClick={() => flow.toggleRemoval(ind)}
                >
                  + {INDUSTRY_ICON[ind].glyph} {t(`industry.${ind}`)}
                </Choice>
              ))}
        </div>
      )}

      {/* SCOUT: pick two extra cards to discard. */}
      {actionType === 'SCOUT' && flow.cardId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {game.players[game.activePlayer]!.hand.filter((c) => c.id !== flow.cardId).map((c) => (
            <Choice
              key={c.id}
              selected={flow.discardIds.includes(c.id)}
              onClick={() => flow.toggleDiscard(c.id)}
            >
              <strong>{cardLabel(t, c)}</strong>{' '}
              <span
                style={{ color: flow.discardIds.includes(c.id) ? '#1a1207' : 'var(--text-muted)' }}
              >
                · {cardKindLabel(t, c)}
              </span>
            </Choice>
          ))}
        </div>
      )}

      {/* PASS: card already chosen is the discard. */}
      {isPass && flow.cardId && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('flow.passNote')}</div>
      )}

      {/* Confirm with cost & effect preview. */}
      {final && (
        <ConfirmPanel
          game={game}
          action={final}
          onConfirm={() => {
            onDispatch(final);
            flow.reset();
          }}
        />
      )}
    </Panel>
  );
}

function SmallBtn(props: { onClick: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <button
      onClick={props.onClick}
      style={{
        padding: '4px 8px',
        fontSize: 12,
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text)',
        cursor: 'pointer',
      }}
    >
      {props.children}
    </button>
  );
}

/** Board-target step: a hint plus a labelled fallback list of valid locations. */
function BoardPickList(props: {
  t: TFunction;
  game: GameState;
  ids: string[];
  onPick: (id: string) => void;
}): JSX.Element {
  const { t, game, ids, onPick } = props;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('flow.clickBoard')}</div>
      {ids.map((id) => (
        <Choice key={id} onClick={() => onPick(id)}>
          📍 {locName(t, game, id)}
        </Choice>
      ))}
    </div>
  );
}

function Pill(props: { children: React.ReactNode; color?: string }): JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        color: props.color ?? 'var(--text)',
      }}
    >
      {props.children}
    </span>
  );
}

/** Cost & effect preview + the final Confirm button. */
function ConfirmPanel(props: {
  game: GameState;
  action: Action;
  onConfirm: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const preview = useMemo(
    () => previewAction(props.game, props.action),
    [props.game, props.action],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        paddingTop: 8,
        borderTop: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('flow.preview')}</div>
      {preview ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {preview.money !== 0 && (
            <Pill color={preview.money < 0 ? 'var(--player-red)' : 'var(--player-green)'}>
              £{preview.money > 0 ? `+${preview.money}` : preview.money}
            </Pill>
          )}
          {preview.coal > 0 && (
            <Pill>
              {RESOURCE_ICON.coal.glyph} {preview.coal} {t('legend.coal')}
            </Pill>
          )}
          {preview.iron > 0 && (
            <Pill>
              {RESOURCE_ICON.iron.glyph} {preview.iron} {t('legend.iron')}
            </Pill>
          )}
          {preview.juice > 0 && (
            <Pill>
              {RESOURCE_ICON.juice.glyph} {preview.juice} {t('legend.juice')}
            </Pill>
          )}
          {preview.vp > 0 && (
            <Pill color="var(--accent)">
              {RESOURCE_ICON.vp.glyph} +{preview.vp} {t('game.vp')}
            </Pill>
          )}
          {preview.income > 0 && (
            <Pill>
              {RESOURCE_ICON.income.glyph} +{preview.income} {t('game.income')}
            </Pill>
          )}
          {preview.flips > 0 && (
            <Pill color="var(--accent)">
              ★ {preview.flips} {t('flow.flips')}
            </Pill>
          )}
          {preview.production.coal > 0 && (
            <Pill color="var(--player-green)">
              {RESOURCE_ICON.coal.glyph} +{preview.production.coal}
              {t('flow.perRound')} {t('flow.production')}
            </Pill>
          )}
          {preview.production.iron > 0 && (
            <Pill color="var(--player-green)">
              {RESOURCE_ICON.iron.glyph} +{preview.production.iron}
              {t('flow.perRound')} {t('flow.production')}
            </Pill>
          )}
          {preview.production.juice > 0 && (
            <Pill color="var(--player-green)">
              {RESOURCE_ICON.juice.glyph} +{preview.production.juice}
              {t('flow.perRound')} {t('flow.production')}
            </Pill>
          )}
          {preview.fromMarket > 0 && (
            <Pill color="var(--text-muted)">
              🛒 {preview.fromMarket} {t('flow.fromMarket')}
            </Pill>
          )}
          {preview.fromPlayer > 0 && (
            <Pill color="var(--text-muted)">
              🤝 {preview.fromPlayer} {t('flow.fromPlayer', { player: '' })}
            </Pill>
          )}
          {preview.fromSupply > 0 && (
            <Pill color="var(--text-muted)">
              🏷 {preview.fromSupply} {t('flow.fromSupply')}
            </Pill>
          )}
          {preview.resourceCost > 0 && (
            <Pill color="var(--text-muted)">
              {t('flow.itemized')}: £{preview.resourceCost}
            </Pill>
          )}
          {preview.money === 0 &&
            preview.coal === 0 &&
            preview.iron === 0 &&
            preview.juice === 0 &&
            preview.vp === 0 &&
            preview.income === 0 &&
            preview.flips === 0 &&
            preview.production.coal === 0 &&
            preview.production.iron === 0 &&
            preview.production.juice === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('flow.noCost')}</span>
            )}
        </div>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('flow.noPreview')}</span>
      )}
      <button
        onClick={props.onConfirm}
        style={{
          padding: '10px 16px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--accent)',
          color: '#1a1207',
          fontWeight: 700,
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        ✓ {t('game.confirm')}
      </button>
    </div>
  );
}
