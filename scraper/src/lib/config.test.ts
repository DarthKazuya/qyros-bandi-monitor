import { describe, expect, it } from 'vitest';
import { caricaKeywords, caricaSchedule, caricaSources } from './config.js';

interface RisultatoFinto {
  data?: unknown;
  error?: { message: string } | null;
}

function creaClienteFinto(risultatiPerTabella: Record<string, RisultatoFinto>): any {
  return {
    from(tabella: string) {
      const risultato = risultatiPerTabella[tabella] ?? { data: null, error: null };
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        single: async () => ({ data: risultato.data ?? null, error: risultato.error ?? null }),
        then(resolve: (v: { data: unknown; error: unknown }) => void) {
          resolve({ data: risultato.data ?? null, error: risultato.error ?? null });
        },
      };
      return builder;
    },
  };
}

describe('caricaKeywords', () => {
  it('legge da Supabase quando è passato un client, dividendo per livello', async () => {
    const client = creaClienteFinto({
      parole_chiave: {
        data: [
          { parola: 'gaming', livello: 'livello1' },
          { parola: 'startup', livello: 'livello2' },
          { parola: 'fintech', livello: 'livello1' },
        ],
        error: null,
      },
    });

    const keywords = await caricaKeywords(client);
    expect(keywords.livello1).toEqual(['gaming', 'fintech']);
    expect(keywords.livello2).toEqual(['startup']);
  });

  it('lancia un errore se Supabase restituisce un errore', async () => {
    const client = creaClienteFinto({
      parole_chiave: { data: null, error: { message: 'connessione fallita' } },
    });

    await expect(caricaKeywords(client)).rejects.toThrow('connessione fallita');
  });

  it('legge dal file locale quando il client è null (ripiego senza credenziali)', async () => {
    const keywords = await caricaKeywords(null);
    expect(keywords.livello1).toContain('gaming');
    expect(keywords.livello2).toContain('startup');
  });
});

describe('caricaSchedule', () => {
  it('legge da Supabase quando è passato un client', async () => {
    const client = creaClienteFinto({
      impostazioni_job: { data: { ora: 9, fuso_orario: 'Europe/Rome' }, error: null },
    });

    const schedule = await caricaSchedule(client);
    expect(schedule).toEqual({ ora: 9, timezone: 'Europe/Rome' });
  });

  it('lancia un errore se Supabase restituisce un errore', async () => {
    const client = creaClienteFinto({
      impostazioni_job: { data: null, error: { message: 'riga non trovata' } },
    });

    await expect(caricaSchedule(client)).rejects.toThrow('riga non trovata');
  });

  it('legge dal file locale quando il client è null (ripiego senza credenziali)', async () => {
    const schedule = await caricaSchedule(null);
    expect(schedule.ora).toBe(8);
    expect(schedule.timezone).toBe('Europe/Rome');
  });
});

describe('caricaSources', () => {
  it('carica le fonti dal file reale, con almeno EIT attiva', () => {
    const fonti = caricaSources();
    const eit = fonti.find((f) => f.id === 'eit');
    expect(eit).toBeDefined();
    expect(eit?.attivo).toBe(true);
  });
});
