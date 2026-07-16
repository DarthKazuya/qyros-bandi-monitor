# Fase 1 — Fondamenta (QYROS Bandi Monitor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire la libreria condivisa (tipi, matching keyword, hash, gestione orario, logica di deduplica, orchestratore con isolamento errori) e un primo scraper reale e verificato (EIT) che dimostrino l'intera pipeline end-to-end, interamente testabile in locale senza alcun account esterno.

**Architecture:** Package Node.js/TypeScript ESM in `scraper/`, moduli puri e testabili in `src/lib/`, uno scraper per fonte in `src/sources/` dietro un'interfaccia comune `Scraper`, un orchestratore che isola gli errori per fonte, un `DbPort` (interfaccia) con un'implementazione finta per i test e una console-based per il dry-run manuale (il vero adattatore Supabase arriva in Fase 3, quando esisterà un progetto Supabase reale).

**Tech Stack:** Node.js 20+ (ESM, `"type": "module"`), TypeScript 5, `tsx` per l'esecuzione diretta, Vitest per i test, `axios` + `cheerio` per lo scraping HTTP.

## Global Constraints

- Codice in TypeScript ESM (`"type": "module"` in package.json); tutti gli import relativi usano estensione `.js` (convenzione standard TS-ESM, richiesta da Node in esecuzione).
- Termini di dominio in italiano nei nomi di funzioni/campi (`bando`, `fonte`, `scadenza`, `priorita`, `scartato`, `classifica`, `calcolaHash`) per coerenza con lo spec; termini di infrastruttura generica in inglese dove naturale (`Scraper`, `DbPort`).
- Nessuna chiamata di rete reale nei test automatici: gli scraper accettano una funzione di fetch iniettabile, i test usano fixture HTML statiche. La verifica contro il sito reale avviene tramite uno script di dry-run separato, eseguito manualmente.
- Package manager: npm. Test runner: `vitest run` (nessuna configurazione aggiuntiva necessaria).
- Un commit git per task completato, con messaggio descrittivo in italiano.
- Percorso di lavoro: `/Users/lucapanto/qyros-bandi-monitor` (repository Git già inizializzato, spec già committata in `docs/superpowers/specs/2026-07-16-bandi-monitor-design.md`).

---

### Task 1: Scaffold del progetto scraper

**Files:**
- Create: `scraper/package.json`
- Create: `scraper/tsconfig.json`
- Create: `scraper/.gitignore`
- Create: `scraper/src/index.ts` (placeholder minimo, verrà completato al Task 9)

**Interfaces:**
- Produces: comandi `npm install`, `npm test`, `npm run typecheck` eseguibili dalla cartella `scraper/`.

- [ ] **Step 1: Creare `scraper/package.json`**

```json
{
  "name": "qyros-bandi-monitor-scraper",
  "private": true,
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "axios": "^1.7.9",
    "cheerio": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Creare `scraper/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Creare `scraper/.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 4: Creare un `scraper/src/index.ts` placeholder**

```ts
console.log('QYROS Bandi Monitor — scraper in costruzione (Fase 1)');
```

- [ ] **Step 5: Installare le dipendenze**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm install`
Expected: installazione completata senza errori, creata cartella `node_modules/` e file `package-lock.json`.

- [ ] **Step 6: Verificare che l'esecuzione base funzioni**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx tsx src/index.ts`
Expected: stampa `QYROS Bandi Monitor — scraper in costruzione (Fase 1)`.

- [ ] **Step 7: Verificare che `vitest` sia configurato (nessun test ancora presente)**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test`
Expected: Vitest parte e riporta "No test files found" (nessun errore di configurazione).

- [ ] **Step 8: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/package.json scraper/package-lock.json scraper/tsconfig.json scraper/.gitignore scraper/src/index.ts
git commit -m "Scaffold progetto scraper Node/TypeScript"
```

---

### Task 2: Tipi condivisi, config loader e file di configurazione

**Files:**
- Create: `config/sources.json`
- Create: `config/keywords.json`
- Create: `config/schedule.json`
- Create: `scraper/src/lib/types.ts`
- Create: `scraper/src/lib/config.ts`
- Test: `scraper/src/lib/config.test.ts`

**Interfaces:**
- Produces: tipi `BandoRaw`, `Priorita`, `MatchResult`, `Keywords`, `SourceConfig`, `ScheduleConfig`, `Scraper`, `EsistenteBando`, `DedupAction` (usati da tutti i task successivi); funzioni `caricaKeywords(): Keywords`, `caricaSources(): SourceConfig[]`, `caricaSchedule(): ScheduleConfig`.

- [ ] **Step 1: Creare `config/sources.json` con le 8 fonti (solo EIT attiva per ora)**

```json
{
  "fonti": [
    { "id": "eit", "nome": "EIT - Bandi e gare", "url": "https://eit.europa.eu/work-with-us/procurement/calls", "scraperModule": "eit", "attivo": true },
    { "id": "eu-portal", "nome": "EU Funding & Tenders Portal", "url": "https://ec.europa.eu/info/funding-tenders/opportunities/portal", "scraperModule": "eu-portal", "attivo": false },
    { "id": "europa-creativa-media", "nome": "Europa Creativa MEDIA", "url": "https://www.europacreativa-media.it", "scraperModule": "europa-creativa-media", "attivo": false },
    { "id": "incentivi-gov", "nome": "incentivi.gov.it", "url": "https://www.incentivi.gov.it", "scraperModule": "incentivi-gov", "attivo": false },
    { "id": "invitalia", "nome": "Invitalia", "url": "https://www.invitalia.it", "scraperModule": "invitalia", "attivo": false },
    { "id": "regione-lombardia", "nome": "Bandi e Servizi Regione Lombardia", "url": "https://bandi.regione.lombardia.it", "scraperModule": "regione-lombardia", "attivo": false },
    { "id": "fondazione-cariplo", "nome": "Fondazione Cariplo", "url": "https://www.fondazionecariplo.it/contributi/bandi/", "scraperModule": "fondazione-cariplo", "attivo": false },
    { "id": "slot-personalizzato", "nome": "Nuova fonte (da configurare)", "url": "", "scraperModule": "", "attivo": false }
  ]
}
```

