import { describe, expect, it } from 'vitest';
import { creaEuPortalScraper } from './eu-portal.js';
import { FIXTURE_RISPOSTA } from './eu-portal.fixtures.js';

describe('scraper EU Funding & Tenders Portal', () => {
  it('estrae titolo, url, scadenza e descrizione dalla risposta API', async () => {
    const fetchApiFinto = async () => FIXTURE_RISPOSTA;
    const scraper = creaEuPortalScraper(fetchApiFinto);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(2);
    expect(risultati[0]).toMatchObject({
      fonte: 'eu-portal',
      titolo: 'Test call for gaming innovation',
      url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/TEST-CALL-01',
      scadenza: '2026-12-31',
      data_pubblicazione: null,
    });
    expect(risultati[0].descrizione).toContain('gaming');
    expect(risultati[0].hash_contenuto).toMatch(/^[a-f0-9]{64}$/);
  });

  it('usa il titolo come descrizione di fallback se descriptionByte è assente', async () => {
    const fetchApiFinto = async () => FIXTURE_RISPOSTA;
    const scraper = creaEuPortalScraper(fetchApiFinto);
    const risultati = await scraper.scrape();

    expect(risultati[1].descrizione).toBe('Test call without description');
  });
});
