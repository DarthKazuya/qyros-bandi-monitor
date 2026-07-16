import { describe, expect, it } from 'vitest';
import { creaInvitaliaScraper } from './invitalia.js';
import { FIXTURE_DETTAGLIO_CON_SCADENZA, FIXTURE_DETTAGLIO_SENZA_SCADENZA, FIXTURE_LISTA } from './invitalia.fixtures.js';

describe('scraper Invitalia', () => {
  it('estrae titolo, descrizione e scadenza per un incentivo con data chiusura', async () => {
    const fetchHtmlFinto = async (url: string): Promise<string> => {
      if (url.includes('stato_incentivo=')) return FIXTURE_LISTA;
      if (url.endsWith('/test-incentivo-1')) return FIXTURE_DETTAGLIO_CON_SCADENZA;
      if (url.endsWith('/test-incentivo-2')) return FIXTURE_DETTAGLIO_SENZA_SCADENZA;
      throw new Error(`URL non atteso nel test: ${url}`);
    };

    const scraper = creaInvitaliaScraper(fetchHtmlFinto);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(2);
    const uno = risultati.find((r) => r.titolo === 'Test Incentivo Uno');
    expect(uno).toMatchObject({
      fonte: 'invitalia',
      descrizione: 'Incentivo di test per il settore gaming',
      scadenza: '2026-09-15',
      data_pubblicazione: null,
    });
  });

  it('imposta scadenza a null quando la sezione Data chiusura è assente', async () => {
    const fetchHtmlFinto = async (url: string): Promise<string> => {
      if (url.includes('stato_incentivo=')) return FIXTURE_LISTA;
      if (url.endsWith('/test-incentivo-1')) return FIXTURE_DETTAGLIO_CON_SCADENZA;
      if (url.endsWith('/test-incentivo-2')) return FIXTURE_DETTAGLIO_SENZA_SCADENZA;
      throw new Error(`URL non atteso nel test: ${url}`);
    };

    const scraper = creaInvitaliaScraper(fetchHtmlFinto);
    const risultati = await scraper.scrape();
    const due = risultati.find((r) => r.titolo === 'Test Incentivo Due');
    expect(due?.scadenza).toBeNull();
  });
});
