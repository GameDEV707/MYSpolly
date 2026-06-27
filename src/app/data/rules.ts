/**
 * Rules Library content model (§7.14.1 / Phase 3T). Chapters mirror the real
 * Brass: Birmingham flow so a new player can learn the whole game in-app. All
 * text lives in i18n (`rulesLib.*`) and is paraphrased from the rulebook — never
 * copied verbatim — and fully localized in EN/RU/UZ. Diagrams are rendered by
 * `RuleDiagram` so pages are illustrated, not walls of text.
 */

export type DiagramId =
  | 'connection'
  | 'turnFlow'
  | 'marketTrack'
  | 'tileFlip'
  | 'sellChain'
  | 'incomeTrack'
  | 'eraTimeline';

export type RuleBlock =
  | { kind: 'p'; key: string }
  | { kind: 'list'; keys: string[] }
  | { kind: 'note'; key: string }
  | { kind: 'diagram'; id: DiagramId; captionKey?: string }
  /** Special block: renders the live icon glossary reusing the board icon set. */
  | { kind: 'glossary' };

export interface RuleSection {
  /** Stable id (used for collapse state + deep links). */
  id: string;
  headingKey: string;
  blocks: RuleBlock[];
}

export interface RuleChapter {
  id: string;
  icon: string;
  titleKey: string;
  /** Short one-line summary shown under the title + in the table of contents. */
  summaryKey: string;
  sections: RuleSection[];
}

const p = (key: string): RuleBlock => ({ kind: 'p', key });
const note = (key: string): RuleBlock => ({ kind: 'note', key });
const list = (...keys: string[]): RuleBlock => ({ kind: 'list', keys });
const diagram = (id: DiagramId, captionKey?: string): RuleBlock =>
  captionKey ? { kind: 'diagram', id, captionKey } : { kind: 'diagram', id };

/**
 * The ordered chapter list. `next/previous` navigation simply walks this array.
 */
