import axios from 'axios';
import * as cheerio from 'cheerio';
import FormData from 'form-data';
import { calcolaHash } from '../lib/hash.js';
import type { BandoRaw, Scraper } from '../lib/types.js';

const SEARCH_URL = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=***&pageSize=1000&pageNumber=1';

export type FetchApi = () => Promise<string>;

async function fetchApiReale(): Promise<string> {
  const form = new FormData();
  form.append(
    'query',
    JSON.stringify({
      bool: {
        must: [
          { terms: { type: ['1', '2', '8'] } },
          { terms: { status: ['31094501', '31094502'] } },
          { terms: { DATASOURCE: ['SEDIA'] } },
          { terms: { language: ['en'] } },
        ],
      },
    }),
    { contentType: 'application/json' }
  );
  form.append('languages', JSON.stringify(['en']), { contentType: 'application/json' });
  form.append('sort', JSON.stringify({ order: 'DESC', field: 'startDate' }), { contentType: 'application/json' });
  form.append(
    'displayFields',
    JSON.stringify(['title', 'identifier', 'status', 'startDate', 'deadlineDate', 'deadlineModel', 'descriptionByte']),
    { contentType: 'application/json' }
  );

  const { data } = await axios.post(SEARCH_URL, form, { headers: form.getHeaders() });
  return typeof data === 'string' ? data : JSON.stringify(data);
}

function pulisciDescrizione(html: string): string {
  return cheerio.load(html).text().trim().replace(/\s+/g, ' ');
}

interface RisultatoSedia {
  url: string;
  metadata: {
    title?: string[];
    deadlineDate?: string[];
    descriptionByte?: string[];
  };
}

interface RispostaSedia {
  results: RisultatoSedia[];
}

export function creaEuPortalScraper(fetchApi: FetchApi = fetchApiReale): Scraper {
  return {
    id: 'eu-portal',
    async scrape(): Promise<BandoRaw[]> {
      const corpo = await fetchApi();
      const risposta = JSON.parse(corpo) as RispostaSedia;

      return risposta.results.map((risultato) => {
        const titolo = risultato.metadata.title?.[0] ?? '';
        const descrizioneHtml = risultato.metadata.descriptionByte?.[0];
        const descrizione = descrizioneHtml ? pulisciDescrizione(descrizioneHtml) : titolo;
        const scadenzaIso = risultato.metadata.deadlineDate?.[0];

        return {
          fonte: 'eu-portal',
          titolo,
          descrizione,
          url: risultato.url,
          scadenza: scadenzaIso ? scadenzaIso.slice(0, 10) : null,
          data_pubblicazione: null,
          hash_contenuto: calcolaHash(titolo, descrizione),
        };
      });
    },
  };
}

const euPortalScraper = creaEuPortalScraper();
export default euPortalScraper;
