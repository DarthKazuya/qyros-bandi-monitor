import { describe, expect, it } from 'vitest';
import { calcolaHash } from './hash.js';

describe('calcolaHash', () => {
  it('produce lo stesso hash per lo stesso contenuto', () => {
    const a = calcolaHash('Titolo bando', 'Descrizione del bando');
    const b = calcolaHash('Titolo bando', 'Descrizione del bando');
    expect(a).toBe(b);
  });

  it('produce hash diversi per contenuti diversi', () => {
    const a = calcolaHash('Titolo bando', 'Descrizione del bando');
    const b = calcolaHash('Titolo bando', 'Descrizione modificata');
    expect(a).not.toBe(b);
  });

  it('produce una stringa esadecimale di 64 caratteri (sha256)', () => {
    const hash = calcolaHash('Titolo', 'Descrizione');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
