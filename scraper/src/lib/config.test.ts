import { describe, expect, it } from 'vitest';
import { caricaKeywords, caricaSchedule, caricaSources } from './config.js';

describe('config loader', () => {
  it('carica le keyword di livello 1 e livello 2 dal file reale', () => {
    const keywords = caricaKeywords();
    expect(keywords.livello1).toContain('gaming');
    expect(keywords.livello2).toContain('startup');
  });

  it('carica le fonti dal file reale, con almeno EIT attiva', () => {
    const fonti = caricaSources();
    const eit = fonti.find((f) => f.id === 'eit');
    expect(eit).toBeDefined();
    expect(eit?.attivo).toBe(true);
  });

  it('carica la configurazione dello schedule dal file reale', () => {
    const schedule = caricaSchedule();
    expect(schedule.ora).toBe(8);
    expect(schedule.timezone).toBe('Europe/Rome');
  });
});
