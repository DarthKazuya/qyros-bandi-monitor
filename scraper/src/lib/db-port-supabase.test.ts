import { describe, expect, it } from 'vitest';
import { creaDbPortSupabase } from './db-port-supabase.js';
import type { BandoRaw } from './types.js';

interface RisultatoFinto {
  data?: unknown;
  error?: { message: string } | null;
}

function creaBuilderFinto(risultato: RisultatoFinto) {
  const builder: any = {
    eq: () => builder,
    select: () => builder,
    insert: (valori: unknown) => {
      builder.ultimoInsert = valori;
      return builder;
    },
    update: (valori: unknown) => {
      builder.ultimoUpdate = valori;
      return builder;
    },
    maybeSingle: async () => ({ data: risultato.data ?? null, error: risultato.error ?? null }),
    then(resolve: (v: { data: unknown; error: unknown }) => void) {
      resolve({ data: risultato.data ?? null, error: risultato.error ?? null });
    },
  };
  return builder;
}

function creaClienteFinto(risultatiPerTabella: Record<string, RisultatoFinto>) {
  const buildersCreati: Record<string, ReturnType<typeof creaBuilderFinto>> = {};
  const client: any = {
    from(tabella: string) {
      const builder = creaBuilderFinto(risultatiPerTabella[tabella] ?? {});
      buildersCreati[tabella] = builder;
      return builder;
    },
  };
  return { client, buildersCreati };
}

function creaBando(overrides: Partial<BandoRaw> = {}): BandoRaw {
  return {
    fonte: 'eit',
    titolo: 'Bando di test',
    descrizione: 'Descrizione di test',
    url: 'https://esempio.it/bando-test',
    scadenza: '2026-12-31',
    data_pubblicazione: null,
    hash_contenuto: 'abc123',
    ...overrides,
  };
}

describe('creaDbPortSupabase', () => {
  it('trovaEsistente restituisce null quando non trova righe', async () => {
    const { client } = creaClienteFinto({ bandi: { data: null, error: null } });
    const db = creaDbPortSupabase(client);

    const risultato = await db.trovaEsistente('eit', 'https://esempio.it/bando-test');

    expect(risultato).toBeNull();
  });

  it('trovaEsistente restituisce hash_contenuto quando trova una riga', async () => {
    const { client } = creaClienteFinto({ bandi: { data: { hash_contenuto: 'xyz789' }, error: null } });
    const db = creaDbPortSupabase(client);

    const risultato = await db.trovaEsistente('eit', 'https://esempio.it/bando-test');

    expect(risultato).toEqual({ hash_contenuto: 'xyz789' });
  });

  it('inserisciBando invia tutti i campi corretti alla tabella bandi', async () => {
    const { client, buildersCreati } = creaClienteFinto({ bandi: { error: null } });
    const db = creaDbPortSupabase(client);

    await db.inserisciBando(creaBando(), 'alta', false);

    expect(buildersCreati.bandi.ultimoInsert).toMatchObject({
      fonte: 'eit',
      titolo: 'Bando di test',
      url: 'https://esempio.it/bando-test',
      priorita: 'alta',
      scartato: false,
      hash_contenuto: 'abc123',
    });
  });

  it('lancia un errore descrittivo quando Supabase restituisce un errore', async () => {
    const { client } = creaClienteFinto({ bandi: { error: { message: 'connessione rifiutata' } } });
    const db = creaDbPortSupabase(client);

    await expect(db.inserisciBando(creaBando(), 'alta', false)).rejects.toThrow('connessione rifiutata');
  });

  it('registraEsitoJob invia fonti_ok, fonti_fallite e nuovi_bandi alla tabella job_run_log', async () => {
    const { client, buildersCreati } = creaClienteFinto({ job_run_log: { error: null } });
    const db = creaDbPortSupabase(client);

    await db.registraEsitoJob(['eit'], [{ fonte: 'invitalia', errore: 'timeout' }], 3);

    expect(buildersCreati.job_run_log.ultimoInsert).toEqual({
      fonti_ok: ['eit'],
      fonti_fallite: [{ fonte: 'invitalia', errore: 'timeout' }],
      nuovi_bandi: 3,
    });
  });

  it('aggiornaBando invia i campi aggiornati (senza fonte/url, usati solo per il filtro) alla tabella bandi', async () => {
    const { client, buildersCreati } = creaClienteFinto({ bandi: { error: null } });
    const db = creaDbPortSupabase(client);

    await db.aggiornaBando('eit', 'https://esempio.it/bando-test', creaBando({ titolo: 'Titolo aggiornato' }));

    expect(buildersCreati.bandi.ultimoUpdate).toMatchObject({
      titolo: 'Titolo aggiornato',
      hash_contenuto: 'abc123',
    });
    expect(buildersCreati.bandi.ultimoUpdate).toHaveProperty('aggiornato_il');
  });
});
