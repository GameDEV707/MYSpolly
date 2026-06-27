import { useTranslation } from 'react-i18next';
import { useApp, type AppScreen } from '../../store/appStore.ts';
import { HELP_TOPIC_CHAPTER } from '../../data/rules.ts';

/**
 * Contextual "?" help button (§7.14.3 / 3T.11). Opens the Rules Library at the
 * chapter most relevant to the panel it sits in, returning to `from` afterwards.
 */
export function HelpButton(props: { topic: string; from: AppScreen; label?: string }): JSX.Element {
  const { t } = useTranslation();
  const openRules = useApp((s) => s.openRules);
  const chapter = HELP_TOPIC_CHAPTER[props.topic] ?? null;
  const label = props.label ?? t('help.openChapter');
  return (
    <button
      type="button"
      onClick={() => openRules(props.from, chapter)}
      title={label}
      aria-label={label}
      style={{
        width: 22,
        height: 22,
        flex: '0 0 auto',
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text-muted)',
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      ?
    </button>
  );
}
