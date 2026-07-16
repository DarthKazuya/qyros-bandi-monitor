# Fase 2 — Fonti restanti (QYROS Bandi Monitor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare i 6 scraper reali rimanenti (EU Funding & Tenders Portal, incentivi.gov.it, Invitalia, Regione Lombardia, Europa Creativa MEDIA, Fondazione Cariplo), portando le fonti attive da 1/8 a 7/8, ciascuno verificato contro dati reali e collaudato end-to-end tramite la pipeline già esistente.

**Architecture:** Ogni fonte è un modulo isolato in `scraper/src/sources/`, stessa interfaccia `Scraper` di Fase 1, stesso pattern di fetch iniettabile per la testabilità (nessuna chiamata di rete reale nei test automatici). Tre fonti usano API JSON dirette (EU Portal, incentivi.gov.it — più efficienti e affidabili dello scraping HTML), due usano scraping HTML classico con `cheerio` (Invitalia, Regione Lombardia), una richiede un browser headless per via di una protezione Cloudflare (Fondazione Cariplo, unica fonte che introduce Playwright come nuova dipendenza). Europa Creativa MEDIA usa scraping HTML su un insieme fisso di 12 pagine categoria.

**Tech Stack:** Stesso stack di Fase 1 (Node.js/TypeScript ESM, `tsx`, Vitest, `axios` + `cheerio`), più `form-data` (Task 1) e `playwright` (Task 6) come nuove dipendenze mirate.

## Global Constraints

- Stesse regole di Fase 1: import relativi con estensione `.js`, termini di dominio in italiano, nessuna chiamata di rete reale nei test (funzione di fetch iniettabile con default reale + fake nei test), un commit per task, comandi git dalla root del repository.
- Ogni task aggiunge la propria fonte a `config/sources.json` impostando `attivo: true` come ultimo passo, e viene provata end-to-end con uno script di dry-run manuale contro il sito/API reale — stesso pattern collaudato in Fase 1 con EIT.
- Ogni campo che una fonte non espone realmente (verificato nella ricerca preliminare) va impostato a `null`, mai indovinato.
- Le nuove dipendenze (`form-data`, `playwright`) vanno aggiunte solo nel task che le richiede davvero, non preventivamente.
- Tutte le date vanno convertite in formato ISO `YYYY-MM-DD` nell'output finale, qualunque sia il formato nativo della fonte.
- Percorso di lavoro: repository `/Users/lucapanto/qyros-bandi-monitor`, ramo `main` già aggiornato con la Fase 1 completa (30/30 test, pipeline EIT funzionante).

## Nota di verifica

Tutti i selettori, endpoint ed esempi di dati reali in questo piano provengono da un'indagine dal vivo (browser reale + `curl`) condotta il 16-17 luglio 2026, con una seconda verifica indipendente per ciascuna fonte (nuova sessione, nessun riuso di dati della prima). Dove la ricerca ha lasciato un margine di incertezza (es. l'esatta relazione DOM tra intestazione e widget su Europa Creativa MEDIA, o l'ordinamento della lista di Regione Lombardia), questo piano lo dichiara esplicitamente invece di indovinare, e include un passo di verifica dal vivo nel task stesso.

---

### Task 1: Scraper EU Funding & Tenders Portal (fonte primaria)

**Files:**
- Modify: `scraper/package.json` (aggiunge `form-data` alle dependencies)
- Create: `scraper/src/sources/eu-portal.ts`
- Create: `scraper/src/sources/eu-portal.fixtures.ts`
- Test: `scraper/src/sources/eu-portal.test.ts`
- Create: `scraper/src/dev/dry-run-eu-portal.ts`
- Modify: `config/sources.json` (`eu-portal` → `attivo: true`)

**Interfaces:**
- Consumes: `BandoRaw`, `Scraper` da `../lib/types.js`; `calcolaHash` da `../lib/hash.js`.
- Produces: `creaEuPortalScraper(fetchApi?: FetchApi): Scraper`, `export default` istanza pronta — usata da `index.ts` via import dinamico (Fase 1).

Nota di verifica: il portale EU espone una **API REST pubblica ufficialmente documentata** (pagina `.../screen/support/apis`), confermata due volte in modo indipendente con `curl` puro (nessun cookie, nessun browser). Le pagine HTML del portale sono invece shell Angular vuote — non contengono nulla da scrapare, l'API è l'unico approccio corretto.

- [ ] **Step 1: Aggiungere `form-data` a `scraper/package.json`**

Modificare la sezione `dependencies`:

```json
  "dependencies": {
    "axios": "^1.7.9",
    "cheerio": "^1.0.0",
    "form-data": "^4.0.1"
  },
```

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm install`
Expected: installazione completata senza errori, `form-data` presente in `node_modules/`.

- [ ] **Step 2: Creare la fixture con una risposta realistica dell'API**

Create `scraper/src/sources/eu-portal.fixtures.ts`:

```ts
export const FIXTURE_RISPOSTA = JSON.stringify({
  totalResults: 2,
  results: [
    {
      url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/TEST-CALL-01',
      metadata: {
        title: ['Test call for gaming innovation'],
        identifier: ['TEST-CALL-01'],
        status: ['31094502'],
        startDate: ['2026-01-01T00:00:00.000+0000'],
        deadlineDate: ['2026-12-31T00:00:00.000+0000'],
        deadlineModel: ['single-stage'],
        descriptionByte: ['<p>Expected Outcome: this is a test description about gaming.</p>'],
      },
    },
    {
      url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/TEST-CALL-02',
      metadata: {
        title: ['Test call without description'],
        identifier: ['TEST-CALL-02'],
        status: ['31094501'],
        startDate: ['2026-02-01T00:00:00.000+0000'],
        deadlineDate: ['2027-01-15T00:00:00.000+0000'],
        deadlineModel: ['single-stage'],
      },
    },
  ],
});
```

- [ ] **Step 3: Scrivere il test (fallirà, `eu-portal.ts` non esiste)**

Create `scraper/src/sources/eu-portal.test.ts`:

```ts
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
```

- [ ] **Step 4: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- eu-portal.test`
Expected: FAIL — `Cannot find module './eu-portal.js'`.

