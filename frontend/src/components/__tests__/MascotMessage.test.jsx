import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MascotMessage from '../MascotMessage';

describe('MascotMessage', () => {
  it('renders null when message is falsy', () => {
    const { container } = render(<MascotMessage message="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when message is undefined', () => {
    const { container } = render(<MascotMessage />);
    expect(container.firstChild).toBeNull();
  });

  it('renders message text when provided', () => {
    render(<MascotMessage message="Great job! 🎉" />);
    expect(screen.getByText('Great job! 🎉')).toBeTruthy();
  });

  it('renders panda emoji with role="img"', () => {
    render(<MascotMessage message="Hello!" />);
    expect(screen.getByRole('img', { name: /panda/i })).toBeTruthy();
  });

  it('wraps content in .mascot-msg container', () => {
    const { container } = render(<MascotMessage message="Hi!" />);
    expect(container.querySelector('.mascot-msg')).not.toBeNull();
  });
});
