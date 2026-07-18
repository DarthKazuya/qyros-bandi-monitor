import { describe, expect, it } from 'vitest';
import { normalizzaTesto } from './normalizzaTesto';

describe('normalizzaTesto', () => {
  it('converte in minuscolo', () => {
    expect(normalizzaTesto('GAMING')).toBe('gaming');
  });

  it('rimuove gli accenti', () => {
    expect(normalizzaTesto('perché')).toBe('perche');
  });

  it('rimuove trattini e spazi, unendo le parole', () => {
    expect(normalizzaTesto('start-up')).toBe('startup');
    expect(normalizzaTesto('start up')).toBe('startup');
  });
});
