import { describe, expect, it } from 'vitest';
import { creaRegioneLombardiaScraper } from './regione-lombardia.js';
import {
  FIXTURE_DETTAGLIO_CON_PUBBLICAZIONE,
  FIXTURE_DETTAGLIO_SENZA_PUBBLICAZIONE,
  FIXTURE_LISTA_PAGINA1,
  FIXTURE_LISTA_PAGINA1_DI_2,
  FIXTURE_RICERCA_PAGINA2,
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

  it('legge anche la pagina 2 via POST quando maxPageNum è maggiore di 1, con i parametri corretti', async () => {
    let corpoRicevutoPagina2: string | undefined;

    const fetchPaginaFinto = async (richiesta: { metodo: string; url: string; corpo?: string }): Promise<string> => {
      if (richiesta.metodo === 'GET' && richiesta.url.endsWith('/servizi/servizio/bandi')) {
        return FIXTURE_LISTA_PAGINA1_DI_2;
      }
      if (richiesta.metodo === 'POST' && richiesta.url.endsWith('/servizi/servizio/bandi/ricerca')) {
        corpoRicevutoPagina2 = richiesta.corpo;
        return FIXTURE_RICERCA_PAGINA2;
      }
      if (richiesta.url.endsWith('/bando-pagina-1') || richiesta.url.endsWith('/bando-pagina-2')) {
        return FIXTURE_DETTAGLIO_SENZA_PUBBLICAZIONE;
      }
      throw new Error(`Richiesta non attesa nel test: ${richiesta.metodo} ${richiesta.url}`);
    };

    const scraper = creaRegioneLombardiaScraper(fetchPaginaFinto);
    const risultati = await scraper.scrape();

    expect(risultati.map((r) => r.titolo)).toEqual(['Bando di pagina uno', 'Bando di pagina due']);
    expect(corpoRicevutoPagina2).toBeDefined();
    const parametri = new URLSearchParams(corpoRicevutoPagina2);
    expect(parametri.get('pageNum')).toBe('2');
    expect(parametri.get('maxPageNum')).toBe('2');
    expect(parametri.get('targetStr')).toBe('ALL');
    expect(parametri.get('ricercaAvanzata')).toBe('false');
  });
});