- [ ] **Step 5: Implementare `scraper/src/sources/eu-portal.ts`**

```ts
import axios from 'axios';
import FormData from 'form-data';
import * as cheerio from 'cheerio';
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
    })
  );
  form.append('languages', JSON.stringify(['en']));
  form.append('sort', JSON.stringify({ order: 'DESC', field: 'startDate' }));
  form.append(
    'displayFields',
    JSON.stringify(['title', 'identifier', 'status', 'startDate', 'deadlineDate', 'deadlineModel', 'descriptionByte'])
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
```

Nota: `scadenza` usa sempre `deadlineDate[0]`; i bandi a scadenze multiple (multi-cutoff) possono avere date successive più rilevanti non catturate — semplificazione nota per questa prima versione.

- [ ] **Step 6: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- eu-portal.test`
Expected: PASS — 2 test verdi.

- [ ] **Step 7: Creare lo script di dry-run manuale**

Create `scraper/src/dev/dry-run-eu-portal.ts`:

```ts
import euPortalScraper from '../sources/eu-portal.js';

const risultati = await euPortalScraper.scrape();
console.log(`Trovati ${risultati.length} bandi da EU Portal:`);
for (const bando of risultati.slice(0, 5)) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'n/d'} | ${bando.url}`);
}
```

- [ ] **Step 8: Eseguire il dry-run contro l'API reale**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx tsx src/dev/dry-run-eu-portal.ts`
Expected: stampa centinaia di bandi reali (l'indagine preliminare ha trovato 751 bandi tra "Forthcoming" e "Open for submission" al momento della verifica) con titoli, scadenze e URL validi che puntano a `ec.europa.eu`. Se il form multipart non funziona come atteso (rischio noto: interazione tra `axios` e `form-data` in Node), l'errore sarà un 4xx dall'API — in tal caso verificare `form.getHeaders()` sia passato correttamente nell'header della richiesta.

- [ ] **Step 9: Aggiornare `config/sources.json`**

Modificare la riga `eu-portal`:

```json
    { "id": "eu-portal", "nome": "EU Funding & Tenders Portal", "url": "https://ec.europa.eu/info/funding-tenders/opportunities/portal", "scraperModule": "eu-portal", "attivo": true },
```

- [ ] **Step 10: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/package.json scraper/package-lock.json scraper/src/sources/eu-portal.ts scraper/src/sources/eu-portal.fixtures.ts scraper/src/sources/eu-portal.test.ts scraper/src/dev/dry-run-eu-portal.ts config/sources.json
git commit -m "Implementa e attiva lo scraper EU Funding & Tenders Portal (API SEDIA)"
```

---

### Task 2: Scraper incentivi.gov.it

**Files:**
- Create: `scraper/src/sources/incentivi-gov.ts`
- Create: `scraper/src/sources/incentivi-gov.fixtures.ts`
- Test: `scraper/src/sources/incentivi-gov.test.ts`
- Create: `scraper/src/dev/dry-run-incentivi-gov.ts`
- Modify: `config/sources.json` (`incentivi-gov` → `attivo: true`)

**Interfaces:**
- Consumes: `BandoRaw`, `Scraper` da `../lib/types.js`; `calcolaHash` da `../lib/hash.js`.
- Produces: `creaIncentiviGovScraper(fetchApi?: FetchApi): Scraper`, `export default`.

Nota di verifica: la pagina di listing è renderizzata via JavaScript (HTML iniziale vuoto), ma un endpoint Apache Solr interno (`/solr/coredrupal/select`) usato dal sito stesso restituisce l'intero catalogo in JSON con una singola richiesta `GET`, senza autenticazione — confermato due volte con `curl` puro.

- [ ] **Step 1: Creare la fixture con una risposta realistica dell'endpoint Solr**

Create `scraper/src/sources/incentivi-gov.fixtures.ts`:

```ts
export const FIXTURE_RISPOSTA = JSON.stringify({
  response: {
    numFound: 3,
    docs: [
      {
        nid: '1',
        page_title: 'Bando aperto di test gaming',
        url: '/it/catalogo/bando-aperto-test',
        open_date: '2026-01-01T00:00:00',
        close_date: '2099-12-31T00:00:00',
        body: 'Descrizione di un bando ancora aperto sul settore gaming.',
      },
      {
        nid: '2',
        page_title: 'Bando scaduto di test',
        url: '/it/catalogo/bando-scaduto-test',
        open_date: '2020-01-01T00:00:00',
        close_date: '2020-06-30T00:00:00',
        body: 'Descrizione di un bando gia scaduto.',
      },
      {
        nid: '3',
        page_title: 'Bando a sportello senza scadenza',
        url: '/it/catalogo/bando-sportello-test',
        open_date: '2026-01-01T00:00:00',
        body: 'Descrizione di un bando a sportello, senza data di chiusura.',
      },
    ],
  },
});
```

- [ ] **Step 2: Scrivere il test (fallirà, `incentivi-gov.ts` non esiste)**

Create `scraper/src/sources/incentivi-gov.test.ts`:

```ts
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
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- incentivi-gov.test`
Expected: FAIL — `Cannot find module './incentivi-gov.js'`.

- [ ] **Step 4: Implementare `scraper/src/sources/incentivi-gov.ts`**

```ts
import axios from 'axios';
import { calcolaHash } from '../lib/hash.js';
import type { BandoRaw, Scraper } from '../lib/types.js';

const SOLR_URL =
  'https://www.incentivi.gov.it/solr/coredrupal/select?q.op=OR&wt=json&rows=8000&sort=ds_last_update+desc&q=index_id:incentivi&fl=nid:zs_nid,page_title:zs_title,url:zs_url,open_date:zs_field_open_date,close_date:zs_field_close_date,body:zs_body,close_date_descriptor:zs_field_close_date_descriptor';

export type FetchApi = () => Promise<string>;

async function fetchApiReale(): Promise<string> {
  const { data } = await axios.get(SOLR_URL);
  return typeof data === 'string' ? data : JSON.stringify(data);
}

interface DocIncentivo {
  page_title: string;
  url: string;
  close_date?: string;
  body?: string;
}

interface RispostaSolr {
  response: {
    docs: DocIncentivo[];
  };
}

function eAncoraValido(closeDate: string | undefined, oggi: Date): boolean {
  if (!closeDate) return true;
  return new Date(closeDate) >= oggi;
}

export function creaIncentiviGovScraper(fetchApi: FetchApi = fetchApiReale): Scraper {
  return {
    id: 'incentivi-gov',
    async scrape(): Promise<BandoRaw[]> {
      const corpo = await fetchApi();
      const risposta = JSON.parse(corpo) as RispostaSolr;
      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);

      return risposta.response.docs
        .filter((doc) => eAncoraValido(doc.close_date, oggi))
        .map((doc) => {
          const titolo = doc.page_title;
          const descrizione = doc.body?.trim() || titolo;
          return {
            fonte: 'incentivi-gov',
            titolo,
            descrizione,
            url: `https://www.incentivi.gov.it${doc.url}`,
            scadenza: doc.close_date ? doc.close_date.slice(0, 10) : null,
            data_pubblicazione: null,
            hash_contenuto: calcolaHash(titolo, descrizione),
          };
        });
    },
  };
}

