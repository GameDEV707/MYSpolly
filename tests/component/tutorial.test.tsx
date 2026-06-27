import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tutorial } from '../../src/app/screens/Tutorial.tsx';
import { initI18n } from '../../src/app/i18n/index.ts';

initI18n('en');

describe('Interactive Tutorial', () => {
  it('starts on the Build lesson with the first coached instruction', () => {
    render(<Tutorial />);
    expect(screen.getByText('🎓 Interactive Tutorial')).toBeInTheDocument();
    expect(screen.getByText('Select your Birmingham location card.')).toBeInTheDocument();
  });

  it('advances only when the highlighted element is clicked', () => {
    render(<Tutorial />);
    // The non-target Coal Mine slot is disabled (input is constrained).
    const coal = screen.getByRole('button', { name: /Coal Mine/ });
    expect(coal).toBeDisabled();
    // Clicking the highlighted Birmingham card advances to the next step.
    fireEvent.click(screen.getByRole('button', { name: /Birmingham/ }));
    expect(
      screen.getByText('Now click the highlighted Cotton Mill space to build it.'),
    ).toBeInTheDocument();
  });
});
