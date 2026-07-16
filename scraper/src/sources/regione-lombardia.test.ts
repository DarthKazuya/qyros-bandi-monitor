import { describe, expect, it } from 'vitest';
import { creaRegioneLombardiaScraper } from './regione-lombardia.js';
import {
  FIXTURE_DETTAGLIO_CON_PUBBLICAZIONE,
  FIXTURE_DETTAGLIO_SENZA_PUBBLICAZIONE,
  FIXTURE_LISTA_PAGINA1,
} from './regione-lombardia.fixtures.js';

describe('scraper Regione Lombardia', () => {
  it('estrae titolo non troncato, scadenza dalla lista e data di pubblicazione dal dettaglio', async () => {
    const fetchPaginaFinto = async (richiesta: { metodo: string; url: string }): Promise<string> => {
      if (richiesta.url.endsWith('/servizi/servizio/bandi')) return FIXTURE_LISTA_PAGINA1;
      if (richiesta.url.endsWith('/bando-test-1')) return FIXTURE_DETTAGLIO_CON_PUBBLICAZIONE;
      if (richiesta.url.endsWith('/bando-test-2')) return FIXTURE_DETTAGLIO_SENZA_PUBBLICAZIONE;
      throw new Error(`Richiesta non attesa nel test: ${richiesta.url}`);
    };

    const scraper = creaRegioneLombardiaScraper(fetchPaginaFinto);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(2);
    expect(risultati[0]).toMatchObject({
      fonte: 'regione-lombardia',
      titolo: 'Titolo completo non troncato del primo bando di test per il settore fintech',
      url: 'https://www.bandi.regione.lombardia.it/servizi/servizio/bandi/dettaglio/test/bando-test-1',
      scadenza: '2099-12-31',
      data_pubblicazione: '2026-06-15',
    });
    expect(risultati[0].descrizione).toBe('Descrizione estesa dalla pagina di dettaglio del primo bando.');
  });

  it('imposta data_pubblicazione a null quando il campo pubblicazione è assente nel dettaglio', async () => {
    const fetchPaginaFinto = async (richiesta: { metodo: string; url: string }): Promise<string> => {
      if (richiesta.url.endsWith('/servizi/servizio/bandi')) return FIXTURE_LISTA_PAGINA1;
      if (richiesta.url.endsWith('/bando-test-1')) return FIXTURE_DETTAGLIO_CON_PUBBLICAZIONE;
      if (richiesta.url.endsWith('/bando-test-2')) return FIXTURE_DETTAGLIO_SENZA_PUBBLICAZIONE;
      throw new Error(`Richiesta non attesa nel test: ${richiesta.url}`);
    };

    const scraper = creaRegioneLombardiaScraper(fetchPaginaFinto);
    const risultati = await scraper.scrape();
    expect(risultati[1].data_pubblicazione).toBeNull();
  });
});
