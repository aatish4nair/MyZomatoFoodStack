import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the page title with "Zomato" as the brand word', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'My Zomato food Stack' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Zomato')).toHaveClass('app__brand');
  });
});