- [ ] **Step 2: Creare `config/keywords.json`**

```json
{
  "livello1": ["gaming", "fintech", "regtech", "economia circolare", "circular economy"],
  "livello2": ["intelligenza artificiale", "artificial intelligence", "ai", "tecnologia", "tecnologico", "technology", "tech", "startup", "start-up", "innovazione", "innovation"]
}
```

- [ ] **Step 3: Creare `config/schedule.json`**

```json
{
  "ora": 8,
  "timezone": "Europe/Rome"
}
```

- [ ] **Step 4: Creare `scraper/src/lib/types.ts` con i tipi condivisi**

```ts
export type Priorita = 'alta' | 'da_verificare';

export interface BandoRaw {
  fonte: string;
  titolo: string;
  descrizione: string;
  url: string;
  scadenza: string | null;
  data_pubblicazione: string | null;
  hash_contenuto: string;
}

export interface MatchResult {
  priorita: Priorita | null;
  scartato: boolean;
}

export interface Keywords {
  livello1: string[];
  livello2: string[];
}

export interface SourceConfig {
  id: string;
  nome: string;
  url: string;
  scraperModule: string;
  attivo: boolean;
}

export interface ScheduleConfig {
  ora: number;
  timezone: string;
}

export interface Scraper {
  id: string;
  scrape(): Promise<BandoRaw[]>;
}

export interface EsistenteBando {
  hash_contenuto: string;
}

export type DedupAction = 'insert' | 'update' | 'skip';
```

- [ ] **Step 5: Scrivere il test del config loader (fallirà, `config.ts` non esiste ancora)**

Create `scraper/src/lib/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { caricaKeywords, caricaSchedule, caricaSources } from './config.js';

describe('config loader', () => {
  it('carica le keyword di livello 1 e livello 2 dal file reale', () => {
    const keywords = caricaKeywords();
    expect(keywords.livello1).toContain('gaming');
    expect(keywords.livello2).toContain('startup');
  });

  it('carica le fonti dal file reale, con almeno EIT attiva', () => {
    const fonti = caricaSources();
    const eit = fonti.find((f) => f.id === 'eit');
    expect(eit).toBeDefined();
    expect(eit?.attivo).toBe(true);
  });

  it('carica la configurazione dello schedule dal file reale', () => {
    const schedule = caricaSchedule();
    expect(schedule.ora).toBe(8);
    expect(schedule.timezone).toBe('Europe/Rome');
  });
});
```

- [ ] **Step 6: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- config.test`
Expected: FAIL — `Cannot find module './config.js'` o simile (il file non esiste ancora).

- [ ] **Step 7: Implementare `scraper/src/lib/config.ts`**

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Keywords, ScheduleConfig, SourceConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, '../../../config');

export function caricaKeywords(): Keywords {
  const raw = readFileSync(resolve(CONFIG_DIR, 'keywords.json'), 'utf8');
  return JSON.parse(raw) as Keywords;
}

export function caricaSources(): SourceConfig[] {
  const raw = readFileSync(resolve(CONFIG_DIR, 'sources.json'), 'utf8');
  const parsed = JSON.parse(raw) as { fonti: SourceConfig[] };
  return parsed.fonti;
}

export function caricaSchedule(): ScheduleConfig {
  const raw = readFileSync(resolve(CONFIG_DIR, 'schedule.json'), 'utf8');
  return JSON.parse(raw) as ScheduleConfig;
}
```

- [ ] **Step 8: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- config.test`
Expected: PASS — 3 test verdi.

- [ ] **Step 9: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add config/sources.json config/keywords.json config/schedule.json scraper/src/lib/types.ts scraper/src/lib/config.ts scraper/src/lib/config.test.ts
git commit -m "Aggiunge tipi condivisi, file di configurazione e config loader"
```

---

### Task 3: Motore di rilevanza (matching)

**Files:**
- Create: `scraper/src/lib/matching.ts`
- Test: `scraper/src/lib/matching.test.ts`

**Interfaces:**
- Consumes: `Keywords`, `MatchResult`, `Priorita` da `./types.js` (Task 2).
- Produces: `normalizzaTesto(testo: string): string`, `classifica(titolo: string, descrizione: string, keywords: Keywords): MatchResult` — usati da `orchestrator.ts` (Task 7).

- [ ] **Step 1: Scrivere i test di matching (falliranno, `matching.ts` non esiste)**

