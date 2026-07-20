import { describe, expect, it } from 'vitest';
import { classifica, normalizzaTesto } from './matching.js';
import type { Keywords } from './types.js';

const keywords: Keywords = {
  livello1: ['gaming', 'fintech', 'regtech', 'economia circolare', 'circular economy'],
  livello2: ['intelligenza artificiale', 'artificial intelligence', 'ai', 'tecnologia', 'startup', 'start-up', 'innovazione', 'innovation'],
};

describe('normalizzaTesto', () => {
  it('rimuove accenti, minuscolizza e rimuove spazi/trattini', () => {
    expect(normalizzaTesto('È un progetto di Económia Circolare!')).toBe('eunprogettodieconomiacircolare!');
  });

  it('rende equivalenti start-up, start up e startup', () => {
    expect(normalizzaTesto('start-up')).toBe(normalizzaTesto('startup'));
    expect(normalizzaTesto('start up')).toBe(normalizzaTesto('startup'));
  });
});

describe('classifica', () => {
  it('assegna priorita alta se trova una keyword di livello 1', () => {
    const risultato = classifica('Bando per il settore gaming', 'Descrizione generica', keywords);
    expect(risultato).toEqual({ priorita: 'alta', scartato: false, paroleTrovate: ['gaming'] });
  });

  it('riconosce le keyword di livello 1 case-insensitive', () => {
    const risultato = classifica('BANDO GAMING 2026', '', keywords);
    expect(risultato.priorita).toBe('alta');
  });

  it('riconosce varianti con trattino/spazio (start-up)', () => {
    const risultato = classifica('Bando per le start-up innovative', '', keywords);
    expect(risultato).toEqual({ priorita: 'da_verificare', scartato: false, paroleTrovate: ['startup', 'start-up'] });
  });

  it('assegna da_verificare se trova solo keyword di livello 2', () => {
    const risultato = classifica('Bando sulla tecnologia', 'Progetto di innovazione', keywords);
    expect(risultato).toEqual({ priorita: 'da_verificare', scartato: false, paroleTrovate: ['tecnologia', 'innovazione'] });
  });

  it('riconosce keyword in inglese', () => {
    const risultato = classifica('Call for artificial intelligence projects', '', keywords);
    expect(risultato.priorita).toBe('da_verificare');
  });

  it('scarta se non trova nessuna keyword', () => {
    const risultato = classifica('Bando per la ristrutturazione edilizia', 'Contributi per facciate', keywords);
    expect(risultato).toEqual({ priorita: null, scartato: true, paroleTrovate: [] });
  });

  it('da priorita alta anche se e presente anche una keyword di livello 2', () => {
    const risultato = classifica('Bando fintech e innovazione', '', keywords);
    expect(risultato.priorita).toBe('alta');
  });

  it('elenca tutte le parole di livello 1 trovate, non solo la prima', () => {
    const risultato = classifica('Bando fintech per il gaming', '', keywords);
    expect(risultato.paroleTrovate).toEqual(['gaming', 'fintech']);
  });

  it('non elenca parole di livello 2 quando ne ha gia trovata una di livello 1', () => {
    const risultato = classifica('Bando fintech e innovazione', '', keywords);
    expect(risultato.paroleTrovate).toEqual(['fintech']);
  });
});
