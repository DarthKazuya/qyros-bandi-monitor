import { describe, expect, it } from 'vitest';
import { eseguiRaccolta } from './orchestrator.js';
import { creaDbPortFake } from './db-port-fake.js';
import { calcolaHash } from './hash.js';
import type { BandoRaw, Keywords, Scraper } from './types.js';

const keywords: Keywords = {
  livello1: ['gaming'],
  livello2: ['innovazione'],
};

function creaBando(overrides: Partial<BandoRaw> = {}): BandoRaw {
  const titolo = overrides.titolo ?? 'Bando gaming 2026';
  const descrizione = overrides.descrizione ?? 'Descrizione';
  return {
    fonte: 'fonte-test',
    titolo,
    descrizione,
    url: 'https://esempio.it/bando-1',
    scadenza: null,
    data_pubblicazione: null,
    hash_contenuto: calcolaHash(titolo, descrizione),
    ...overrides,
  };
}

describe('eseguiRaccolta', () => {
  it('salva un nuovo bando rilevante e lo segnala tra i nuovi match', async () => {
    const stato = creaDbPortFake();
    const scraperOk: Scraper = { id: 'fonte-test', scrape: async () => [creaBando()] };

    const risultato = await eseguiRaccolta([scraperOk], keywords, stato.db);

    expect(stato.salvati).toHaveLength(1);
    expect(stato.salvati[0].priorita).toBe('alta');
    expect(risultato.nuoviBandiRilevanti).toHaveLength(1);
    expect(risultato.fontiOk).toEqual(['fonte-test']);
    expect(risultato.fontiFallite).toEqual([]);
  });

  it('salva ma non segnala come nuovo match un bando scartato (nessuna keyword)', async () => {
    const stato = creaDbPortFake();
    const bandoScartato = creaBando({ titolo: 'Bando ristrutturazione facciate', descrizione: '' });
    const scraperOk: Scraper = { id: 'fonte-test', scrape: async () => [bandoScartato] };

    const risultato = await eseguiRaccolta([scraperOk], keywords, stato.db);

    expect(stato.salvati).toHaveLength(1);
    expect(stato.salvati[0].scartato).toBe(true);
    expect(risultato.nuoviBandiRilevanti).toHaveLength(0);
  });

  it('isola l\'errore di una fonte e continua con le altre', async () => {
    const stato = creaDbPortFake();
    const scraperOk: Scraper = { id: 'fonte-ok', scrape: async () => [creaBando({ url: 'https://esempio.it/ok' })] };
    const scraperRotto: Scraper = {
      id: 'fonte-rotta',
      scrape: async () => {
        throw new Error('la struttura HTML e cambiata');
      },
    };

    const risultato = await eseguiRaccolta([scraperRotto, scraperOk], keywords, stato.db);

    expect(risultato.fontiOk).toEqual(['fonte-ok']);
    expect(risultato.fontiFallite).toEqual([{ fonte: 'fonte-rotta', errore: 'la struttura HTML e cambiata' }]);
    expect(stato.salvati).toHaveLength(1);
  });

  it('non salva di nuovo un bando gia visto con lo stesso hash (skip)', async () => {
    const stato = creaDbPortFake();
    const bando = creaBando();
    const scraper: Scraper = { id: 'fonte-test', scrape: async () => [bando] };

    await eseguiRaccolta([scraper], keywords, stato.db);
    const secondoRisultato = await eseguiRaccolta([scraper], keywords, stato.db);

    expect(stato.salvati).toHaveLength(1);
    expect(secondoRisultato.nuoviBandiRilevanti).toHaveLength(0);
  });

  it('registra l\'esito del job nel db', async () => {
    const stato = creaDbPortFake();
    const scraperOk: Scraper = { id: 'fonte-test', scrape: async () => [creaBando()] };

    await eseguiRaccolta([scraperOk], keywords, stato.db);

    expect(stato.ultimoEsito).toEqual({ fontiOk: ['fonte-test'], fontiFallite: [], nuoviBandi: 1 });
  });

  it('aggiorna un bando esistente con contenuto diverso e non lo segnala come nuovo match', async () => {
    const stato = creaDbPortFake();
    const bandoOriginal = creaBando();
    const scraper1: Scraper = { id: 'fonte-test', scrape: async () => [bandoOriginal] };

    // Prima esecuzione: salva il bando
    await eseguiRaccolta([scraper1], keywords, stato.db);

    // Seconda esecuzione: stesso bando ma con contenuto diverso (titolo diverso = hash diverso)
    const bandoAggiornato = creaBando({
      titolo: 'Bando gaming 2027 - NEW TITLE',
      descrizione: 'Descrizione aggiornata',
    });
    const scraper2: Scraper = { id: 'fonte-test', scrape: async () => [bandoAggiornato] };

    const risultatoUpdate = await eseguiRaccolta([scraper2], keywords, stato.db);

    expect(stato.aggiornati).toHaveLength(1);
    expect(stato.aggiornati[0].titolo).toBe('Bando gaming 2027 - NEW TITLE');
    expect(risultatoUpdate.nuoviBandiRilevanti).toHaveLength(0);
  });
});
