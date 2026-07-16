import axios from 'axios';
import * as cheerio from 'cheerio';
import { calcolaHash } from '../lib/hash.js';
import type { BandoRaw, Scraper } from '../lib/types.js';

const BASE_URL = 'https://eit.europa.eu';
const LIST_URL = `${BASE_URL}/work-with-us/procurement/calls`;

export type FetchHtml = (url: string) => Promise<string>;

async function fetchHtmlReale(url: string): Promise<string> {
  const { data } = await axios.get<string>(url);
  return data;
}

function parseDataEtichettata(testo: string): string | null {
  const match = testo.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, giorno, mese, anno] = match;
  return `${anno}-${mese}-${giorno}`;
}

export function creaEitScraper(fetchHtml: FetchHtml = fetchHtmlReale): Scraper {
  return {
    id: 'eit',
    async scrape(): Promise<BandoRaw[]> {
      const listaHtml = await fetchHtml(LIST_URL);
      const $ = cheerio.load(listaHtml);
      const righe = $('.views-row').toArray().filter((el) => $(el).find('.views-field-title a').length > 0);

      const risultati: BandoRaw[] = [];

      for (const riga of righe) {
        const link = $(riga).find('.views-field-title a').first();
        const titolo = link.text().trim();
        const href = link.attr('href') ?? '';
        const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;

        const dettaglioHtml = await fetchHtml(url);
        const $$ = cheerio.load(dettaglioHtml);
        const descrizione = $$('.field--name-body').first().text().trim().replace(/\s+/g, ' ');
        const dataPubblicazione = parseDataEtichettata(
          $$('.field--name-field-eit-proc-publication-date .field__item').first().text().trim()
        );
        const scadenza = parseDataEtichettata(
          $$('.field--name-field-eit-proc-app-deadline .field__item').first().text().trim()
        );

        risultati.push({
          fonte: 'eit',
          titolo,
          descrizione,
          url,
          scadenza,
          data_pubblicazione: dataPubblicazione,
          hash_contenuto: calcolaHash(titolo, descrizione),
        });
      }

      return risultati;
    },
  };
}

const eitScraper = creaEitScraper();
export default eitScraper;
