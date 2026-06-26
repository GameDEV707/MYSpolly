import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BoardSvg } from '../../src/app/components/board/BoardSvg.tsx';
import { buildInitialState } from '../../src/core/engine/setup.ts';
import { initI18n } from '../../src/app/i18n/index.ts';

initI18n('en');

describe('BoardSvg', () => {
  it('renders an SVG board for a fresh 2-player game', () => {
    const game = buildInitialState({
      seats: [
        { color: 'red', name: 'R', isAI: false },
        { color: 'blue', name: 'B', isAI: true },
      ],
      seed: 1,
    });
    const { container } = render(<BoardSvg game={game} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    // Every link line should be drawn.
    expect(container.querySelectorAll('line').length).toBeGreaterThan(10);
  });
});