const incentiviGovScraper = creaIncentiviGovScraper();
export default incentiviGovScraper;
```

Nota: il filtro "ancora valido" è applicato lato codice (non nella query Solr, il cui supporto per filtri di data non è stato verificato) per evitare di salvare migliaia di incentivi storici chiusi da anni.

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- incentivi-gov.test`
Expected: PASS — 3 test verdi.

- [ ] **Step 6: Creare lo script di dry-run manuale**

Create `scraper/src/dev/dry-run-incentivi-gov.ts`:

```ts
import incentiviGovScraper from '../sources/incentivi-gov.js';

const risultati = await incentiviGovScraper.scrape();
console.log(`Trovati ${risultati.length} incentivi ancora validi:`);
for (const bando of risultati.slice(0, 5)) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'nessuna'} | ${bando.url}`);
}
```

- [ ] **Step 7: Eseguire il dry-run contro l'endpoint reale**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx tsx src/dev/dry-run-incentivi-gov.ts`
Expected: stampa un numero elevato di incentivi reali ancora aperti o senza scadenza (l'indagine preliminare ha visto 5671 incentivi totali nel catalogo completo, la maggior parte ormai chiusi e quindi esclusi dal filtro), con titoli e URL che puntano a `incentivi.gov.it/it/catalogo/`.

- [ ] **Step 8: Aggiornare `config/sources.json`**

Modificare la riga `incentivi-gov`:

```json
    { "id": "incentivi-gov", "nome": "incentivi.gov.it", "url": "https://www.incentivi.gov.it", "scraperModule": "incentivi-gov", "attivo": true },
```

- [ ] **Step 9: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/sources/incentivi-gov.ts scraper/src/sources/incentivi-gov.fixtures.ts scraper/src/sources/incentivi-gov.test.ts scraper/src/dev/dry-run-incentivi-gov.ts config/sources.json
git commit -m "Implementa e attiva lo scraper incentivi.gov.it (endpoint Solr)"
```

---

### Task 3: Scraper Invitalia

**Files:**
- Create: `scraper/src/sources/invitalia.ts`
- Create: `scraper/src/sources/invitalia.fixtures.ts`
- Test: `scraper/src/sources/invitalia.test.ts`
- Create: `scraper/src/dev/dry-run-invitalia.ts`
- Modify: `config/sources.json` (`invitalia` → `attivo: true`)

**Interfaces:**
- Consumes: `BandoRaw`, `Scraper` da `../lib/types.js`; `calcolaHash` da `../lib/hash.js`.
- Produces: `creaInvitaliaScraper(fetchHtml?: FetchHtml): Scraper`, `export default`.

Nota di verifica: sito Drupal 10 completamente server-rendered, nessuna protezione anti-bot, confermato con `curl` puro.

- [ ] **Step 1: Creare le fixture HTML**

Create `scraper/src/sources/invitalia.fixtures.ts`:

```ts
export const FIXTURE_LISTA = `
<html><body>
<div class="pager">Pagina 1 di 1</div>
<article class="card--incentivi">
  <h3><a class="card-unified__title" href="/incentivi-e-strumenti/test-incentivo-1">Test Incentivo Uno</a></h3>
</article>
<article class="card--incentivi">
  <h3><a class="card-unified__title" href="/incentivi-e-strumenti/test-incentivo-2">Test Incentivo Due</a></h3>
</article>
</body></html>
`;

export const FIXTURE_DETTAGLIO_CON_SCADENZA = `
<html><body>
<h1 class="title">Test Incentivo Uno</h1>
<p class="subtitle">Incentivo di test per il settore gaming</p>
<div class="pagetabctabox">
  <h3>Data apertura</h3>
  <p>1/1/2026</p>
  <h3>Data chiusura</h3>
  <p>15/9/2026</p>
</div>
</body></html>
`;

export const FIXTURE_DETTAGLIO_SENZA_SCADENZA = `
<html><body>
<h1 class="title">Test Incentivo Due</h1>
<p class="subtitle">Incentivo a sportello senza scadenza fissa</p>
<div class="pagetabctabox">
  <h3>Data apertura</h3>
  <p>1/1/2026</p>
</div>
</body></html>
`;
```

- [ ] **Step 2: Scrivere il test (fallirà, `invitalia.ts` non esiste)**

Create `scraper/src/sources/invitalia.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { creaInvitaliaScraper } from './invitalia.js';
import { FIXTURE_DETTAGLIO_CON_SCADENZA, FIXTURE_DETTAGLIO_SENZA_SCADENZA, FIXTURE_LISTA } from './invitalia.fixtures.js';

describe('scraper Invitalia', () => {
  it('estrae titolo, descrizione e scadenza per un incentivo con data chiusura', async () => {
    const fetchHtmlFinto = async (url: string): Promise<string> => {
      if (url.includes('stato_incentivo=')) return FIXTURE_LISTA;
      if (url.endsWith('/test-incentivo-1')) return FIXTURE_DETTAGLIO_CON_SCADENZA;
      if (url.endsWith('/test-incentivo-2')) return FIXTURE_DETTAGLIO_SENZA_SCADENZA;
      throw new Error(`URL non atteso nel test: ${url}`);
    };

    const scraper = creaInvitaliaScraper(fetchHtmlFinto);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(2);
    const uno = risultati.find((r) => r.titolo === 'Test Incentivo Uno');
    expect(uno).toMatchObject({
      fonte: 'invitalia',
      descrizione: 'Incentivo di test per il settore gaming',
      scadenza: '2026-09-15',
      data_pubblicazione: null,
    });
  });

  it('imposta scadenza a null quando la sezione Data chiusura è assente', async () => {
    const fetchHtmlFinto = async (url: string): Promise<string> => {
      if (url.includes('stato_incentivo=')) return FIXTURE_LISTA;
      if (url.endsWith('/test-incentivo-1')) return FIXTURE_DETTAGLIO_CON_SCADENZA;
      if (url.endsWith('/test-incentivo-2')) return FIXTURE_DETTAGLIO_SENZA_SCADENZA;
      throw new Error(`URL non atteso nel test: ${url}`);
    };

    const scraper = creaInvitaliaScraper(fetchHtmlFinto);
    const risultati = await scraper.scrape();
    const due = risultati.find((r) => r.titolo === 'Test Incentivo Due');
    expect(due?.scadenza).toBeNull();
  });
});
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- invitalia.test`
Expected: FAIL — `Cannot find module './invitalia.js'`.

- [ ] **Step 4: Implementare `scraper/src/sources/invitalia.ts`**

```ts
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
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- invitalia.test`
Expected: PASS — 2 test verdi.

- [ ] **Step 6: Creare lo script di dry-run manuale**

Create `scraper/src/dev/dry-run-invitalia.ts`:

```ts
import invitaliaScraper from '../sources/invitalia.js';

const risultati = await invitaliaScraper.scrape();
console.log(`Trovati ${risultati.length} incentivi Invitalia attivi/in apertura:`);
for (const bando of risultati.slice(0, 5)) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'nessuna'} | ${bando.url}`);
}
```