export const RULE_CHAPTERS: RuleChapter[] = [
  {
    id: 'overview',
    icon: '📖',
    titleKey: 'rulesLib.overview.title',
    summaryKey: 'rulesLib.overview.summary',
    sections: [
      {
        id: 'theme',
        headingKey: 'rulesLib.overview.theme.h',
        blocks: [p('rulesLib.overview.theme.p1'), p('rulesLib.overview.theme.p2')],
      },
      {
        id: 'goal',
        headingKey: 'rulesLib.overview.goal.h',
        blocks: [
          p('rulesLib.overview.goal.p1'),
          list(
            'rulesLib.overview.goal.l1',
            'rulesLib.overview.goal.l2',
            'rulesLib.overview.goal.l3',
          ),
          note('rulesLib.overview.goal.note'),
        ],
      },
    ],
  },
  {
    id: 'eras',
    icon: '🕰️',
    titleKey: 'rulesLib.eras.title',
    summaryKey: 'rulesLib.eras.summary',
    sections: [
      {
        id: 'twoEras',
        headingKey: 'rulesLib.eras.twoEras.h',
        blocks: [
          p('rulesLib.eras.twoEras.p1'),
          diagram('eraTimeline', 'rulesLib.eras.twoEras.caption'),
          list('rulesLib.eras.twoEras.l1', 'rulesLib.eras.twoEras.l2'),
        ],
      },
      {
        id: 'between',
        headingKey: 'rulesLib.eras.between.h',
        blocks: [p('rulesLib.eras.between.p1'), note('rulesLib.eras.between.note')],
      },
    ],
  },
  {
    id: 'components',
    icon: '🧩',
    titleKey: 'rulesLib.components.title',
    summaryKey: 'rulesLib.components.summary',
    sections: [
      {
        id: 'board',
        headingKey: 'rulesLib.components.board.h',
        blocks: [
          p('rulesLib.components.board.p1'),
          list(
            'rulesLib.components.board.l1',
            'rulesLib.components.board.l2',
            'rulesLib.components.board.l3',
            'rulesLib.components.board.l4',
          ),
        ],
      },
      {
        id: 'pieces',
        headingKey: 'rulesLib.components.pieces.h',
        blocks: [
          list(
            'rulesLib.components.pieces.l1',
            'rulesLib.components.pieces.l2',
            'rulesLib.components.pieces.l3',
            'rulesLib.components.pieces.l4',
            'rulesLib.components.pieces.l5',
          ),
        ],
      },
    ],
  },
  {
    id: 'setup',
    icon: '🎬',
    titleKey: 'rulesLib.setup.title',
    summaryKey: 'rulesLib.setup.summary',
    sections: [
      {
        id: 'common',
        headingKey: 'rulesLib.setup.common.h',
        blocks: [
          p('rulesLib.setup.common.p1'),
          list('rulesLib.setup.common.l1', 'rulesLib.setup.common.l2', 'rulesLib.setup.common.l3'),
        ],
      },
      {
        id: 'counts',
        headingKey: 'rulesLib.setup.counts.h',
        blocks: [
          p('rulesLib.setup.counts.p2'),
          p('rulesLib.setup.counts.p3'),
          p('rulesLib.setup.counts.p4'),
          note('rulesLib.setup.counts.note'),
        ],
      },
    ],
  },
  {
    id: 'turns',
    icon: '🔄',
    titleKey: 'rulesLib.turns.title',
    summaryKey: 'rulesLib.turns.summary',
    sections: [
      {
        id: 'structure',
        headingKey: 'rulesLib.turns.structure.h',
        blocks: [
          p('rulesLib.turns.structure.p1'),
          diagram('turnFlow', 'rulesLib.turns.structure.caption'),
          note('rulesLib.turns.structure.firstRound'),
        ],
      },
      {
        id: 'order',
        headingKey: 'rulesLib.turns.order.h',
        blocks: [p('rulesLib.turns.order.p1'), p('rulesLib.turns.order.p2')],
      },
    ],
  },
  {
    id: 'actBuild',
    icon: '🏗',
    titleKey: 'rulesLib.actBuild.title',
    summaryKey: 'rulesLib.actBuild.summary',
    sections: [
      {
        id: 'how',
        headingKey: 'rulesLib.actBuild.how.h',
        blocks: [
          p('rulesLib.actBuild.how.p1'),
          list('rulesLib.actBuild.how.l1', 'rulesLib.actBuild.how.l2', 'rulesLib.actBuild.how.l3'),
        ],
      },
      {
        id: 'example',
        headingKey: 'rulesLib.actBuild.example.h',
        blocks: [p('rulesLib.actBuild.example.p1'), note('rulesLib.actBuild.example.note')],
      },
    ],
  },
  {
    id: 'actNetwork',
    icon: '🛤',
    titleKey: 'rulesLib.actNetwork.title',
    summaryKey: 'rulesLib.actNetwork.summary',
    sections: [
      {
        id: 'how',
        headingKey: 'rulesLib.actNetwork.how.h',
        blocks: [
          p('rulesLib.actNetwork.how.p1'),
          list('rulesLib.actNetwork.how.l1', 'rulesLib.actNetwork.how.l2'),
        ],
      },
      {
        id: 'example',
        headingKey: 'rulesLib.actNetwork.example.h',
        blocks: [p('rulesLib.actNetwork.example.p1')],
      },
    ],
  },
  {
    id: 'actDevelop',
    icon: '⚒',
    titleKey: 'rulesLib.actDevelop.title',
    summaryKey: 'rulesLib.actDevelop.summary',
    sections: [
      {
        id: 'how',
        headingKey: 'rulesLib.actDevelop.how.h',
        blocks: [p('rulesLib.actDevelop.how.p1'), note('rulesLib.actDevelop.how.note')],
      },
    ],
  },
  {
    id: 'actSell',
    icon: '💰',
    titleKey: 'rulesLib.actSell.title',
    summaryKey: 'rulesLib.actSell.summary',
    sections: [
      {
        id: 'how',
        headingKey: 'rulesLib.actSell.how.h',
        blocks: [
          p('rulesLib.actSell.how.p1'),
          diagram('sellChain', 'rulesLib.actSell.how.caption'),
          list('rulesLib.actSell.how.l1', 'rulesLib.actSell.how.l2', 'rulesLib.actSell.how.l3'),
        ],
      },
      {
        id: 'example',
        headingKey: 'rulesLib.actSell.example.h',
        blocks: [p('rulesLib.actSell.example.p1')],
      },
    ],
  },
  {
    id: 'actLoan',
    icon: '🏦',
    titleKey: 'rulesLib.actLoan.title',
    summaryKey: 'rulesLib.actLoan.summary',
    sections: [
      {
        id: 'how',
        headingKey: 'rulesLib.actLoan.how.h',
        blocks: [p('rulesLib.actLoan.how.p1'), note('rulesLib.actLoan.how.note')],
      },
    ],
  },
  {
    id: 'actScout',
    icon: '🔍',
    titleKey: 'rulesLib.actScout.title',
    summaryKey: 'rulesLib.actScout.summary',
    sections: [
      {
        id: 'how',
        headingKey: 'rulesLib.actScout.how.h',
        blocks: [p('rulesLib.actScout.how.p1'), note('rulesLib.actScout.how.note')],
      },
    ],
  },
  {
    id: 'actPass',
    icon: '⏭',
    titleKey: 'rulesLib.actPass.title',
    summaryKey: 'rulesLib.actPass.summary',
    sections: [
      {
        id: 'how',
        headingKey: 'rulesLib.actPass.how.h',
        blocks: [p('rulesLib.actPass.how.p1')],
      },
    ],
  },
  {
    id: 'concepts',
    icon: '💡',
    titleKey: 'rulesLib.concepts.title',
    summaryKey: 'rulesLib.concepts.summary',
    sections: [
      {
        id: 'connections',
        headingKey: 'rulesLib.concepts.connections.h',
        blocks: [
          p('rulesLib.concepts.connections.p1'),
          diagram('connection', 'rulesLib.concepts.connections.caption'),
        ],
      },
      {
        id: 'resources',
        headingKey: 'rulesLib.concepts.resources.h',
        blocks: [
          p('rulesLib.concepts.resources.p1'),
          list(
            'rulesLib.concepts.resources.l1',
            'rulesLib.concepts.resources.l2',
            'rulesLib.concepts.resources.l3',
          ),
        ],
      },
      {
        id: 'markets',
        headingKey: 'rulesLib.concepts.markets.h',
        blocks: [
          p('rulesLib.concepts.markets.p1'),
          diagram('marketTrack', 'rulesLib.concepts.markets.caption'),
        ],
      },
      {
        id: 'flipping',
        headingKey: 'rulesLib.concepts.flipping.h',
        blocks: [
          p('rulesLib.concepts.flipping.p1'),
          diagram('tileFlip', 'rulesLib.concepts.flipping.caption'),
        ],
      },
      {
        id: 'overbuild',
        headingKey: 'rulesLib.concepts.overbuild.h',
        blocks: [p('rulesLib.concepts.overbuild.p1')],
      },
      {
        id: 'farm',
        headingKey: 'rulesLib.concepts.farm.h',
        blocks: [p('rulesLib.concepts.farm.p1')],
      },
    ],
  },
  {
    id: 'economy',
    icon: '🪙',
    titleKey: 'rulesLib.economy.title',
    summaryKey: 'rulesLib.economy.summary',
    sections: [
      {
        id: 'stockpile',
        headingKey: 'rulesLib.economy.stockpile.h',
        blocks: [
          p('rulesLib.economy.stockpile.p1'),
          list(
            'rulesLib.economy.stockpile.l1',
            'rulesLib.economy.stockpile.l2',
            'rulesLib.economy.stockpile.l3',
          ),
          note('rulesLib.economy.stockpile.note'),
        ],
      },
      {
        id: 'production',
        headingKey: 'rulesLib.economy.production.h',
        blocks: [
          p('rulesLib.economy.production.p1'),
          list(
            'rulesLib.economy.production.l1',
            'rulesLib.economy.production.l2',
            'rulesLib.economy.production.l3',
          ),
        ],
      },
      {
        id: 'market',
        headingKey: 'rulesLib.economy.market.h',
        blocks: [p('rulesLib.economy.market.p1'), note('rulesLib.economy.market.note')],
      },
      {
        id: 'morph',
        headingKey: 'rulesLib.economy.morph.h',
        blocks: [p('rulesLib.economy.morph.p1'), note('rulesLib.economy.morph.note')],
      },
    ],
  },
  {
    id: 'money',
    icon: '💷',
    titleKey: 'rulesLib.money.title',
    summaryKey: 'rulesLib.money.summary',
    sections: [
      {
        id: 'gating',
        headingKey: 'rulesLib.money.gating.h',
        blocks: [p('rulesLib.money.gating.p1'), note('rulesLib.money.gating.note')],
      },
      {
        id: 'trading',
        headingKey: 'rulesLib.money.trading.h',
        blocks: [
          p('rulesLib.money.trading.p1'),
          list(
            'rulesLib.money.trading.l1',
            'rulesLib.money.trading.l2',
            'rulesLib.money.trading.l3',
          ),
        ],
      },
      {
        id: 'fixed',
        headingKey: 'rulesLib.money.fixed.h',
        blocks: [
          p('rulesLib.money.fixed.p1'),
          diagram('marketTrack', 'rulesLib.concepts.markets.caption'),
          note('rulesLib.money.fixed.note'),
        ],
      },
      {
        id: 'bankruptcy',
        headingKey: 'rulesLib.money.bankruptcy.h',
        blocks: [
          p('rulesLib.money.bankruptcy.p1'),
          list('rulesLib.money.bankruptcy.l1', 'rulesLib.money.bankruptcy.l2'),
          note('rulesLib.money.bankruptcy.note'),
        ],
      },
    ],
  },
  {
    id: 'endRound',
    icon: '📊',
    titleKey: 'rulesLib.endRound.title',
    summaryKey: 'rulesLib.endRound.summary',
    sections: [
      {
        id: 'income',
        headingKey: 'rulesLib.endRound.income.h',
        blocks: [
          p('rulesLib.endRound.income.p1'),
          diagram('incomeTrack', 'rulesLib.endRound.income.caption'),
        ],
      },
      {
        id: 'shortfall',
        headingKey: 'rulesLib.endRound.shortfall.h',
        blocks: [p('rulesLib.endRound.shortfall.p1'), note('rulesLib.endRound.shortfall.note')],
      },
    ],
  },
  {
    id: 'scoring',
    icon: '🏅',
    titleKey: 'rulesLib.scoring.title',
    summaryKey: 'rulesLib.scoring.summary',
    sections: [
      {
        id: 'eraEnd',
        headingKey: 'rulesLib.scoring.eraEnd.h',
        blocks: [
          p('rulesLib.scoring.eraEnd.p1'),
          list('rulesLib.scoring.eraEnd.l1', 'rulesLib.scoring.eraEnd.l2'),
        ],
      },
      {
        id: 'maintenance',
        headingKey: 'rulesLib.scoring.maintenance.h',
        blocks: [p('rulesLib.scoring.maintenance.p1'), note('rulesLib.scoring.maintenance.note')],
      },
      {
        id: 'transition',
        headingKey: 'rulesLib.scoring.transition.h',
        blocks: [p('rulesLib.scoring.transition.p1')],
      },
    ],
  },
  {
    id: 'winning',
    icon: '🏆',
    titleKey: 'rulesLib.winning.title',
    summaryKey: 'rulesLib.winning.summary',
    sections: [
      {
        id: 'win',
        headingKey: 'rulesLib.winning.win.h',
        blocks: [
          p('rulesLib.winning.win.p1'),
          list('rulesLib.winning.win.l1', 'rulesLib.winning.win.l2'),
        ],
      },
      {
        id: 'intro',
        headingKey: 'rulesLib.winning.intro.h',
        blocks: [p('rulesLib.winning.intro.p1'), note('rulesLib.winning.intro.note')],
      },
    ],
  },
  {
    id: 'glossary',
    icon: '🗝',
    titleKey: 'rulesLib.glossary.title',
    summaryKey: 'rulesLib.glossary.summary',
    sections: [
      {
        id: 'icons',
        headingKey: 'rulesLib.glossary.icons.h',
        blocks: [p('rulesLib.glossary.icons.p1'), { kind: 'glossary' }],
      },
    ],
  },
];

/** Map of panel/help-source → the rules chapter id its "?" button should open. */
export const HELP_TOPIC_CHAPTER: Record<string, string> = {
  actions: 'turns',
  build: 'actBuild',
  network: 'actNetwork',
  develop: 'actDevelop',
  sell: 'actSell',
  loan: 'actLoan',
  scout: 'actScout',
  pass: 'actPass',
  hand: 'turns',
  markets: 'concepts',
  players: 'economy',
  economy: 'economy',
  money: 'money',
  bankruptcy: 'money',
  board: 'concepts',
  legend: 'glossary',
};

export function chapterIndex(id: string): number {
  return RULE_CHAPTERS.findIndex((c) => c.id === id);
}

/** All text i18n keys in a chapter — used by the search index. */
export function chapterTextKeys(ch: RuleChapter): string[] {
  const keys: string[] = [ch.titleKey, ch.summaryKey];
  for (const s of ch.sections) {
    keys.push(s.headingKey);
    for (const b of s.blocks) {
      if (b.kind === 'p' || b.kind === 'note') keys.push(b.key);
      else if (b.kind === 'list') keys.push(...b.keys);
      else if (b.kind === 'diagram' && b.captionKey) keys.push(b.captionKey);
    }
  }
  return keys;
}
