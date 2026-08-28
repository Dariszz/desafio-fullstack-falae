import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('App', () => {
  it('renders the initial review experience', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /avaliações que viram ação/i }),
    ).toBeInTheDocument();
  });
});