- [ ] **Step 7: Eseguire il dry-run contro il sito reale**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx tsx src/dev/dry-run-invitalia.ts`
Expected: stampa almeno i ~28 incentivi "Attivo" trovati nell'indagine preliminare (es. "GreenTour", scadenza 2026-09-15) più eventuali "In apertura", con URL reali su `invitalia.it`.

- [ ] **Step 8: Aggiornare `config/sources.json`**

Modificare la riga `invitalia`:

```json
    { "id": "invitalia", "nome": "Invitalia", "url": "https://www.invitalia.it", "scraperModule": "invitalia", "attivo": true },
```

- [ ] **Step 9: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/sources/invitalia.ts scraper/src/sources/invitalia.fixtures.ts scraper/src/sources/invitalia.test.ts scraper/src/dev/dry-run-invitalia.ts config/sources.json
git commit -m "Implementa e attiva lo scraper Invitalia"
```

---

### Task 4: Scraper Bandi e Servizi Regione Lombardia

**Files:**
- Create: `scraper/src/sources/regione-lombardia.ts`
- Create: `scraper/src/sources/regione-lombardia.fixtures.ts`
- Test: `scraper/src/sources/regione-lombardia.test.ts`
- Create: `scraper/src/dev/dry-run-regione-lombardia.ts`
- Modify: `config/sources.json` (`regione-lombardia` → `attivo: true`)

**Interfaces:**
- Consumes: `BandoRaw`, `Scraper` da `../lib/types.js`; `calcolaHash` da `../lib/hash.js`.
- Produces: `creaRegioneLombardiaScraper(fetchPagina?: FetchPagina): Scraper`, `export default`.

Nota di verifica: sito server-rendered, nessuna protezione anti-bot (`robots.txt` completamente permissivo). Il catalogo completo ha centinaia di pagine (465 al momento della verifica, ~2700 elementi): questo task legge deliberatamente solo le prime 15 pagine (~90 elementi più recenti), assumendo che l'elenco sia ordinato dai più recenti/rilevanti — assunzione dichiarata esplicitamente, non nascosta, e da confermare durante il dry-run.

- [ ] **Step 1: Creare le fixture HTML**

Create `scraper/src/sources/regione-lombardia.fixtures.ts`:

```ts
export const FIXTURE_LISTA_PAGINA1 = `
<html><body>
<div data-max-page-num="1"></div>
<div class="results-block">
  <div class="card card-bg card-big">
    <h4 class="card-title" data-content="Titolo completo non troncato del primo bando di test per il settore fintech">Titolo completo non troncato del primo bando...</h4>
    <a class="text-decoration-none" href="/servizi/servizio/bandi/dettaglio/test/bando-test-1"></a>
    <p class="card-text">
      <svg class="icon-popover" data-content="Descrizione breve completa del primo bando di test."></svg>
    </p>
    <input class="checkCloseDate" value="2099-12-31 16:00" />
  </div>
  <div class="card card-bg card-big">
    <h4 class="card-title" data-content="Secondo bando di test">Secondo bando di test</h4>
    <a class="text-decoration-none" href="/servizi/servizio/bandi/dettaglio/test/bando-test-2"></a>
    <p class="card-text">
      <svg class="icon-popover" data-content="Descrizione breve del secondo bando."></svg>
    </p>
    <input class="checkCloseDate" value="2099-06-30 12:00" />
  </div>
</div>
</body></html>
`;

export const FIXTURE_DETTAGLIO_CON_PUBBLICAZIONE = `
<html><head><meta name="description" content="Descrizione estesa dalla pagina di dettaglio del primo bando."></head><body>
<p>Pubblicato il: <strong data-entity="pubblicazione">15/06/2026 ,</strong> ore 10:53</p>
</body></html>
`;

export const FIXTURE_DETTAGLIO_SENZA_PUBBLICAZIONE = `
<html><head><meta name="description" content="Descrizione estesa dalla pagina di dettaglio del secondo bando."></head><body>
<p>Nessuna informazione di pubblicazione disponibile.</p>
</body></html>
`;
```

