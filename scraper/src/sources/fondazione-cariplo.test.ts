import { describe, expect, it } from 'vitest';
import { creaCariploScraper } from './fondazione-cariplo.js';
import {
  FIXTURE_DETTAGLIO_DUE_FASI,
  FIXTURE_DETTAGLIO_SENZA_SCADENZA,
  FIXTURE_DETTAGLIO_UNA_FASE,
  FIXTURE_REST_API,
} from './fondazione-cariplo.fixtures.js';

const nessunaAttesa = async () => {};

describe('scraper Fondazione Cariplo', () => {
  it('estrae titolo, descrizione OBIETTIVO, scadenza e data pubblicazione per un bando normale', async () => {
    const fetchFinto = async (url: string): Promise<string> => {
      if (url.includes('/wp-json/')) return FIXTURE_REST_API;
      if (url.includes('test-bando-obiettivo')) return FIXTURE_DETTAGLIO_UNA_FASE;
      if (url.includes('test-bando-telethon-style')) return FIXTURE_DETTAGLIO_DUE_FASI;
      throw new Error(`URL non atteso nel test: ${url}`);
    };

    const scraper = creaCariploScraper(fetchFinto, nessunaAttesa);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(2);
    expect(risultati[0]).toMatchObject({
      fonte: 'fondazione-cariplo',
      titolo: 'Test Bando con Obiettivo',
      url: 'https://www.fondazionecariplo.it/bando/test-bando-obiettivo/',
      scadenza: '2026-07-23',
      data_pubblicazione: '2026-04-08',
    });
    expect(risultati[0].descrizione).toContain('gaming');
  });

  it('usa il primo paragrafo come descrizione di fallback quando manca OBIETTIVO (caso Telethon), e decodifica le entità HTML nel titolo', async () => {
    const fetchFinto = async (url: string): Promise<string> => {
      if (url.includes('/wp-json/')) return FIXTURE_REST_API;
      if (url.includes('test-bando-obiettivo')) return FIXTURE_DETTAGLIO_UNA_FASE;
      if (url.includes('test-bando-telethon-style')) return FIXTURE_DETTAGLIO_DUE_FASI;
      throw new Error(`URL non atteso nel test: ${url}`);
    };

    const scraper = creaCariploScraper(fetchFinto, nessunaAttesa);
    const risultati = await scraper.scrape();

    expect(risultati[1].titolo).toBe('Test Bando – Stile Telethon');
    expect(risultati[1].descrizione).toBe('Testo di fallback senza intestazione OBIETTIVO.');
    expect(risultati[1].scadenza).toBe('2027-03-25');
  });

  it('restituisce scadenza null quando tutti i blocchi sono "senza scadenza"', async () => {
    const fetchFinto = async (url: string): Promise<string> => {
      if (url.includes('/wp-json/')) return FIXTURE_REST_API;
      return FIXTURE_DETTAGLIO_SENZA_SCADENZA;
    };

    const scraper = creaCariploScraper(fetchFinto, nessunaAttesa);
    const risultati = await scraper.scrape();
    expect(risultati.every((r) => r.scadenza === null)).toBe(true);
  });
});
