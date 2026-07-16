import axios from 'axios';
import * as cheerio from 'cheerio';
import { calcolaHash } from '../lib/hash.js';
import type { BandoRaw, Scraper } from '../lib/types.js';

const BASE_URL = 'https://www.bandi.regione.lombardia.it';
const LISTA_URL = `${BASE_URL}/servizi/servizio/bandi`;
const RICERCA_URL = `${BASE_URL}/servizi/servizio/bandi/ricerca`;
const MAX_PAGINE = 15;

export interface RichiestaPagina {
  metodo: 'GET' | 'POST';
  url: string;
  corpo?: string;
}

export type FetchPagina = (richiesta: RichiestaPagina) => Promise<string>;

async function fetchPaginaReale(richiesta: RichiestaPagina): Promise<string> {
  if (richiesta.metodo === 'GET') {
    const { data } = await axios.get<string>(richiesta.url);
    return data;
  }
  const { data } = await axios.post<string>(richiesta.url, richiesta.corpo, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

function parseDataSlash(testo: string): string | null {
  const match = testo.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, giorno, mese, anno] = match;
  return `${anno}-${mese}-${giorno}`;
}

interface CardEstratta {
  titolo: string;
  url: string;
  scadenza: string | null;
  descrizioneBreve: string;
}

function estraiCards($: ReturnType<typeof cheerio.load>): CardEstratta[] {
  const cards: CardEstratta[] = [];
  $('div.results-block div.card.card-bg.card-big').each((_, el) => {
    const card = $(el);
    const link = card.find('a.text-decoration-none').first();
    const titoloEl = card.find('h4.card-title').first();
    const titolo = titoloEl.attr('data-content')?.trim() || titoloEl.text().trim();
    const href = link.attr('href') ?? '';
    const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const scadenzaValue = card.find('input.checkCloseDate').attr('value') ?? '';
    const scadenza = scadenzaValue ? scadenzaValue.slice(0, 10) : null;
    const descrizioneBreve = card.find('p.card-text svg.icon-popover').attr('data-content')?.trim() ?? '';

    if (titolo && url) {
      cards.push({ titolo, url, scadenza, descrizioneBreve });
    }
  });
  return cards;
}

export function creaRegioneLombardiaScraper(fetchPagina: FetchPagina = fetchPaginaReale): Scraper {
  return {
    id: 'regione-lombardia',
    async scrape(): Promise<BandoRaw[]> {
      const primaHtml = await fetchPagina({ metodo: 'GET', url: LISTA_URL });
      const $prima = cheerio.load(primaHtml);
      const maxPageNumAttr = $prima('[data-max-page-num]').first().attr('data-max-page-num');
      const maxPageNum = maxPageNumAttr ? Number(maxPageNumAttr) : 1;
      const paginePosDaLeggere = Math.min(maxPageNum, MAX_PAGINE);

      const tutteLeCard: CardEstratta[] = estraiCards($prima);

      for (let pagina = 2; pagina <= paginePosDaLeggere; pagina++) {
        const corpo = new URLSearchParams({
          titolo: '',
          ricercaAvanzata: 'false',
          pageNum: String(pagina),
          maxPageNum: String(maxPageNum),
          targetStr: 'ALL',
          descrizione: '',
        }).toString();
        const html = await fetchPagina({ metodo: 'POST', url: RICERCA_URL, corpo });
        const $ = cheerio.load(html);
        tutteLeCard.push(...estraiCards($));
      }

      const risultati: BandoRaw[] = [];

      for (const card of tutteLeCard) {
        const dettaglioHtml = await fetchPagina({ metodo: 'GET', url: card.url });
        const $$ = cheerio.load(dettaglioHtml);
        const descrizioneMeta = $$('meta[name="description"]').attr('content')?.trim();
        const descrizione = descrizioneMeta || card.descrizioneBreve || card.titolo;

        const pubblicazioneTesto = $$('strong[data-entity="pubblicazione"]').first().text().trim();
        const dataPubblicazione = pubblicazioneTesto ? parseDataSlash(pubblicazioneTesto) : null;

        risultati.push({
          fonte: 'regione-lombardia',
          titolo: card.titolo,
          descrizione,
          url: card.url,
          scadenza: card.scadenza,
          data_pubblicazione: dataPubblicazione,
          hash_contenuto: calcolaHash(card.titolo, descrizione),
        });
      }

      return risultati;
    },
  };
}

const regioneLombardiaScraper = creaRegioneLombardiaScraper();
export default regioneLombardiaScraper;