- [ ] **Step 2: Scrivere il test (fallirà, `regione-lombardia.ts` non esiste)**

Create `scraper/src/sources/regione-lombardia.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { creaRegioneLombardiaScraper } from './regione-lombardia.js';
import {
  FIXTURE_DETTAGLIO_CON_PUBBLICAZIONE,
  FIXTURE_DETTAGLIO_SENZA_PUBBLICAZIONE,
  FIXTURE_LISTA_PAGINA1,
} from './regione-lombardia.fixtures.js';

describe('scraper Regione Lombardia', () => {
  it('estrae titolo non troncato, scadenza dalla lista e data di pubblicazione dal dettaglio', async () => {
    const fetchPaginaFinto = async (richiesta: { metodo: string; url: string }): Promise<string> => {
      if (richiesta.url.endsWith('/servizi/servizio/bandi')) return FIXTURE_LISTA_PAGINA1;
      if (richiesta.url.endsWith('/bando-test-1')) return FIXTURE_DETTAGLIO_CON_PUBBLICAZIONE;
      if (richiesta.url.endsWith('/bando-test-2')) return FIXTURE_DETTAGLIO_SENZA_PUBBLICAZIONE;
      throw new Error(`Richiesta non attesa nel test: ${richiesta.url}`);
    };

    const scraper = creaRegioneLombardiaScraper(fetchPaginaFinto);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(2);
    expect(risultati[0]).toMatchObject({
      fonte: 'regione-lombardia',
      titolo: 'Titolo completo non troncato del primo bando di test per il settore fintech',
      url: 'https://www.bandi.regione.lombardia.it/servizi/servizio/bandi/dettaglio/test/bando-test-1',
      scadenza: '2099-12-31',
      data_pubblicazione: '2026-06-15',
    });
    expect(risultati[0].descrizione).toBe('Descrizione estesa dalla pagina di dettaglio del primo bando.');
  });

  it('imposta data_pubblicazione a null quando il campo pubblicazione è assente nel dettaglio', async () => {
    const fetchPaginaFinto = async (richiesta: { metodo: string; url: string }): Promise<string> => {
      if (richiesta.url.endsWith('/servizi/servizio/bandi')) return FIXTURE_LISTA_PAGINA1;
      if (richiesta.url.endsWith('/bando-test-1')) return FIXTURE_DETTAGLIO_CON_PUBBLICAZIONE;
      if (richiesta.url.endsWith('/bando-test-2')) return FIXTURE_DETTAGLIO_SENZA_PUBBLICAZIONE;
      throw new Error(`Richiesta non attesa nel test: ${richiesta.url}`);
    };

    const scraper = creaRegioneLombardiaScraper(fetchPaginaFinto);
    const risultati = await scraper.scrape();
    expect(risultati[1].data_pubblicazione).toBeNull();
  });
});
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- regione-lombardia.test`
Expected: FAIL — `Cannot find module './regione-lombardia.js'`.

- [ ] **Step 4: Implementare `scraper/src/sources/regione-lombardia.ts`**

```ts
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
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- regione-lombardia.test`
Expected: PASS — 2 test verdi.

- [ ] **Step 6: Creare lo script di dry-run manuale**

Create `scraper/src/dev/dry-run-regione-lombardia.ts`:

```ts
import regioneLombardiaScraper from '../sources/regione-lombardia.js';

const risultati = await regioneLombardiaScraper.scrape();
console.log(`Trovati ${risultati.length} bandi Regione Lombardia (prime 15 pagine):`);
for (const bando of risultati.slice(0, 5)) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'n/d'} | pubblicato: ${bando.data_pubblicazione ?? 'n/d'} | ${bando.url}`);
}
```

- [ ] **Step 7: Eseguire il dry-run contro il sito reale e verificare l'assunzione sull'ordinamento**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx tsx src/dev/dry-run-regione-lombardia.ts`
Expected: stampa ~90 bandi reali (es. "Gestione delle anagrafiche dei Centri per la Famiglia lombardi", scadenza 2026-08-31). Controllare manualmente i valori `data_pubblicazione` stampati: se sono prevalentemente recenti (ultime settimane/mesi), l'assunzione "elenco ordinato dai più recenti" è confermata; se compaiono date molto vecchie miste a quelle recenti, annotarlo come limite noto della fonte da rivedere in futuro (non blocca il completamento del task).

- [ ] **Step 8: Aggiornare `config/sources.json`**

Modificare la riga `regione-lombardia`:

```json
    { "id": "regione-lombardia", "nome": "Bandi e Servizi Regione Lombardia", "url": "https://bandi.regione.lombardia.it", "scraperModule": "regione-lombardia", "attivo": true },
```

