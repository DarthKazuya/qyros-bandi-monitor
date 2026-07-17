import { chromium, type Browser, type Page } from 'playwright';
import * as cheerio from 'cheerio';
import { calcolaHash } from '../lib/hash.js';
import type { BandoRaw, Scraper } from '../lib/types.js';

const BASE_URL = 'https://www.fondazionecariplo.it';
const REST_API_URL = `${BASE_URL}/wp-json/wp/v2/bando?per_page=100`;
const RITARDO_TRA_RICHIESTE_MS = 400;

export type FetchHtml = (url: string) => Promise<string>;
export type FunzioneAttesa = (ms: number) => Promise<void>;

const attesaReale: FunzioneAttesa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let browserCondiviso: Browser | null = null;
let paginaCondivisa: Page | null = null;

async function ottieniPagina(): Promise<Page> {
  if (paginaCondivisa) return paginaCondivisa;
  // headless: false è necessario qui, non opzionale: verificato che la modalità
  // headless di Chromium viene bloccata dalla sfida Cloudflare di questo sito
  // (torna sempre la pagina "Just a moment..."), mentre lo stesso browser in
  // modalità normale (nessuna manomissione di navigator.webdriver o di altri
  // segnali di automazione) la supera regolarmente. In Fase 3, per l'esecuzione
  // su GitHub Actions (che non ha un display), servirà un display virtuale
  // (es. xvfb-run) per eseguire questo scraper in modalità "headed".
  browserCondiviso = await chromium.launch({
    headless: false,
  });
  paginaCondivisa = await browserCondiviso.newPage();
  return paginaCondivisa;
}

export async function chiudiBrowserSeAperto(): Promise<void> {
  if (browserCondiviso) {
    await browserCondiviso.close();
    browserCondiviso = null;
    paginaCondivisa = null;
  }
}

async function fetchViaBrowserReale(url: string): Promise<string> {
  const pagina = await ottieniPagina();

  // Per gli endpoint REST API, usa fetch nel contesto del browser per evitare di avere HTML wrapper
  if (url.includes('/wp-json/')) {
    try {
      const risultato = await pagina.evaluate(async (u) => {
        const resp = await fetch(u);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.text();
      }, url);
      return risultato;
    } catch (e) {
      // Se fetch fallisce, ricadi su goto
      console.warn('Fetch fallito, ricado su goto:', e);
    }
  }

  try {
    await pagina.goto(url, { waitUntil: 'load', timeout: 60000 });
  } catch (e) {
    // Continua anche se il caricamento fallisce (potrebbe essere il timeout della
    // sfida Cloudflare) - logga per poter diagnosticare fallimenti parziali in CI
    console.warn(`Navigazione a ${url} non completata entro il timeout:`, e);
  }
  // Attendi che la rete sia inattiva (la sfida JS automatica di Cloudflare fa
  // ulteriori richieste prima di reindirizzare alla pagina reale)
  await pagina.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // Attesa aggiuntiva per dare tempo alla sfida Cloudflare di risolversi ed
  // eseguire il reindirizzamento/re-render della pagina
  await new Promise((resolve) => setTimeout(resolve, 7000));
  return pagina.content();
}

function decodificaEntita(testoConEntita: string): string {
  return cheerio.load(`<div>${testoConEntita}</div>`).text().trim();
}

function estraiObiettivo($: ReturnType<typeof cheerio.load>, titoloFallback: string): string {
  const headingObiettivo = $('h2.title__info')
    .filter((_, el) => $(el).text().trim().includes('OBIETTIVO'))
    .first();

  if (headingObiettivo.length > 0) {
    const testo = headingObiettivo.next('p').text().trim();
    if (testo) return testo;
  }

  const primoParagrafo = $('p.text__medium.wp-block-paragraph').first().text().trim();
  return primoParagrafo || titoloFallback;
}

function parseDataItaliana(testo: string): string | null {
  const match = testo.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, giorno, mese, anno] = match;
  return `${anno}-${mese}-${giorno}`;
}

function estraiScadenza(html: string): string | null {
  const $ = cheerio.load(html);
  const date: string[] = [];

  $('div.separator__block.row').each((_, blocco) => {
    const etichetta = $(blocco).find('h2.title__sidebar').first().text().trim();
    if (!etichetta || etichetta.replace(':', '').trim().toLowerCase() === 'stato') return;

    const valoreTesto = $(blocco).find('span.font__bold.text__normal').first().text().trim();
    const data = parseDataItaliana(valoreTesto);
    if (data) date.push(data);
  });

  return date.length > 0 ? date[date.length - 1] : null;
}

interface PostCariplo {
  date: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
}

export function creaCariploScraper(
  fetchViaBrowser: FetchHtml = fetchViaBrowserReale,
  attesa: FunzioneAttesa = attesaReale
): Scraper {
  return {
    id: 'fondazione-cariplo',
    async scrape(): Promise<BandoRaw[]> {
      try {
        const corpoRestApi = await fetchViaBrowser(REST_API_URL);
        const post = JSON.parse(corpoRestApi) as PostCariplo[];

        const risultati: BandoRaw[] = [];

        for (const item of post) {
          const titolo = decodificaEntita(item.title.rendered);
          const $contenuto = cheerio.load(item.content.rendered);
          const descrizione = estraiObiettivo($contenuto, titolo);
          const dataPubblicazione = item.date ? item.date.slice(0, 10) : null;

          await attesa(RITARDO_TRA_RICHIESTE_MS);
          const dettaglioHtml = await fetchViaBrowser(item.link);
          const scadenza = estraiScadenza(dettaglioHtml);

          risultati.push({
            fonte: 'fondazione-cariplo',
            titolo,
            descrizione,
            url: item.link,
            scadenza,
            data_pubblicazione: dataPubblicazione,
            hash_contenuto: calcolaHash(titolo, descrizione),
          });
        }

        return risultati;
      } finally {
        await chiudiBrowserSeAperto();
      }
    },
  };
}

const cariploScraper = creaCariploScraper();
export default cariploScraper;
