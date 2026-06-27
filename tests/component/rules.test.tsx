import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Rules } from '../../src/app/screens/Rules.tsx';
import { initI18n } from '../../src/app/i18n/index.ts';

initI18n('en');

describe('Rules Library', () => {
  it('renders the table of contents with chapters', () => {
    render(<Rules />);
    expect(screen.getByText('How to Play')).toBeInTheDocument();
    // Action chapters appear in the TOC (Overview is also the open chapter, so
    // it would match twice — assert on TOC-only titles instead).
    expect(screen.getByText('Action: Build')).toBeInTheDocument();
    expect(screen.getByText('Icon Glossary')).toBeInTheDocument();
  });

  it('filters chapters via search', () => {
    render(<Rules />);
    const search = screen.getByPlaceholderText('Search rules…');
    fireEvent.change(search, { target: { value: 'merchant' } });
    // A chapter that mentions merchants should still be listed…
    expect(screen.getByText('Action: Sell')).toBeInTheDocument();
    // …while an unrelated one (Loan) is filtered out of the table of contents.
    expect(screen.queryByText('Action: Loan')).toBeNull();
  });
});
