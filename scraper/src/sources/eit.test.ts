import { describe, expect, it } from 'vitest';
import { creaEitScraper } from './eit.js';
import { FIXTURE_DETTAGLIO, FIXTURE_LISTA } from './eit.fixtures.js';

describe('scraper EIT', () => {
  it('estrae titolo, url, date e descrizione dalla lista e dal dettaglio', async () => {
    const fetchHtmlFinto = async (url: string): Promise<string> => {
      if (url === 'https://eit.europa.eu/work-with-us/procurement/calls') {
        return FIXTURE_LISTA;
      }
      if (url === 'https://eit.europa.eu/work-with-us/procurement/test-call-1') {
        return FIXTURE_DETTAGLIO;
      }
      throw new Error(`URL non atteso nel test: ${url}`);
    };

    const scraper = creaEitScraper(fetchHtmlFinto);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(1);
    expect(risultati[0]).toMatchObject({
      fonte: 'eit',
      titolo: 'Test Call One',
      url: 'https://eit.europa.eu/work-with-us/procurement/test-call-1',
      scadenza: '2026-01-23',
      data_pubblicazione: '2025-12-10',
    });
    expect(risultati[0].descrizione).toContain('Test description content');
    expect(risultati[0].hash_contenuto).toMatch(/^[a-f0-9]{64}$/);
  });

  it('ignora le righe della lista senza titolo (es. icone social)', async () => {
    const fetchHtmlFinto = async (url: string): Promise<string> => {
      if (url.endsWith('/calls')) return FIXTURE_LISTA;
      return FIXTURE_DETTAGLIO;
    };

    const scraper = creaEitScraper(fetchHtmlFinto);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(1);
  });
});