Create `scraper/src/lib/matching.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifica, normalizzaTesto } from './matching.js';
import type { Keywords } from './types.js';

const keywords: Keywords = {
  livello1: ['gaming', 'fintech', 'regtech', 'economia circolare', 'circular economy'],
  livello2: ['intelligenza artificiale', 'artificial intelligence', 'ai', 'tecnologia', 'startup', 'start-up', 'innovazione', 'innovation'],
};

describe('normalizzaTesto', () => {
  it('rimuove accenti, minuscolizza e rimuove spazi/trattini', () => {
    expect(normalizzaTesto('È un progetto di Économia Circolare!')).toBe('eunprogettodieconomiacircolare!');
  });

  it('rende equivalenti start-up, start up e startup', () => {
    expect(normalizzaTesto('start-up')).toBe(normalizzaTesto('startup'));
    expect(normalizzaTesto('start up')).toBe(normalizzaTesto('startup'));
  });
});

describe('classifica', () => {
  it('assegna priorita alta se trova una keyword di livello 1', () => {
    const risultato = classifica('Bando per il settore gaming', 'Descrizione generica', keywords);
    expect(risultato).toEqual({ priorita: 'alta', scartato: false });
  });

  it('riconosce le keyword di livello 1 case-insensitive', () => {
    const risultato = classifica('BANDO GAMING 2026', '', keywords);
    expect(risultato.priorita).toBe('alta');
  });

  it('riconosce varianti con trattino/spazio (start-up)', () => {
    const risultato = classifica('Bando per le start-up innovative', '', keywords);
    expect(risultato).toEqual({ priorita: 'da_verificare', scartato: false });
  });

  it('assegna da_verificare se trova solo keyword di livello 2', () => {
    const risultato = classifica('Bando sulla tecnologia', 'Progetto di innovazione', keywords);
    expect(risultato).toEqual({ priorita: 'da_verificare', scartato: false });
  });

  it('riconosce keyword in inglese', () => {
    const risultato = classifica('Call for artificial intelligence projects', '', keywords);
    expect(risultato.priorita).toBe('da_verificare');
  });

  it('scarta se non trova nessuna keyword', () => {
    const risultato = classifica('Bando per la ristrutturazione edilizia', 'Contributi per facciate', keywords);
    expect(risultato).toEqual({ priorita: null, scartato: true });
  });

  it('da priorita alta anche se e presente anche una keyword di livello 2', () => {
    const risultato = classifica('Bando fintech e innovazione', '', keywords);
    expect(risultato.priorita).toBe('alta');
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- matching.test`
Expected: FAIL — `Cannot find module './matching.js'`.

- [ ] **Step 3: Implementare `scraper/src/lib/matching.ts`**

```ts
import type { Keywords, MatchResult } from './types.js';

export function normalizzaTesto(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-\s]+/g, '');
}

function contieneKeyword(testoNormalizzato: string, keywords: string[]): boolean {
  return keywords.some((keyword) => testoNormalizzato.includes(normalizzaTesto(keyword)));
}

export function classifica(titolo: string, descrizione: string, keywords: Keywords): MatchResult {
  const testoNormalizzato = normalizzaTesto(`${titolo} ${descrizione}`);

  if (contieneKeyword(testoNormalizzato, keywords.livello1)) {
    return { priorita: 'alta', scartato: false };
  }

  if (contieneKeyword(testoNormalizzato, keywords.livello2)) {
    return { priorita: 'da_verificare', scartato: false };
  }

  return { priorita: null, scartato: true };
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- matching.test`
Expected: PASS — 7 test verdi.

- [ ] **Step 5: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/lib/matching.ts scraper/src/lib/matching.test.ts
git commit -m "Implementa motore di rilevanza a due livelli (matching)"
```

---

### Task 4: Hash del contenuto

**Files:**
- Create: `scraper/src/lib/hash.ts`
- Test: `scraper/src/lib/hash.test.ts`

**Interfaces:**
- Produces: `calcolaHash(titolo: string, descrizione: string): string` — usato da ogni scraper (Task 8) e dai test dell'orchestratore (Task 7).

- [ ] **Step 1: Scrivere il test (fallirà, `hash.ts` non esiste)**

Create `scraper/src/lib/hash.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calcolaHash } from './hash.js';

