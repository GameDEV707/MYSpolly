import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store/appStore.ts';
import { useSettings } from '../store/settings.ts';
import { audio } from '../audio/sound.ts';
import { Button, Panel } from '../components/ui.tsx';
import { RuleDiagram } from '../components/rules/RuleDiagram.tsx';
import { TUTORIAL_LESSONS, type TutorialElement } from '../data/tutorial.ts';

/**
 * Interactive Tutorial screen (§7.14.2 / 3T.6–3T.8). Walks the player through
 * each action on a coached stage: the next element is highlighted with an arrow
 * and a short instruction, input is constrained to that element, and the lesson
 * only advances once the player performs the step. Skip and Replay are available
 * per lesson; finishing (or exiting) marks the tutorial as seen.
 */
export function Tutorial(): JSX.Element {
  const { t } = useTranslation();
  const back = useApp((s) => s.tutorialReturn);
  const goto = useApp((s) => s.goto);
  const inGame = useApp((s) => s.game !== null);
  const update = useSettings((s) => s.update);

  const [lessonIdx, setLessonIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());

  const lesson = TUTORIAL_LESSONS[lessonIdx]!;
  const step = lesson.steps[stepIdx]!;
  const isLastStep = stepIdx === lesson.steps.length - 1;
  const isLastLesson = lessonIdx === TUTORIAL_LESSONS.length - 1;

  const target = step.kind === 'click' ? step.target : null;

  function finishTutorial(): void {
    update({ tutorialDone: true });
    goto(back === 'pause' && inGame ? 'pause' : 'mainMenu');
  }

  function advance(): void {
    if (!isLastStep) {
      setStepIdx((i) => i + 1);
      return;
    }
    audio.playSfx('button');
    if (isLastLesson) {
      finishTutorial();
      return;
    }
    setLessonIdx((i) => i + 1);
    setStepIdx(0);
    setDone(new Set());
  }

  function onElementClick(id: string): void {
    if (id !== target) {
      audio.playSfx('error');
      return;
    }
    audio.playSfx('button');
    setDone((prev) => new Set(prev).add(id));
    advance();
  }

  function replayLesson(): void {
    setStepIdx(0);
    setDone(new Set());
  }

  function skipLesson(): void {
    if (isLastLesson) {
      finishTutorial();
      return;
    }
    setLessonIdx((i) => i + 1);
    setStepIdx(0);
    setDone(new Set());
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-6)',
        gap: 'var(--space-4)',
        background: 'radial-gradient(circle at 50% 20%, var(--bg-elevated), var(--bg))',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>🎓 {t('tutorial.title')}</h1>
        <span style={{ color: 'var(--text-muted)' }}>
          {t('tutorial.lessonOf', { n: lessonIdx + 1, total: TUTORIAL_LESSONS.length })}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={replayLesson}>
            ↻ {t('tutorial.replayLesson')}
          </Button>
          <Button variant="ghost" onClick={skipLesson}>
            ⏭ {t('tutorial.skipLesson')}
          </Button>
          <Button variant="ghost" onClick={finishTutorial}>
            ✕ {t('tutorial.exit')}
          </Button>
        </div>
      </div>

      {/* Lesson chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TUTORIAL_LESSONS.map((l, i) => (
          <span
            key={l.id}
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background:
                i === lessonIdx
                  ? 'var(--accent)'
                  : i < lessonIdx
                    ? 'var(--surface)'
                    : 'transparent',
              color: i === lessonIdx ? '#1a1207' : 'var(--text-muted)',
              fontWeight: i === lessonIdx ? 700 : 400,
            }}
          >
            {l.icon} {t(l.titleKey)} {i < lessonIdx ? '✓' : ''}
          </span>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: 'var(--space-4)',
        }}
      >
        {/* Stage */}
        <Panel style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
          <h2 style={{ marginTop: 0, fontFamily: 'var(--font-display)' }}>
            {lesson.icon} {t(lesson.titleKey)}
          </h2>
          {lesson.elements.length > 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
                padding: 24,
              }}
            >
              {lesson.elements.map((e) => (
                <StageElement
                  key={e.id}
                  element={e}
                  highlighted={e.id === target}
                  done={done.has(e.id)}
                  label={t(e.labelKey)}
                  onClick={() => onElementClick(e.id)}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 64,
              }}
            >
              {lesson.icon}
            </div>
          )}
          {step.kind === 'info' && step.diagram && (
            <div style={{ marginTop: 8 }}>
              <RuleDiagram id={step.diagram} />
            </div>
          )}
        </Panel>

        {/* Coach panel */}
        <Panel style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t(lesson.introKey)}</div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: '12px',
              borderRadius: 'var(--radius)',
              background: 'var(--surface)',
              borderLeft: '3px solid var(--accent)',
            }}
          >
            <span aria-hidden style={{ fontSize: 22 }}>
              {step.kind === 'click' ? '👉' : '💡'}
            </span>
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>{t(step.instrKey)}</div>
          </div>

          {step.kind === 'click' ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('tutorial.clickHint')}
            </div>
          ) : (
            <Button onClick={advance}>
              {isLastStep && isLastLesson ? t('tutorial.finish') : t('tutorial.next')}
            </Button>
          )}

          <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {t('tutorial.stepOf', { n: stepIdx + 1, total: lesson.steps.length })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function StageElement(props: {
  element: TutorialElement;
  highlighted: boolean;
  done: boolean;
  label: string;
  onClick: () => void;
}): JSX.Element {
  const { element, highlighted, done, label, onClick } = props;
  const round = element.kind === 'beer' || element.kind === 'iron' || element.kind === 'merchant';
  const style = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 96,
    minHeight: 96,
    padding: 14,
    borderRadius: round ? '50%' : 'var(--radius)',
    border: `2px solid ${highlighted ? 'var(--accent)' : done ? 'var(--player-green)' : 'var(--border)'}`,
    background: 'var(--bg-panel)',
    color: 'var(--text)',
    cursor: highlighted ? 'pointer' : 'default',
    opacity: highlighted || done ? 1 : 0.7,
    fontSize: 30,
    boxShadow: highlighted
      ? '0 0 0 4px color-mix(in srgb, var(--accent) 35%, transparent)'
      : 'none',
    animation: highlighted
      ? 'activePulse calc(1400ms * max(var(--anim-scale), 0.0001)) ease-out infinite'
      : undefined,
    '--active-accent': 'var(--accent)',
  } as CSSProperties;
  return (
    <button onClick={onClick} disabled={!highlighted} style={style} aria-current={highlighted}>
      {highlighted && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -26,
            fontSize: 22,
            animation: 'handoffAvatarPop 600ms ease-out',
          }}
        >
          👇
        </span>
      )}
      <span aria-hidden>{element.icon}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      {done && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 4,
            right: 6,
            fontSize: 14,
            color: 'var(--player-green)',
          }}
        >
          ✓
        </span>
      )}
    </button>
  );
}
