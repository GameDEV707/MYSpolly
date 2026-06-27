import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useApp } from '../store/appStore.ts';
import { Button } from '../components/ui.tsx';
import { RuleDiagram } from '../components/rules/RuleDiagram.tsx';
import { IconGlossary } from '../components/rules/IconGlossary.tsx';
import { RULE_CHAPTERS, chapterTextKeys, type RuleBlock, type RuleChapter } from '../data/rules.ts';

/**
 * Rules Library (§7.14.1 / tasks 3T.1–3T.4). A scrollable, searchable reference
 * with a table of contents, deep links, collapsible sections, illustrated
 * diagrams, an icon glossary, and next/previous navigation. Reachable from the
 * Main Menu and from the Pause menu without losing game state.
 */
export function Rules(): JSX.Element {
  const { t } = useTranslation();
  const back = useApp((s) => s.settingsReturn);
  const deepChapter = useApp((s) => s.rulesChapter);
  const goto = useApp((s) => s.goto);
  const startTutorial = useApp((s) => s.startTutorial);

  const initial = useMemo(
    () =>
      deepChapter && RULE_CHAPTERS.some((c) => c.id === deepChapter)
        ? deepChapter
        : RULE_CHAPTERS[0]!.id,
    [deepChapter],
  );
  const [currentId, setCurrentId] = useState(initial);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const idx = RULE_CHAPTERS.findIndex((c) => c.id === currentId);
  const chapter = RULE_CHAPTERS[idx] ?? RULE_CHAPTERS[0]!;

  // Search index: lowercased translated text per chapter (title + all blocks).
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      RULE_CHAPTERS.filter((c) =>
        chapterTextKeys(c)
          .map((k) => String(t(k)).toLowerCase())
          .join(' \u0001 ')
          .includes(q),
      ).map((c) => c.id),
    );
  }, [query, t]);

  const visibleChapters = matches ? RULE_CHAPTERS.filter((c) => matches.has(c.id)) : RULE_CHAPTERS;

  function select(id: string): void {
    setCurrentId(id);
    setCollapsed(new Set());
  }

  function toggleSection(id: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const prev = idx > 0 ? RULE_CHAPTERS[idx - 1]! : null;
  const next = idx < RULE_CHAPTERS.length - 1 ? RULE_CHAPTERS[idx + 1]! : null;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-6)',
        gap: 'var(--space-4)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>{t('rules.title')}</h1>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('rules.search')}
          aria-label={t('rules.search')}
          style={{
            marginLeft: 'auto',
            minWidth: 220,
            padding: '8px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 14,
          }}
        />
        <Button variant="ghost" onClick={() => startTutorial(back)}>
          🎓 {t('rules.startTutorial')}
        </Button>
        <Button variant="ghost" onClick={() => goto(back === 'splash' ? 'mainMenu' : back)}>
          ← {t('rules.back')}
        </Button>
      </div>

      {/* Body: TOC + content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: 'var(--space-4)',
        }}
      >
        {/* Table of contents */}
        <nav
          aria-label={t('rules.contents')}
          style={{
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            paddingRight: 4,
          }}
        >
          <div
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              letterSpacing: 0.5,
              padding: '0 4px 4px',
            }}
          >
            {t('rules.contents')}
          </div>
          {visibleChapters.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 8 }}>
              {t('rules.noResults')}
            </div>
          )}
          {visibleChapters.map((c) => (
            <button
              key={c.id}
              onClick={() => select(c.id)}
              aria-current={c.id === currentId ? 'true' : undefined}
              style={{
                textAlign: 'left',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: c.id === currentId ? 'var(--accent)' : 'transparent',
                background: c.id === currentId ? 'var(--surface)' : 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              <span aria-hidden style={{ fontSize: 16 }}>
                {c.icon}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t(c.titleKey)}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t(c.summaryKey)}</span>
              </span>
            </button>
          ))}
        </nav>

        {/* Chapter content */}
        <article style={{ overflow: 'auto', paddingRight: 8 }}>
          <ChapterView chapter={chapter} t={t} collapsed={collapsed} onToggle={toggleSection} />

          {/* Next / previous */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 'var(--space-6)',
              gap: 8,
            }}
          >
            <Button variant="ghost" disabled={!prev} onClick={() => prev && select(prev.id)}>
              {prev ? `← ${t(prev.titleKey)}` : ''}
            </Button>
            <Button variant="ghost" disabled={!next} onClick={() => next && select(next.id)}>
              {next ? `${t(next.titleKey)} →` : ''}
            </Button>
          </div>
        </article>
      </div>
    </div>
  );
}

function ChapterView(props: {
  chapter: RuleChapter;
  t: TFunction;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}): JSX.Element {
  const { chapter, t, collapsed, onToggle } = props;
  return (
    <div style={{ maxWidth: 820 }}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          margin: '0 0 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span aria-hidden>{chapter.icon}</span> {t(chapter.titleKey)}
      </h2>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>{t(chapter.summaryKey)}</p>

      {chapter.sections.map((s) => {
        const open = !collapsed.has(s.id);
        return (
          <section key={s.id} style={{ marginBottom: 'var(--space-4)' }}>
            <button
              onClick={() => onToggle(s.id)}
              aria-expanded={open}
              style={{
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              <span aria-hidden style={{ color: 'var(--accent)', width: 16 }}>
                {open ? '▾' : '▸'}
              </span>
              {t(s.headingKey)}
            </button>
            {open && (
              <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {s.blocks.map((b, i) => (
                  <BlockView key={i} block={b} t={t} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function BlockView(props: { block: RuleBlock; t: TFunction }): JSX.Element {
  const { block, t } = props;
  switch (block.kind) {
    case 'p':
      return <p style={{ margin: 0, lineHeight: 1.55 }}>{t(block.key)}</p>;
    case 'list':
      return (
        <ul
          style={{
            margin: 0,
            paddingLeft: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            lineHeight: 1.5,
          }}
        >
          {block.keys.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      );
    case 'note':
      return (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 'var(--radius)',
            background: 'var(--surface)',
            borderLeft: '3px solid var(--accent)',
            fontSize: 14,
          }}
        >
          <span aria-hidden>💡</span>
          <span style={{ lineHeight: 1.5 }}>{t(block.key)}</span>
        </div>
      );
    case 'diagram':
      return (
        <figure style={{ margin: 0 }}>
          <RuleDiagram id={block.id} />
          {block.captionKey && (
            <figcaption
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              {t(block.captionKey)}
            </figcaption>
          )}
        </figure>
      );
    case 'glossary':
      return <IconGlossary />;
    default:
      return <></>;
  }
}
