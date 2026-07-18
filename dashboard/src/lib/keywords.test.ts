import { describe, expect, it } from 'vitest';
import { PAROLE_CHIAVE } from './keywords';

describe('PAROLE_CHIAVE', () => {
  it('è un array non vuoto di stringhe', () => {
    expect(Array.isArray(PAROLE_CHIAVE)).toBe(true);
    expect(PAROLE_CHIAVE.length).toBeGreaterThan(0);
    expect(PAROLE_CHIAVE.every((k) => typeof k === 'string')).toBe(true);
  });

  it('include parole sia di livello1 che di livello2', () => {
    expect(PAROLE_CHIAVE).toContain('gaming');
    expect(PAROLE_CHIAVE).toContain('startup');
  });

  it('non contiene duplicati', () => {
    expect(new Set(PAROLE_CHIAVE).size).toBe(PAROLE_CHIAVE.length);
  });
});
