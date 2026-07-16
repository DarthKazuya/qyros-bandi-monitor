import axios from 'axios';
import * as cheerio from 'cheerio';
import { calcolaHash } from '../lib/hash.js';
import type { BandoRaw, Scraper } from '../lib/types.js';

const BASE_URL = 'https://www.invitalia.it';
const STATI = [129, 130];

export type FetchHtml = (url: string) => Promise<string>;

async function fetchHtmlReale(url: string): Promise<string> {
  const { data } = await axios.get<string>(url);
  return data;
}

function urlLista(stato: number, pagina: number): string {
  return `${BASE_URL}/per-le-imprese/incentivi-e-strumenti?stato_incentivo=${stato}&page=${pagina}`;
}

function numeroTotalePagine(html: string): number {
  const match = html.match(/Pagina\s+\d+\s+di\s+(\d+)/);
  return match ? Number(match[1]) : 1;
}

function parseDataInvitalia(testo: string): string | null {
  const match = testo.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const [, giorno, mese, anno] = match;
  return `${anno}-${mese.padStart(2, '0')}-${giorno.padStart(2, '0')}`;
}

export function creaInvitaliaScraper(fetchHtml: FetchHtml = fetchHtmlReale): Scraper {
  return {
    id: 'invitalia',
    async scrape(): Promise<BandoRaw[]> {
      const urlDettaglio = new Set<string>();

      for (const stato of STATI) {
        const primaHtml = await fetchHtml(urlLista(stato, 0));
        const $prima = cheerio.load(primaHtml);
        $prima('article.card--incentivi h3 a.card-unified__title').each((_, el) => {
          const href = $prima(el).attr('href') ?? '';
          if (href) urlDettaglio.add(href.startsWith('http') ? href : `${BASE_URL}${href}`);
        });

        const totalePagine = numeroTotalePagine(primaHtml);
        for (let pagina = 1; pagina < totalePagine; pagina++) {
          const html = await fetchHtml(urlLista(stato, pagina));
          const $ = cheerio.load(html);
          $('article.card--incentivi h3 a.card-unified__title').each((_, el) => {
            const href = $(el).attr('href') ?? '';
            if (href) urlDettaglio.add(href.startsWith('http') ? href : `${BASE_URL}${href}`);
          });
        }
      }

      const risultati: BandoRaw[] = [];

      for (const url of urlDettaglio) {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);
        const titolo = $('h1.title').first().text().trim();
        const sottotitolo = $('p.subtitle').first().text().trim();
        const descrizione = sottotitolo || titolo;

        const scadenzaTesto = $('.pagetabctabox h3')
          .filter((_, el) => $(el).text().trim() === 'Data chiusura')
          .first()
          .next('p')
          .text()
          .trim();
        const scadenza = scadenzaTesto ? parseDataInvitalia(scadenzaTesto) : null;

        risultati.push({
          fonte: 'invitalia',
          titolo,
          descrizione,
          url,
          scadenza,
          data_pubblicazione: null,
          hash_contenuto: calcolaHash(titolo, descrizione),
        });
      }

      return risultati;
    },
  };
}

const invitaliaScraper = creaInvitaliaScraper();
export default invitaliaScraper;
