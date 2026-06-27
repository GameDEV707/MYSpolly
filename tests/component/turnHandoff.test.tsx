import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TurnHandoff } from '../../src/app/components/hud/TurnHandoff.tsx';
import type { HandoffState } from '../../src/app/components/hud/useTurnHandoff.ts';
import { initI18n } from '../../src/app/i18n/index.ts';

initI18n('en');

describe('TurnHandoff', () => {
  it('renders nothing when there is no handoff', () => {
    const { container } = render(<TurnHandoff handoff={null} onReady={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a brief banner naming the next player', () => {
    const handoff: HandoffState = {
      color: 'blue',
      name: 'Blue',
      isAI: false,
      mode: 'banner',
      token: 1,
    };
    render(<TurnHandoff handoff={handoff} onReady={() => {}} />);
    expect(screen.getByText("Blue's turn")).toBeInTheDocument();
  });

  it('shows the hot-seat confirmation and fires onReady', () => {
    const onReady = vi.fn();
    const handoff: HandoffState = {
      color: 'red',
      name: 'Red',
      isAI: false,
      mode: 'confirm',
      token: 2,
    };
    render(<TurnHandoff handoff={handoff} onReady={onReady} />);
    expect(screen.getByText('Pass the device to Red')).toBeInTheDocument();
    fireEvent.click(screen.getByText("I'm ready"));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('announces an AI player without a confirmation prompt', () => {
    const handoff: HandoffState = {
      color: 'green',
      name: 'Bot',
      isAI: true,
      mode: 'banner',
      token: 3,
    };
    render(<TurnHandoff handoff={handoff} onReady={() => {}} />);
    expect(screen.getByText('Bot is playing…')).toBeInTheDocument();
  });
});
