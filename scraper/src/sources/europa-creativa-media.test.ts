import { describe, expect, it } from 'vitest';
import { creaEuropaCreativaMediaScraper } from './europa-creativa-media.js';
import {
  FIXTURE_CATEGORIA_CON_BANDO,
  FIXTURE_CATEGORIA_SENZA_BANDI,
  FIXTURE_DETTAGLIO,
} from './europa-creativa-media.fixtures.js';

describe('scraper Europa Creativa MEDIA', () => {
  it('estrae un bando aperto, ignora quelli chiusi, e usa la scadenza più recente', async () => {
    const fetchHtmlFinto = async (url: string): Promise<string> => {
      if (url.endsWith('/sostegni-finanziari/videogame')) return FIXTURE_CATEGORIA_CON_BANDO;
      if (url.endsWith('/test-bando-videogame-2026')) return FIXTURE_DETTAGLIO;
      return FIXTURE_CATEGORIA_SENZA_BANDI;
    };

    const scraper = creaEuropaCreativaMediaScraper(fetchHtmlFinto);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(1);
    expect(risultati[0]).toMatchObject({
      fonte: 'europa-creativa-media',
      titolo: 'Test bando videogame 2026',
      url: 'https://www.europacreativa-media.it/bandi/test-bando-videogame-2026',
      scadenza: '2026-05-07',
      data_pubblicazione: null,
    });
    expect(risultati[0].descrizione).toContain('budget');
    expect(risultati[0].descrizione).toContain('obiettivi');
  });

  it('non genera errori quando una categoria non ha bandi aperti', async () => {
    const fetchHtmlFinto = async () => FIXTURE_CATEGORIA_SENZA_BANDI;
    const scraper = creaEuropaCreativaMediaScraper(fetchHtmlFinto);
    const risultati = await scraper.scrape();
    expect(risultati).toHaveLength(0);
  });
});