describe('calcolaHash', () => {
  it('produce lo stesso hash per lo stesso contenuto', () => {
    const a = calcolaHash('Titolo bando', 'Descrizione del bando');
    const b = calcolaHash('Titolo bando', 'Descrizione del bando');
    expect(a).toBe(b);
  });

  it('produce hash diversi per contenuti diversi', () => {
    const a = calcolaHash('Titolo bando', 'Descrizione del bando');
    const b = calcolaHash('Titolo bando', 'Descrizione modificata');
    expect(a).not.toBe(b);
  });

  it('produce una stringa esadecimale di 64 caratteri (sha256)', () => {
    const hash = calcolaHash('Titolo', 'Descrizione');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- hash.test`
Expected: FAIL — `Cannot find module './hash.js'`.

- [ ] **Step 3: Implementare `scraper/src/lib/hash.ts`**

```ts
import { createHash } from 'node:crypto';

export function calcolaHash(titolo: string, descrizione: string): string {
  const contenuto = `${titolo.trim()}\n${descrizione.trim()}`;
  return createHash('sha256').update(contenuto, 'utf8').digest('hex');
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- hash.test`
Expected: PASS — 3 test verdi.

- [ ] **Step 5: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/lib/hash.ts scraper/src/lib/hash.test.ts
git commit -m "Implementa calcolo hash del contenuto per rilevare modifiche"
```

---

### Task 5: Gestione orario/fuso orario

**Files:**
- Create: `scraper/src/lib/schedule.ts`
- Test: `scraper/src/lib/schedule.test.ts`

**Interfaces:**
- Consumes: `ScheduleConfig` da `./types.js` (Task 2).
- Produces: `oraCorrenteRoma(now?: Date): number`, `eOraDiEseguire(schedule: ScheduleConfig, now?: Date): boolean` — usati da `index.ts` (Task 9).

- [ ] **Step 1: Scrivere il test (fallirà, `schedule.ts` non esiste)**

Create `scraper/src/lib/schedule.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { eOraDiEseguire, oraCorrenteRoma } from './schedule.js';
import type { ScheduleConfig } from './types.js';

describe('oraCorrenteRoma', () => {
  it('calcola le 8 del mattino a Roma in orario estivo (CEST, UTC+2)', () => {
    // 2026-07-16T06:00:00Z = 08:00 a Roma in estate
    const data = new Date('2026-07-16T06:00:00Z');
    expect(oraCorrenteRoma(data)).toBe(8);
  });

  it('calcola le 8 del mattino a Roma in orario invernale (CET, UTC+1)', () => {
    // 2026-01-16T07:00:00Z = 08:00 a Roma in inverno
    const data = new Date('2026-01-16T07:00:00Z');
    expect(oraCorrenteRoma(data)).toBe(8);
  });
});

describe('eOraDiEseguire', () => {
  const schedule: ScheduleConfig = { ora: 8, timezone: 'Europe/Rome' };

  it('restituisce true quando l\'ora corrisponde a quella configurata', () => {
    const data = new Date('2026-07-16T06:00:00Z');
    expect(eOraDiEseguire(schedule, data)).toBe(true);
  });

  it('restituisce false quando l\'ora non corrisponde', () => {
    const data = new Date('2026-07-16T10:00:00Z');
    expect(eOraDiEseguire(schedule, data)).toBe(false);
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- schedule.test`
Expected: FAIL — `Cannot find module './schedule.js'`.

- [ ] **Step 3: Implementare `scraper/src/lib/schedule.ts`**

```ts
import type { ScheduleConfig } from './types.js';

export function oraCorrenteRoma(now: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    hour: 'numeric',
    hourCycle: 'h23',
  });
  return Number(formatter.format(now));
}

export function eOraDiEseguire(schedule: ScheduleConfig, now: Date = new Date()): boolean {
  return oraCorrenteRoma(now) === schedule.ora;
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- schedule.test`
Expected: PASS — 4 test verdi.

- [ ] **Step 5: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/lib/schedule.ts scraper/src/lib/schedule.test.ts
git commit -m "Implementa calcolo orario Europe/Rome con gestione automatica ora legale/solare"
```

---

### Task 6: Logica di deduplica

**Files:**
- Create: `scraper/src/lib/dedup.ts`
- Test: `scraper/src/lib/dedup.test.ts`

**Interfaces:**
- Consumes: `BandoRaw`, `EsistenteBando`, `DedupAction` da `./types.js` (Task 2).
- Produces: `decidiAzione(esistente: EsistenteBando | null, incoming: BandoRaw): DedupAction` — usato da `orchestrator.ts` (Task 7).

- [ ] **Step 1: Scrivere il test (fallirà, `dedup.ts` non esiste)**

Create `scraper/src/lib/dedup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decidiAzione } from './dedup.js';
import type { BandoRaw } from './types.js';

const bando: BandoRaw = {
  fonte: 'eit',
  titolo: 'Bando di test',
  descrizione: 'Descrizione di test',
  url: 'https://esempio.it/bando-test',
  scadenza: null,
  data_pubblicazione: null,
  hash_contenuto: 'abc123',
};

describe('decidiAzione', () => {
  it('restituisce insert se il bando non esiste ancora', () => {
    expect(decidiAzione(null, bando)).toBe('insert');
  });

  it('restituisce skip se esiste gia con lo stesso hash', () => {
    expect(decidiAzione({ hash_contenuto: 'abc123' }, bando)).toBe('skip');
  });

  it('restituisce update se esiste ma con hash diverso', () => {
    expect(decidiAzione({ hash_contenuto: 'hash-vecchio' }, bando)).toBe('update');
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- dedup.test`
Expected: FAIL — `Cannot find module './dedup.js'`.

- [ ] **Step 3: Implementare `scraper/src/lib/dedup.ts`**

```ts
import type { BandoRaw, DedupAction, EsistenteBando } from './types.js';

export function decidiAzione(esistente: EsistenteBando | null, incoming: BandoRaw): DedupAction {
  if (!esistente) {
    return 'insert';
  }
  if (esistente.hash_contenuto === incoming.hash_contenuto) {
    return 'skip';
  }
  return 'update';
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- dedup.test`
Expected: PASS — 3 test verdi.

- [ ] **Step 5: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/lib/dedup.ts scraper/src/lib/dedup.test.ts
git commit -m "Implementa logica di deduplica insert/update/skip"
```

---

### Task 7: DbPort, implementazione finta e orchestratore con isolamento errori

**Files:**
- Create: `scraper/src/lib/db-port.ts`
- Create: `scraper/src/lib/db-port-fake.ts`
- Create: `scraper/src/lib/orchestrator.ts`
- Test: `scraper/src/lib/orchestrator.test.ts`

**Interfaces:**
- Consumes: `classifica` (Task 3), `decidiAzione` (Task 6), `BandoRaw`, `Keywords`, `Scraper`, `EsistenteBando`, `Priorita` da `./types.js`.
- Produces: interfaccia `DbPort`, funzione `creaDbPortFake()`, funzione `eseguiRaccolta(scrapers: Scraper[], keywords: Keywords, db: DbPort): Promise<EsecuzioneRisultato>` — usata da `index.ts` (Task 9) e dal job GitHub Actions (Fase 3).

- [ ] **Step 1: Creare `scraper/src/lib/db-port.ts` (interfaccia, nessun test necessario: è solo un contratto)**

```ts
import type { BandoRaw, EsistenteBando, Priorita } from './types.js';

export interface FonteFallita {
  fonte: string;
  errore: string;
}

export interface DbPort {
  trovaEsistente(fonte: string, url: string): Promise<EsistenteBando | null>;
  inserisciBando(bando: BandoRaw, priorita: Priorita | null, scartato: boolean): Promise<void>;
  aggiornaBando(fonte: string, url: string, bando: BandoRaw): Promise<void>;
  registraEsitoJob(fontiOk: string[], fontiFallite: FonteFallita[], nuoviBandi: number): Promise<void>;
}
```

- [ ] **Step 2: Creare `scraper/src/lib/db-port-fake.ts` (test double riutilizzabile)**

```ts
import type { BandoRaw, EsistenteBando, Priorita } from './types.js';
import type { DbPort, FonteFallita } from './db-port.js';

export interface BandoSalvato {
  bando: BandoRaw;
  priorita: Priorita | null;
  scartato: boolean;
}

export interface DbPortFake {
  db: DbPort;
  salvati: BandoSalvato[];
  aggiornati: BandoRaw[];
  ultimoEsito: { fontiOk: string[]; fontiFallite: FonteFallita[]; nuoviBandi: number } | null;
}

export function creaDbPortFake(): DbPortFake {
  const salvati: BandoSalvato[] = [];
  const aggiornati: BandoRaw[] = [];
  const esistenti = new Map<string, EsistenteBando>();
  const stato: DbPortFake = { db: null as unknown as DbPort, salvati, aggiornati, ultimoEsito: null };

  stato.db = {
    async trovaEsistente(fonte, url) {
      return esistenti.get(`${fonte}::${url}`) ?? null;
    },
    async inserisciBando(bando, priorita, scartato) {
      salvati.push({ bando, priorita, scartato });
      esistenti.set(`${bando.fonte}::${bando.url}`, { hash_contenuto: bando.hash_contenuto });
    },
    async aggiornaBando(fonte, url, bando) {
      aggiornati.push(bando);
      esistenti.set(`${fonte}::${url}`, { hash_contenuto: bando.hash_contenuto });
    },
    async registraEsitoJob(fontiOk, fontiFallite, nuoviBandi) {
      stato.ultimoEsito = { fontiOk, fontiFallite, nuoviBandi };
    },
  };

  return stato;
}
```

- [ ] **Step 3: Scrivere i test dell'orchestratore (falliranno, `orchestrator.ts` non esiste)**

Create `scraper/src/lib/orchestrator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { eseguiRaccolta } from './orchestrator.js';
import { creaDbPortFake } from './db-port-fake.js';
import { calcolaHash } from './hash.js';
import type { BandoRaw, Keywords, Scraper } from './types.js';

const keywords: Keywords = {
  livello1: ['gaming'],
  livello2: ['innovazione'],
};

function creaBando(overrides: Partial<BandoRaw> = {}): BandoRaw {
  const titolo = overrides.titolo ?? 'Bando gaming 2026';
  const descrizione = overrides.descrizione ?? 'Descrizione';
  return {
    fonte: 'fonte-test',
    titolo,
    descrizione,
    url: 'https://esempio.it/bando-1',
    scadenza: null,
    data_pubblicazione: null,
    hash_contenuto: calcolaHash(titolo, descrizione),
    ...overrides,
  };
}

describe('eseguiRaccolta', () => {
  it('salva un nuovo bando rilevante e lo segnala tra i nuovi match', async () => {
    const stato = creaDbPortFake();
    const scraperOk: Scraper = { id: 'fonte-test', scrape: async () => [creaBando()] };

    const risultato = await eseguiRaccolta([scraperOk], keywords, stato.db);

    expect(stato.salvati).toHaveLength(1);
    expect(stato.salvati[0].priorita).toBe('alta');
    expect(risultato.nuoviBandiRilevanti).toHaveLength(1);
    expect(risultato.fontiOk).toEqual(['fonte-test']);
    expect(risultato.fontiFallite).toEqual([]);
  });

  it('salva ma non segnala come nuovo match un bando scartato (nessuna keyword)', async () => {
    const stato = creaDbPortFake();
    const bandoScartato = creaBando({ titolo: 'Bando ristrutturazione facciate', descrizione: '' });
    const scraperOk: Scraper = { id: 'fonte-test', scrape: async () => [bandoScartato] };

    const risultato = await eseguiRaccolta([scraperOk], keywords, stato.db);

    expect(stato.salvati).toHaveLength(1);
    expect(stato.salvati[0].scartato).toBe(true);
    expect(risultato.nuoviBandiRilevanti).toHaveLength(0);
  });

  it('isola l\'errore di una fonte e continua con le altre', async () => {
    const stato = creaDbPortFake();
    const scraperOk: Scraper = { id: 'fonte-ok', scrape: async () => [creaBando({ url: 'https://esempio.it/ok' })] };
    const scraperRotto: Scraper = {
      id: 'fonte-rotta',
      scrape: async () => {
        throw new Error('la struttura HTML e cambiata');
      },
    };

    const risultato = await eseguiRaccolta([scraperRotto, scraperOk], keywords, stato.db);

    expect(risultato.fontiOk).toEqual(['fonte-ok']);
    expect(risultato.fontiFallite).toEqual([{ fonte: 'fonte-rotta', errore: 'la struttura HTML e cambiata' }]);
    expect(stato.salvati).toHaveLength(1);
  });

  it('non salva di nuovo un bando gia visto con lo stesso hash (skip)', async () => {
    const stato = creaDbPortFake();
    const bando = creaBando();
    const scraper: Scraper = { id: 'fonte-test', scrape: async () => [bando] };

    await eseguiRaccolta([scraper], keywords, stato.db);
    const secondoRisultato = await eseguiRaccolta([scraper], keywords, stato.db);

    expect(stato.salvati).toHaveLength(1);
    expect(secondoRisultato.nuoviBandiRilevanti).toHaveLength(0);
  });

  it('registra l\'esito del job nel db', async () => {
    const stato = creaDbPortFake();
    const scraperOk: Scraper = { id: 'fonte-test', scrape: async () => [creaBando()] };

    await eseguiRaccolta([scraperOk], keywords, stato.db);

    expect(stato.ultimoEsito).toEqual({ fontiOk: ['fonte-test'], fontiFallite: [], nuoviBandi: 1 });
  });
});
```

- [ ] **Step 4: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- orchestrator.test`
Expected: FAIL — `Cannot find module './orchestrator.js'`.

- [ ] **Step 5: Implementare `scraper/src/lib/orchestrator.ts`**

```ts
import { classifica } from './matching.js';
import { decidiAzione } from './dedup.js';
import type { BandoRaw, Keywords, Priorita, Scraper } from './types.js';
import type { DbPort, FonteFallita } from './db-port.js';

export interface EsecuzioneRisultato {
  nuoviBandiRilevanti: Array<{ bando: BandoRaw; priorita: Priorita }>;
  fontiOk: string[];
  fontiFallite: FonteFallita[];
}

export async function eseguiRaccolta(scrapers: Scraper[], keywords: Keywords, db: DbPort): Promise<EsecuzioneRisultato> {
  const fontiOk: string[] = [];
  const fontiFallite: FonteFallita[] = [];
  const nuoviBandiRilevanti: Array<{ bando: BandoRaw; priorita: Priorita }> = [];

  for (const scraper of scrapers) {
    try {
      const bandiGrezzi = await scraper.scrape();

      for (const bando of bandiGrezzi) {
        const esistente = await db.trovaEsistente(bando.fonte, bando.url);
        const azione = decidiAzione(esistente, bando);

        if (azione === 'skip') {
          continue;
        }

        if (azione === 'update') {
          await db.aggiornaBando(bando.fonte, bando.url, bando);
          continue;
        }

        const { priorita, scartato } = classifica(bando.titolo, bando.descrizione, keywords);
        await db.inserisciBando(bando, priorita, scartato);
        if (!scartato && priorita) {
          nuoviBandiRilevanti.push({ bando, priorita });
        }
      }

      fontiOk.push(scraper.id);
    } catch (err) {
      fontiFallite.push({ fonte: scraper.id, errore: err instanceof Error ? err.message : String(err) });
    }
  }

  await db.registraEsitoJob(fontiOk, fontiFallite, nuoviBandiRilevanti.length);

  return { nuoviBandiRilevanti, fontiOk, fontiFallite };
}
```

- [ ] **Step 6: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- orchestrator.test`
Expected: PASS — 5 test verdi.

- [ ] **Step 7: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/lib/db-port.ts scraper/src/lib/db-port-fake.ts scraper/src/lib/orchestrator.ts scraper/src/lib/orchestrator.test.ts
git commit -m "Implementa orchestratore con isolamento errori per fonte e DbPort testabile"
```

---

### Task 8: Scraper EIT (primo scraper reale)

**Files:**
- Create: `scraper/src/sources/eit.ts`
- Create: `scraper/src/sources/eit.fixtures.ts`
- Test: `scraper/src/sources/eit.test.ts`
- Create: `scraper/src/dev/dry-run-eit.ts`

**Interfaces:**
- Consumes: `BandoRaw`, `Scraper` da `../lib/types.js`; `calcolaHash` da `../lib/hash.js`.
- Produces: `creaEitScraper(fetchHtml?: FetchHtml): Scraper`, `export default` istanza pronta all'uso — usato da `index.ts` (Task 9) e dal job reale in Fase 3.

Nota di verifica: struttura HTML confermata ispezionando dal vivo `https://eit.europa.eu/work-with-us/procurement/calls` (elenco, Drupal Views, classi `views-row` / `views-field-title` / `views-field-field-eit-proc-publication-date`) e una pagina di dettaglio reale (classi `field--name-field-eit-proc-publication-date`, `field--name-field-eit-proc-app-deadline`, `field--name-body`). Entrambe le pagine rispondono correttamente a una richiesta HTTP semplice (verificato con `curl`), senza bisogno di browser.

- [ ] **Step 1: Creare le fixture HTML realistiche, basate sulla struttura reale verificata**

Create `scraper/src/sources/eit.fixtures.ts`:

```ts
export const FIXTURE_LISTA = `
<html><body>
<div class="views-row">
  <div class="views-row-wrapper">
    <div class="views-field views-field-title"><span class="field-content"><a href="/work-with-us/procurement/test-call-1" hreflang="en">Test Call One</a></span></div>
    <div class="views-field views-field-field-eit-proc-publication-date"><span class="views-label views-label-field-eit-proc-publication-date">Published on: </span>10/12/2025 - 12.00</div>
  </div>
</div>
<div class="views-row">
  <div class="views-row-wrapper">
    <div class="views-field views-field-field-icon"><div class="field-content"><a href="https://twitter.com/EITeu">icon</a></div></div>
  </div>
</div>
</body></html>
`;

export const FIXTURE_DETTAGLIO = `
<html><body><article>
<div class="field field--name-field-eit-proc-publication-date field--type-datetime field--label-above">
  <div class="field__label">Publication Date</div>
  <div class="field__item">Wed, 10/12/2025 - 12:00</div>
</div>
<div class="field field--name-field-eit-proc-app-deadline field--type-datetime field--label-above">
  <div class="field__label">Application Deadline</div>
  <div class="field__item">Fri, 23/01/2026 - 16:00</div>
</div>
<div class="clearfix text-formatted field field--name-body field--type-text-with-summary field--label-hidden field__item"><div>Test description content for the call.</div></div>
</article></body></html>
`;
```

- [ ] **Step 2: Scrivere il test dello scraper (fallirà, `eit.ts` non esiste)**

Create `scraper/src/sources/eit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { creaEitScraper } from './eit.js';
import { FIXTURE_DETTAGLIO, FIXTURE_LISTA } from './eit.fixtures.js';

describe('scraper EIT', () => {
  it('estrae titolo, url, date e descrizione dalla lista e dal dettaglio', async () => {
    const fetchHtmlFinto = async (url: string): Promise<string> => {
      if (url === 'https://eit.europa.eu/work-with-us/procurement/calls') {
        return FIXTURE_LISTA;
      }
      if (url === 'https://eit.europa.eu/work-with-us/procurement/test-call-1') {
        return FIXTURE_DETTAGLIO;
      }
      throw new Error(`URL non atteso nel test: ${url}`);
    };

    const scraper = creaEitScraper(fetchHtmlFinto);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(1);
    expect(risultati[0]).toMatchObject({
      fonte: 'eit',
      titolo: 'Test Call One',
      url: 'https://eit.europa.eu/work-with-us/procurement/test-call-1',
      scadenza: '2026-01-23',
      data_pubblicazione: '2025-12-10',
    });
    expect(risultati[0].descrizione).toContain('Test description content');
    expect(risultati[0].hash_contenuto).toMatch(/^[a-f0-9]{64}$/);
  });

  it('ignora le righe della lista senza titolo (es. icone social)', async () => {
    const fetchHtmlFinto = async (url: string): Promise<string> => {
      if (url.endsWith('/calls')) return FIXTURE_LISTA;
      return FIXTURE_DETTAGLIO;
    };

    const scraper = creaEitScraper(fetchHtmlFinto);
    const risultati = await scraper.scrape();

    expect(risultati).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- eit.test`
Expected: FAIL — `Cannot find module './eit.js'`.

- [ ] **Step 4: Implementare `scraper/src/sources/eit.ts`**

```ts
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
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- eit.test`
Expected: PASS — 2 test verdi.

- [ ] **Step 6: Creare lo script di dry-run manuale contro il sito reale**

Create `scraper/src/dev/dry-run-eit.ts`:

```ts
import eitScraper from '../sources/eit.js';

const risultati = await eitScraper.scrape();
console.log(`Trovati ${risultati.length} bandi da EIT:`);
for (const bando of risultati) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'n/d'} | ${bando.url}`);
}
```

- [ ] **Step 7: Eseguire il dry-run contro il sito reale e verificare manualmente l'output**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx tsx src/dev/dry-run-eit.ts`
Expected: stampa almeno un bando reale con titolo, scadenza (se presente) e url validi che puntano a `eit.europa.eu` — conferma che lo scraper funziona contro il sito vero, non solo contro le fixture.

- [ ] **Step 8: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/sources/eit.ts scraper/src/sources/eit.fixtures.ts scraper/src/sources/eit.test.ts scraper/src/dev/dry-run-eit.ts
git commit -m "Implementa e verifica lo scraper EIT (prima fonte reale)"
```

---

### Task 9: Entry point end-to-end e verifica dell'intera pipeline

**Files:**
- Modify: `scraper/src/index.ts`
- Create: `scraper/src/lib/db-port-console.ts`

**Interfaces:**
- Consumes: `caricaKeywords`, `caricaSchedule`, `caricaSources` (Task 2); `eOraDiEseguire` (Task 5); `eseguiRaccolta` (Task 7); `Scraper` (Task 2).
- Produces: comando eseguibile `npm start -- --force` che esegue l'intera pipeline reale end-to-end (usato manualmente qui, e come base per il job GitHub Actions in Fase 3).

- [ ] **Step 1: Creare `scraper/src/lib/db-port-console.ts`**

```ts
import type { DbPort, FonteFallita } from './db-port.js';

export function creaDbPortConsole(): DbPort {
  return {
    async trovaEsistente() {
      return null;
    },
    async inserisciBando(bando, priorita, scartato) {
      console.log(`[NUOVO] (${priorita ?? 'scartato'}) ${bando.titolo} — ${bando.url}`);
    },
    async aggiornaBando(_fonte, _url, bando) {
      console.log(`[AGGIORNATO] ${bando.titolo}`);
    },
    async registraEsitoJob(fontiOk: string[], fontiFallite: FonteFallita[], nuoviBandi: number) {
      console.log(`Esito: ${nuoviBandi} nuovi bandi, fonti ok: ${fontiOk.join(', ') || 'nessuna'}, fonti fallite: ${fontiFallite.map((f) => f.fonte).join(', ') || 'nessuna'}`);
    },
  };
}
```

- [ ] **Step 2: Sostituire `scraper/src/index.ts` con l'entry point completo**

```ts
import { caricaKeywords, caricaSchedule, caricaSources } from './lib/config.js';
import { creaDbPortConsole } from './lib/db-port-console.js';
import { eseguiRaccolta } from './lib/orchestrator.js';
import { eOraDiEseguire } from './lib/schedule.js';
import type { Scraper } from './lib/types.js';

async function costruisciScraperAttivi(): Promise<Scraper[]> {
  const fontiAttive = caricaSources().filter((f) => f.attivo && f.scraperModule);
  const scrapers: Scraper[] = [];

  for (const fonte of fontiAttive) {
    const modulo = await import(`./sources/${fonte.scraperModule}.js`);
    scrapers.push(modulo.default as Scraper);
  }

  return scrapers;
}

async function main(): Promise<void> {
  const schedule = caricaSchedule();
  const forzaEsecuzione = process.argv.includes('--force');

  if (!forzaEsecuzione && !eOraDiEseguire(schedule)) {
    console.log(`Non e l'ora configurata (${schedule.ora}:00 ${schedule.timezone}), esco senza eseguire.`);
    return;
  }

  const keywords = caricaKeywords();
  const scrapers = await costruisciScraperAttivi();
  const db = creaDbPortConsole();

  const risultato = await eseguiRaccolta(scrapers, keywords, db);

  console.log(`\nTrovati ${risultato.nuoviBandiRilevanti.length} nuovi bandi rilevanti.`);
  if (risultato.fontiFallite.length > 0) {
    console.log('Attenzione, fonti fallite:', risultato.fontiFallite);
  }
}

main().catch((err) => {
  console.error('Errore fatale nel job:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Eseguire l'intera suite di test e verificare che passi tutta**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test`
Expected: PASS — tutti i test di tutti i task precedenti (config, matching, hash, schedule, dedup, orchestrator, eit) verdi, nessun fallimento.

- [ ] **Step 4: Eseguire il typecheck**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm run typecheck`
Expected: nessun errore di tipo riportato.

- [ ] **Step 5: Eseguire la pipeline completa contro il sito reale con `--force`**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx tsx src/index.ts --force`
Expected: la console mostra righe `[NUOVO]` per i bandi EIT rilevanti trovati (o nessuna se nessun bando EIT corrente contiene le keyword configurate — verificabile controllando l'elenco stampato) seguite dalla riga di esito con conteggio fonti ok/fallite. Nessun errore fatale.

- [ ] **Step 6: Verificare che l'uscita anticipata funzioni quando non e l'ora configurata**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx tsx src/index.ts`
Expected: se l'orario corrente di Roma non e le 8, stampa `Non e l'ora configurata...` ed esce subito senza eseguire alcuno scraper.

- [ ] **Step 7: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/index.ts scraper/src/lib/db-port-console.ts
git commit -m "Completa entry point end-to-end della pipeline (Fase 1)"
```

---

### Task 10: Wrap-up Fase 1

**Files:**
- Create: `scraper/README.md`

**Interfaces:**
- Nessuna nuova interfaccia: task di sola documentazione.

- [ ] **Step 1: Creare `scraper/README.md`**

```markdown
# QYROS Bandi Monitor — scraper

## Comandi disponibili

- `npm install` — installa le dipendenze
- `npm test` — esegue tutti i test automatici (nessuna chiamata di rete reale)
- `npm run typecheck` — verifica i tipi TypeScript
- `npx tsx src/index.ts` — esegue la pipeline reale (solo se e l'ora configurata in `config/schedule.json`)
- `npx tsx src/index.ts --force` — esegue la pipeline reale ignorando l'orario configurato (utile per test manuali)
- `npx tsx src/dev/dry-run-eit.ts` — esegue solo lo scraper EIT contro il sito reale e stampa i risultati

## Stato Fase 1

Fondamenta complete: tipi condivisi, motore di matching a due livelli, hash contenuto,
gestione orario Europe/Rome, deduplica, orchestratore con isolamento errori per fonte,
primo scraper reale (EIT) verificato contro il sito live.

Il salvataggio su database e l'invio email non sono ancora collegati a servizi reali
(Fase 1 usa una implementazione "console" del DbPort a scopo dimostrativo). Il vero
adattatore Supabase e l'invio email via Resend arrivano in Fase 3, quando gli account
saranno stati creati.

Le restanti 7 fonti (EU Portal, Europa Creativa MEDIA, incentivi.gov.it, Invitalia,
Regione Lombardia, Fondazione Cariplo, e l'ottavo slot personalizzabile) vengono
implementate una alla volta in Fase 2, seguendo lo stesso pattern di `src/sources/eit.ts`.
```

- [ ] **Step 2: Commit finale della Fase 1**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/README.md
git commit -m "Documenta stato e comandi della Fase 1"
```

---

## Riepilogo copertura spec (Fase 1)

- Formato dati normalizzato (`BandoRaw`) — Task 2.
- Motore di rilevanza a due livelli, italiano/inglese, gestione varianti trattino/spazio — Task 3.
- Hash contenuto per rilevare modifiche — Task 4.
- Gestione orario Europe/Rome configurabile senza toccare YAML, con gestione automatica ora legale/solare — Task 5.
- Deduplica insert/update/skip — Task 6.
- Isolamento errori per fonte (un fallimento non blocca le altre) — Task 7.
- Primo scraper reale isolato e verificato contro il sito live — Task 8.
- Pipeline end-to-end eseguibile manualmente — Task 9.

Fuori scope per la Fase 1 (rimandato alle fasi successive, come da spec): le restanti 7
fonti (Fase 2), il job GitHub Actions e l'invio email reale via Resend (Fase 3), la
dashboard (Fase 4), la creazione degli account e il deploy (Fase 5).