- [ ] **Step 9: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/sources/regione-lombardia.ts scraper/src/sources/regione-lombardia.fixtures.ts scraper/src/sources/regione-lombardia.test.ts scraper/src/dev/dry-run-regione-lombardia.ts config/sources.json
git commit -m "Implementa e attiva lo scraper Bandi e Servizi Regione Lombardia"
```

---

### Task 5: Scraper Europa Creativa MEDIA

**Files:**
- Create: `scraper/src/sources/europa-creativa-media.ts`
- Create: `scraper/src/sources/europa-creativa-media.fixtures.ts`
- Test: `scraper/src/sources/europa-creativa-media.test.ts`
- Create: `scraper/src/dev/dry-run-europa-creativa-media.ts`
- Modify: `config/sources.json` (`europa-creativa-media` → `attivo: true`)

**Interfaces:**
- Consumes: `BandoRaw`, `Scraper` da `../lib/types.js`; `calcolaHash` da `../lib/hash.js`.
- Produces: `creaEuropaCreativaMediaScraper(fetchHtml?: FetchHtml): Scraper`, `export default`.

Nota di verifica: non esiste una pagina di elenco unica, ma 12 pagine categoria fisse (elenco verificato due volte, invariato). Al momento della verifica **tutte** le categorie mostravano zero bandi aperti (solo storico chiuso) — stato reale del sito, non un errore, da gestire come caso normale.

Nota di incertezza dichiarata: la relazione esatta nel DOM tra l'intestazione "I bandi aperti"/"I bandi chiusi" e il blocco widget corrispondente non è stata verificata al carattere (la ricerca ha confermato QUALE testo distingue i due blocchi, non la struttura HTML precisa che li collega). Questo task assume che l'intestazione sia il fratello HTML immediatamente precedente al blocco widget (pattern comune per questo tipo di tema) — va confermato durante il passo di dry-run e corretto se il sito reale usa una struttura diversa.

- [ ] **Step 1: Creare le fixture HTML**

Create `scraper/src/sources/europa-creativa-media.fixtures.ts`:

```ts
export const FIXTURE_CATEGORIA_CON_BANDO = `
<html><body>
<h4>I bandi aperti</h4>
<div class="widget-recent-posts">
  <ul>
    <li class="clearfix">
      <div class="widget-blog-content">
        <a href="/bandi/test-bando-videogame-2026"><span>Test bando videogame 2026</span></a>
      </div>
    </li>
  </ul>
</div>
<h4>I bandi chiusi</h4>
<div class="widget-recent-posts">
  <ul>
    <li class="clearfix">
      <div class="widget-blog-content">
        <a href="/bandi/vecchio-bando-chiuso"><span>Vecchio bando chiuso</span></a>
      </div>
    </li>
  </ul>
</div>
</body></html>
`;

export const FIXTURE_CATEGORIA_SENZA_BANDI = `
<html><body>
<h4>I bandi aperti</h4>
<div class="widget-recent-posts">
  <p class="bandoChiuso">Al momento non ci sono bandi aperti in questa categoria.</p>
</div>
</body></html>
`;

export const FIXTURE_DETTAGLIO = `
<html><body>
<h2 class="post-title">Test bando videogame 2026</h2>
<article class="post-content">
  <div class="event-description">
    <p>Primo paragrafo di descrizione sul budget disponibile.</p>
    <p>Secondo paragrafo sugli obiettivi del bando.</p>
  </div>
</article>
<div class="widget-upcoming-events">
  <ul>
    <li class="event-item">
      <div class="event-date"><span class="date">3</span><span class="month">Dic</span></div>
      <div class="event-detail"><h4>Prima scadenza</h4><span class="event-dayntime">2025 | Ore 17:00</span></div>
    </li>
    <li class="event-item">
      <div class="event-date"><span class="date">7</span><span class="month">Mag</span></div>
      <div class="event-detail"><h4>Seconda scadenza</h4><span class="event-dayntime">2026 | Ore 17:00</span></div>
    </li>
  </ul>
</div>
</body></html>
`;
```

- [ ] **Step 2: Scrivere il test (fallirà, `europa-creativa-media.ts` non esiste)**

Create `scraper/src/sources/europa-creativa-media.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { creaEuropaCreativaMediaScraper } from './europa-creativa-media.js';
import {
  FIXTURE_CATEGORIA_CON_BANDO,
  FIXTURE_CATEGORIA_SENZA_BANDI,
  FIXTURE_DETTAGLIO,
} from './europa-creativa-media.fixtures.js';

