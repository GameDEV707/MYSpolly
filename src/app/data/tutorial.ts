import type { DiagramId } from './rules.ts';

/**
 * Interactive Tutorial content (§7.14.2 / tasks 3T.6–3T.8). A scripted, coached
 * sequence of lessons that teaches the rules by having the player perform each
 * action on a small guided stage. Input is constrained to the highlighted
 * element, completion is validated before advancing, and every lesson can be
 * skipped or replayed. All text is localized (`tutorial.*`) in EN/RU/UZ.
 *
 * The stage is intentionally self-contained (it does not drive the real engine),
 * so the coached flow is reliable and the lesson order is exactly as specified:
 * Build → Network → Sell (juice + merchant) → Develop → Loan/Scout → income →
 * end-of-round turn order → Canal→Rail transition + scoring.
 */

export type ElementKind =
  | 'card'
  | 'slot'
  | 'town'
  | 'merchant'
  | 'juice'
  | 'iron'
  | 'button'
  | 'tile';

export interface TutorialElement {
  id: string;
  kind: ElementKind;
  /** i18n key for the element's label (reuses existing game keys where possible). */
  labelKey: string;
  icon: string;
}

/** A `click` step constrains input to one element; `info` steps just explain. */
export type TutorialStep =
  | { kind: 'click'; target: string; instrKey: string }
  | { kind: 'info'; instrKey: string; diagram?: DiagramId };

export interface TutorialLesson {
  id: string;
  icon: string;
  titleKey: string;
  introKey: string;
  elements: TutorialElement[];
  steps: TutorialStep[];
}

const el = (id: string, kind: ElementKind, labelKey: string, icon: string): TutorialElement => ({
  id,
  kind,
  labelKey,
  icon,
});
const click = (target: string, instrKey: string): TutorialStep => ({
  kind: 'click',
  target,
  instrKey,
});
const info = (instrKey: string, diagram?: DiagramId): TutorialStep =>
  diagram ? { kind: 'info', instrKey, diagram } : { kind: 'info', instrKey };

export const TUTORIAL_LESSONS: TutorialLesson[] = [
  {
    id: 'build',
    icon: '🏗',
    titleKey: 'tutorial.build.title',
    introKey: 'tutorial.build.intro',
    elements: [
      el('card1', 'card', 'loc.birmingham', '🎴'),
      el('slotCotton', 'slot', 'industry.cotton', '🧵'),
      el('slotCoal', 'slot', 'industry.coal', '⬛'),
    ],
    steps: [
      click('card1', 'tutorial.build.s1'),
      click('slotCotton', 'tutorial.build.s2'),
      info('tutorial.build.s3'),
    ],
  },
  {
    id: 'network',
    icon: '🛤',
    titleKey: 'tutorial.network.title',
    introKey: 'tutorial.network.intro',
    elements: [
      el('townDudley', 'town', 'loc.dudley', '🏙'),
      el('link1', 'slot', 'legend.canal', '〰'),
      el('townBham', 'town', 'loc.birmingham', '🏙'),
    ],
    steps: [click('link1', 'tutorial.network.s1'), info('tutorial.network.s2')],
  },
  {
    id: 'sell',
    icon: '💰',
    titleKey: 'tutorial.sell.title',
    introKey: 'tutorial.sell.intro',
    elements: [
      el('tileCotton', 'tile', 'industry.cotton', '🧵'),
      el('juice1', 'juice', 'legend.juice', '🧃'),
      el('merchOxford', 'merchant', 'loc.oxford', '🏪'),
    ],
    steps: [
      click('juice1', 'tutorial.sell.s1'),
      click('merchOxford', 'tutorial.sell.s2'),
      info('tutorial.sell.s3'),
    ],
  },
  {
    id: 'develop',
    icon: '⚒',
    titleKey: 'tutorial.develop.title',
    introKey: 'tutorial.develop.intro',
    elements: [
      el('iron1', 'iron', 'legend.iron', '🟧'),
      el('matTile', 'tile', 'industry.pottery', '🏺'),
    ],
    steps: [
      click('iron1', 'tutorial.develop.s1'),
      click('matTile', 'tutorial.develop.s2'),
      info('tutorial.develop.s3'),
    ],
  },
  {
    id: 'loanScout',
    icon: '🏦',
    titleKey: 'tutorial.loanScout.title',
    introKey: 'tutorial.loanScout.intro',
    elements: [
      el('loanBtn', 'button', 'action.loan', '🏦'),
      el('discard1', 'card', 'card.location', '🎴'),
      el('discard2', 'card', 'card.industry', '🎴'),
    ],
    steps: [
      click('loanBtn', 'tutorial.loanScout.s1'),
      info('tutorial.loanScout.s2'),
      click('discard1', 'tutorial.loanScout.s3'),
      click('discard2', 'tutorial.loanScout.s4'),
      info('tutorial.loanScout.s5'),
    ],
  },
  {
    id: 'income',
    icon: '📈',
    titleKey: 'tutorial.income.title',
    introKey: 'tutorial.income.intro',
    elements: [el('collect', 'button', 'game.income', '📈')],
    steps: [
      info('tutorial.income.s1', 'incomeTrack'),
      click('collect', 'tutorial.income.s2'),
      info('tutorial.income.s3'),
    ],
  },
  {
    id: 'turnOrder',
    icon: '🔢',
    titleKey: 'tutorial.turnOrder.title',
    introKey: 'tutorial.turnOrder.intro',
    elements: [],
    steps: [info('tutorial.turnOrder.s1', 'turnFlow'), info('tutorial.turnOrder.s2')],
  },
  {
    id: 'eras',
    icon: '🚂',
    titleKey: 'tutorial.eras.title',
    introKey: 'tutorial.eras.intro',
    elements: [],
    steps: [info('tutorial.eras.s1', 'eraTimeline'), info('tutorial.eras.s2', 'tileFlip')],
  },
];
