import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renderizza senza errori', () => {
    render(<App />);
    expect(screen.getByText(/QYROS Bandi Monitor/i)).toBeInTheDocument();
  });
});
