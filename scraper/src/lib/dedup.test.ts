import { describe, expect, it } from 'vitest';
import { decidiAzione } from './dedup.js';
import type { BandoRaw } from './types.js';

const bando: BandoRaw = {
  fonte: 'eit',
  titolo: 'Bando di test',
  descrizione: 'Descrizione di test',
  url: 'https://esempio.it/bando-test',
  scadenza: null,
  data_pubblicazione: null,
  hash_contenuto: 'abc123',
};

describe('decidiAzione', () => {
  it('restituisce insert se il bando non esiste ancora', () => {
    expect(decidiAzione(null, bando)).toBe('insert');
  });

  it('restituisce skip se esiste gia con lo stesso hash', () => {
    expect(decidiAzione({ hash_contenuto: 'abc123' }, bando)).toBe('skip');
  });

  it('restituisce update se esiste ma con hash diverso', () => {
    expect(decidiAzione({ hash_contenuto: 'hash-vecchio' }, bando)).toBe('update');
  });
});
