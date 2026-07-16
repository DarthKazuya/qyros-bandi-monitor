import { describe, expect, it } from 'vitest';
import { creaIncentiviGovScraper } from './incentivi-gov.js';
import { FIXTURE_RISPOSTA } from './incentivi-gov.fixtures.js';

describe('scraper incentivi.gov.it', () => {
  it('include i bandi ancora aperti e quelli senza scadenza, esclude quelli scaduti', async () => {
    const fetchApiFinto = async () => FIXTURE_RISPOSTA;
    const scraper = creaIncentiviGovScraper(fetchApiFinto);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(2);
    expect(risultati.map((r) => r.titolo)).toEqual([
      'Bando aperto di test gaming',
      'Bando a sportello senza scadenza',
    ]);
  });

  it('estrae correttamente url, scadenza e descrizione per un bando aperto', async () => {
    const fetchApiFinto = async () => FIXTURE_RISPOSTA;
    const scraper = creaIncentiviGovScraper(fetchApiFinto);
    const risultati = await scraper.scrape();

    expect(risultati[0]).toMatchObject({
      fonte: 'incentivi-gov',
      titolo: 'Bando aperto di test gaming',
      url: 'https://www.incentivi.gov.it/it/catalogo/bando-aperto-test',
      scadenza: '2099-12-31',
      data_pubblicazione: null,
    });
    expect(risultati[0].hash_contenuto).toMatch(/^[a-f0-9]{64}$/);
  });

  it('imposta scadenza a null per i bandi senza close_date', async () => {
    const fetchApiFinto = async () => FIXTURE_RISPOSTA;
    const scraper = creaIncentiviGovScraper(fetchApiFinto);
    const risultati = await scraper.scrape();

    expect(risultati[1].scadenza).toBeNull();
  });
});