describe('scraper Europa Creativa MEDIA', () => {
  it('estrae un bando aperto, ignora quelli chiusi, e usa la scadenza più recente', async () => {
    const fetchHtmlFinto = async (url: string): Promise<string> => {
      if (url.endsWith('/sostegni-finanziari/videogame')) return FIXTURE_CATEGORIA_CON_BANDO;
      if (url.endsWith('/test-bando-videogame-2026')) return FIXTURE_DETTAGLIO;
      return FIXTURE_CATEGORIA_SENZA_BANDI;
    };

    const scraper = creaEuropaCreativaMediaScraper(fetchHtmlFinto);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(1);
    expect(risultati[0]).toMatchObject({
      fonte: 'europa-creativa-media',
      titolo: 'Test bando videogame 2026',
      url: 'https://www.europacreativa-media.it/bandi/test-bando-videogame-2026',
      scadenza: '2026-05-07',
      data_pubblicazione: null,
    });
    expect(risultati[0].descrizione).toContain('budget');
    expect(risultati[0].descrizione).toContain('obiettivi');
  });

  it('non genera errori quando una categoria non ha bandi aperti', async () => {
    const fetchHtmlFinto = async () => FIXTURE_CATEGORIA_SENZA_BANDI;
    const scraper = creaEuropaCreativaMediaScraper(fetchHtmlFinto);
    const risultati = await scraper.scrape();
    expect(risultati).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- europa-creativa-media.test`
Expected: FAIL — `Cannot find module './europa-creativa-media.js'`.

- [ ] **Step 4: Implementare `scraper/src/sources/europa-creativa-media.ts`**

```ts
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
    const header = $(widget).prev().text().trim().toLowerCase();
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
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- europa-creativa-media.test`
Expected: PASS — 2 test verdi.

- [ ] **Step 6: Creare lo script di dry-run manuale**

Create `scraper/src/dev/dry-run-europa-creativa-media.ts`:

```ts
import europaCreativaMediaScraper from '../sources/europa-creativa-media.js';

const risultati = await europaCreativaMediaScraper.scrape();
console.log(`Trovati ${risultati.length} bandi aperti su Europa Creativa MEDIA:`);
for (const bando of risultati) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'n/d'} | ${bando.url}`);
}
```

- [ ] **Step 7: Eseguire il dry-run e verificare l'assunzione sulla struttura del widget**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx tsx src/dev/dry-run-europa-creativa-media.ts`
Expected: al momento della stesura di questo piano tutte le 12 categorie avevano zero bandi aperti (`Trovati 0 bandi aperti` è un esito valido e atteso, non un errore). Se compaiono bandi aperti, verificarne manualmente uno con un browser per confermare che titolo/scadenza corrispondano al bando reale. Se invece lo script restituisce 0 risultati ma navigando manualmente il sito si osservano bandi effettivamente aperti in qualche categoria, la relazione DOM assunta tra intestazione e widget (Step 4) è sbagliata e va corretta ispezionando l'HTML reale di quella pagina.

- [ ] **Step 8: Aggiornare `config/sources.json`**

Modificare la riga `europa-creativa-media`:

```json
    { "id": "europa-creativa-media", "nome": "Europa Creativa MEDIA", "url": "https://www.europacreativa-media.it", "scraperModule": "europa-creativa-media", "attivo": true },
```

- [ ] **Step 9: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/sources/europa-creativa-media.ts scraper/src/sources/europa-creativa-media.fixtures.ts scraper/src/sources/europa-creativa-media.test.ts scraper/src/dev/dry-run-europa-creativa-media.ts config/sources.json
git commit -m "Implementa e attiva lo scraper Europa Creativa MEDIA"
```

---

### Task 6: Scraper Fondazione Cariplo (browser headless)

**Files:**
- Modify: `scraper/package.json` (aggiunge `playwright` alle dependencies)
- Create: `scraper/src/sources/fondazione-cariplo.ts`
- Create: `scraper/src/sources/fondazione-cariplo.fixtures.ts`
- Test: `scraper/src/sources/fondazione-cariplo.test.ts`
- Create: `scraper/src/dev/dry-run-fondazione-cariplo.ts`
- Modify: `config/sources.json` (`fondazione-cariplo` → `attivo: true`)

**Interfaces:**
- Consumes: `BandoRaw`, `Scraper` da `../lib/types.js`; `calcolaHash` da `../lib/hash.js`.
- Produces: `creaCariploScraper(fetchViaBrowser?: FetchHtml, attesa?: FunzioneAttesa): Scraper`, `chiudiBrowserSeAperto(): Promise<void>`, `export default`.

Nota di verifica: **confermato due volte, in modo indipendente**, che ogni percorso su questo dominio (pagina listing, pagine dettaglio, REST API WordPress, endpoint AJAX) risponde 403 "Just a moment..." (Cloudflare) a qualunque richiesta HTTP diretta (curl/axios), senza eccezioni. Un browser reale supera il controllo automaticamente, senza CAPTCHA interattiva, su tutte le pagine visitate in entrambe le sessioni di verifica. Questa è l'unica fonte che richiede un browser headless.

- [ ] **Step 1: Aggiungere `playwright` a `scraper/package.json`**

Modificare la sezione `dependencies` (aggiunta rispetto a quanto già presente dopo il Task 1):

```json
  "dependencies": {
    "axios": "^1.7.9",
    "cheerio": "^1.0.0",
    "form-data": "^4.0.1",
    "playwright": "^1.49.0"
  },
```

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm install`
Expected: installazione completata senza errori.

- [ ] **Step 2: Installare il browser Chromium richiesto da Playwright**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx playwright install chromium`
Expected: scarica ed installa il binario di Chromium (alcune centinaia di MB, un'operazione una tantum), termina senza errori.

- [ ] **Step 3: Creare le fixture (risposta REST API + pagine dettaglio)**

Create `scraper/src/sources/fondazione-cariplo.fixtures.ts`:

```ts
export const FIXTURE_REST_API = JSON.stringify([
  {
    date: '2026-04-08T09:11:20',
    slug: 'test-bando-obiettivo',
    link: 'https://www.fondazionecariplo.it/bando/test-bando-obiettivo/',
    title: { rendered: 'Test Bando con Obiettivo' },
    content: {
      rendered:
        '<div class="info-bando-container">' +
        '<h2 class="title__info">TIPO</h2><p class="text__medium wp-block-paragraph">Con scadenza</p>' +
        '<h2 class="title__info">OBIETTIVO</h2><p class="text__medium wp-block-paragraph">Favorire progetti di innovazione tecnologica nel settore gaming.</p>' +
        '</div>',
    },
  },
  {
    date: '2026-05-01T10:00:00',
    slug: 'test-bando-telethon-style',
    link: 'https://www.fondazionecariplo.it/bando/test-bando-telethon-style/',
    title: { rendered: 'Test Bando &#8211; Stile Telethon' },
    content: {
      rendered:
        '<div class="info-bando-container">' +
        '<h2 class="title__info">Project Duration and Budget</h2><p class="text__medium wp-block-paragraph">Testo di fallback senza intestazione OBIETTIVO.</p>' +
        '</div>',
    },
  },
]);

export const FIXTURE_DETTAGLIO_UNA_FASE = `
<html><body>
<div class="separator__block row"><h2 class="title__sidebar">Stato:</h2><span class="status">Attivo</span></div>
<div class="separator__block row"><h2 class="title__sidebar">Bando con scadenza</h2><span class="font__bold text__normal">23/07/2026</span></div>
</body></html>
`;

export const FIXTURE_DETTAGLIO_DUE_FASI = `
<html><body>
<div class="separator__block row"><h2 class="title__sidebar">Stato:</h2><span class="status">Attivo</span></div>
<div class="separator__block row"><h2 class="title__sidebar">Fase 1</h2><span class="font__bold text__normal">14/07/2026</span></div>
<div class="separator__block row"><h2 class="title__sidebar">Fase 2</h2><span class="font__bold text__normal">25/03/2027</span></div>
</body></html>
`;

export const FIXTURE_DETTAGLIO_SENZA_SCADENZA = `
<html><body>
<div class="separator__block row"><h2 class="title__sidebar">Stato:</h2><span class="status">Scaduto</span></div>
<div class="separator__block row"><h2 class="title__sidebar">Bando senza scadenza</h2><span class="font__bold text__normal"></span></div>
</body></html>
`;
```

- [ ] **Step 4: Scrivere il test (fallirà, `fondazione-cariplo.ts` non esiste)**

Create `scraper/src/sources/fondazione-cariplo.test.ts`:

```ts
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
```

- [ ] **Step 5: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- fondazione-cariplo.test`
Expected: FAIL — `Cannot find module './fondazione-cariplo.js'`.

- [ ] **Step 6: Implementare `scraper/src/sources/fondazione-cariplo.ts`**

```ts
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
  browserCondiviso = await chromium.launch({ headless: true });
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
  if (url.includes('/wp-json/')) {
    return pagina.evaluate(async (u) => {
      const risposta = await fetch(u);
      return risposta.text();
    }, url);
  }
  await pagina.goto(url, { waitUntil: 'domcontentloaded' });
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
```

- [ ] **Step 7: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- fondazione-cariplo.test`
Expected: PASS — 3 test verdi, esecuzione quasi istantanea (l'attesa tra le richieste è disattivata nei test tramite `nessunaAttesa`).

- [ ] **Step 8: Eseguire l'intera suite per verificare che nulla si sia rotto**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test`
Expected: PASS — tutti i test di Fase 1 e dei Task 1-6 di Fase 2 verdi (nessuna fonte precedente deve rompersi per l'aggiunta di Playwright come dipendenza, dato che ogni scraper importa solo ciò che gli serve).

- [ ] **Step 9: Creare lo script di dry-run manuale**

Create `scraper/src/dev/dry-run-fondazione-cariplo.ts`:

```ts
import cariploScraper from '../sources/fondazione-cariplo.js';

const risultati = await cariploScraper.scrape();
console.log(`Trovati ${risultati.length} bandi da Fondazione Cariplo:`);
for (const bando of risultati.slice(0, 5)) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'n/d'} | pubblicato: ${bando.data_pubblicazione ?? 'n/d'} | ${bando.url}`);
}
```

- [ ] **Step 10: Eseguire il dry-run contro il sito reale (usa un vero browser headless)**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx tsx src/dev/dry-run-fondazione-cariplo.ts`
Expected: dopo qualche decina di secondi (il browser headless naviga davvero ~34 pagine reali, con una pausa di 400ms tra ciascuna) stampa un numero di bandi reali vicino a 33, inclusi titoli e scadenze plausibili (es. un bando "Riprogettiamo il futuro" con scadenza attorno al 2026-07-23, se ancora presente al momento dell'esecuzione — i bandi effettivamente pubblicati possono essere cambiati rispetto alla verifica preliminare, l'importante è che compaiano risultati reali e coerenti, non l'esempio esatto). Se compare un errore 403 o una pagina di verifica CAPTCHA visibile, fermarsi e segnalarlo: non tentare di risolvere alcuna verifica interattiva.

- [ ] **Step 11: Aggiornare `config/sources.json`**

Modificare la riga `fondazione-cariplo`:

```json
    { "id": "fondazione-cariplo", "nome": "Fondazione Cariplo", "url": "https://www.fondazionecariplo.it/contributi/bandi/", "scraperModule": "fondazione-cariplo", "attivo": true },
```

- [ ] **Step 12: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/package.json scraper/package-lock.json scraper/src/sources/fondazione-cariplo.ts scraper/src/sources/fondazione-cariplo.fixtures.ts scraper/src/sources/fondazione-cariplo.test.ts scraper/src/dev/dry-run-fondazione-cariplo.ts config/sources.json
git commit -m "Implementa e attiva lo scraper Fondazione Cariplo (browser headless via Playwright)"
```

---

### Task 7: Wrap-up Fase 2

**Files:**
- Modify: `scraper/README.md`

**Interfaces:**
- Nessuna nuova interfaccia: task di sola documentazione e verifica finale.

- [ ] **Step 1: Eseguire l'intera pipeline reale end-to-end con tutte e 7 le fonti attive**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx tsx src/index.ts --force`
Expected: esegue in sequenza tutte le 7 fonti attive (`eit`, `eu-portal`, `incentivi-gov`, `invitalia`, `regione-lombardia`, `europa-creativa-media`, `fondazione-cariplo`), stampa righe `[NUOVO]` per i bandi rilevanti trovati e una riga di esito finale con `fonti ok` elencate e `fonti fallite: nessuna` (a meno di problemi temporanei di rete, in tal caso rilanciare). L'esecuzione richiederà probabilmente diversi minuti per via del browser headless su Fondazione Cariplo.

- [ ] **Step 2: Aggiornare `scraper/README.md`**

Sostituire la sezione "Stato Fase 1" con:

```markdown
## Stato Fase 2

7 fonti su 8 attive e verificate contro dati reali: EIT, EU Funding & Tenders Portal
(API SEDIA), incentivi.gov.it (endpoint Solr), Invitalia, Bandi e Servizi Regione
Lombardia, Europa Creativa MEDIA, Fondazione Cariplo (unica fonte che richiede un
browser headless via Playwright, per via di una protezione Cloudflare).

L'ottavo slot (`slot-personalizzato` in `config/sources.json`) resta disattivato,
pronto per una fonte futura da configurare senza toccare il codice esistente.

Limiti noti documentati nei singoli task:
- Regione Lombardia: vengono lette solo le prime 15 pagine dell'elenco (~90 bandi
  più recenti), non l'intero catalogo storico.
- EU Portal: per i bandi con più scadenze (multi-cutoff) viene usata solo la prima.
- Fondazione Cariplo: aggiunge qualche decina di secondi al job giornaliero per via
  della navigazione reale con browser headless.

Il salvataggio su database reale e l'invio email restano da collegare in Fase 3.
```

- [ ] **Step 3: Commit finale della Fase 2**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/README.md
git commit -m "Documenta stato e limiti noti della Fase 2"
```

---

## Riepilogo copertura spec (Fase 2)

- EU Funding & Tenders Portal — fonte primaria, implementata via API pubblica ufficiale invece di scraping HTML (più solida) — Task 1.
- Europa Creativa MEDIA — Task 5.
- incentivi.gov.it — Task 2.
- Invitalia — Task 3.
- Bandi e Servizi Regione Lombardia — Task 4.
- Fondazione Cariplo — Task 6.
- Ottavo slot configurabile — resta intenzionalmente vuoto/disattivo, come da spec ("lascia un ottavo slot configurabile").
- Estensibilità: ogni fonte è un file isolato + una riga di config, nessuna modifica alla logica di matching, all'orchestratore o alla dashboard — verificato per tutte e 6 le fonti di questa fase, esattamente come EIT in Fase 1.

Fuori scope per la Fase 2 (rimandato, come da spec): job GitHub Actions e invio email reale via Resend (Fase 3), dashboard (Fase 4), creazione account e deploy (Fase 5).
