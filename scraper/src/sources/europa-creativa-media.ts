import axios from 'axios';
import * as cheerio from 'cheerio';
import { calcolaHash } from '../lib/hash.js';
import type { BandoRaw, Scraper } from '../lib/types.js';

const BASE_URL = 'https://www.europacreativa-media.it';
const CATEGORIE = [
  'sostegno-ai-produttori',
  'videogame',
  'talents-and-skills',
  'markets-and-networking',
  'innovative-tools-and-business-models',
  'media-360',
  'european-festivals',
  'sostegno-alla-distribuzione-cinematografica',
  'european-vod-networks-and-operators',
  'audience-development-and-film-education',
  'network-of-the-european-cinemas',
  'network-of-european-festivals',
];

const MESI_IT: Record<string, string> = {
  gen: '01', feb: '02', mar: '03', apr: '04', mag: '05', giu: '06',
  lug: '07', ago: '08', set: '09', ott: '10', nov: '11', dic: '12',
};

export type FetchHtml = (url: string) => Promise<string>;

async function fetchHtmlReale(url: string): Promise<string> {
  const { data } = await axios.get<string>(url);
  return data;
}

function trovaLinkAperti($: ReturnType<typeof cheerio.load>): string[] {
  const link: string[] = [];
  $('.widget-recent-posts').each((_, widget) => {
    const header = $(widget).find('.sidebar-widget-title h4').text().trim().toLowerCase();
    if (!header.includes('aperti')) return;
    if ($(widget).find('p.bandoChiuso').length > 0) return;

    $(widget).find('li.clearfix').each((_, li) => {
      const a = $(li).find('.widget-blog-content > a[href^="/bandi/"]').first();
      const href = a.attr('href');
      if (href) link.push(href.startsWith('http') ? href : `${BASE_URL}${href}`);
    });
  });
  return link;
}

function parseScadenzaEcm(html: string): string | null {
  const $ = cheerio.load(html);
  const eventi = $('.widget-upcoming-events li.event-item');
  if (eventi.length === 0) return null;

  const ultimo = eventi.last();
  const giorno = ultimo.find('.event-date .date').text().trim();
  const meseAbbr = ultimo.find('.event-date .month').text().trim().toLowerCase();
  const testoAnno = ultimo.find('.event-detail .event-dayntime').text();
  const annoMatch = testoAnno.match(/(\d{4})/);

  const mese = MESI_IT[meseAbbr];
  if (!giorno || !mese || !annoMatch) return null;

  return `${annoMatch[1]}-${mese}-${giorno.padStart(2, '0')}`;
}

export function creaEuropaCreativaMediaScraper(fetchHtml: FetchHtml = fetchHtmlReale): Scraper {
  return {
    id: 'europa-creativa-media',
    async scrape(): Promise<BandoRaw[]> {
      const linkUnivoci = new Set<string>();

      for (const categoria of CATEGORIE) {
        const html = await fetchHtml(`${BASE_URL}/sostegni-finanziari/${categoria}`);
        const $ = cheerio.load(html);
        for (const link of trovaLinkAperti($)) {
          linkUnivoci.add(link);
        }
      }

      const risultati: BandoRaw[] = [];

      for (const url of linkUnivoci) {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);
        const titolo = $('h2.post-title').first().text().trim();
        const descrizione =
          $('article.post-content .event-description p')
            .map((_, p) => $(p).text().trim())
            .get()
            .join(' ')
            .trim() || titolo;
        const scadenza = parseScadenzaEcm(html);

        risultati.push({
          fonte: 'europa-creativa-media',
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

const europaCreativaMediaScraper = creaEuropaCreativaMediaScraper();
export default europaCreativaMediaScraper;
