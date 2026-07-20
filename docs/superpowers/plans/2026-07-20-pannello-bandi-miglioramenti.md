# Pannello e bandi: miglioramenti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify the admin by email on every new access request, show the real matched keyword on each bando card instead of an abstract badge, let logged-in users suggest new keywords, count keyword-filter clicks to help prune the list, and add small header UX polish (tooltips, a bug-report icon).

**Architecture:** Eight independent slices spanning the scraper (Node/TS), the Supabase schema, a new Edge Function + Database Webhook, and the dashboard (React). The scraper starts recording which keyword(s) actually matched each bando (a new column, populated going forward by the scraper and backfilled once for existing rows). The dashboard's keyword filter chips switch from a static bundled JSON file to the live `parole_chiave` table, which is the foundation both the click-counter and the new keyword-suggestion feature need.

**Tech Stack:** Node/TypeScript (scraper), React 18 + TypeScript + MUI v6 (dashboard), Deno Edge Function (Supabase), PostgreSQL, Vitest + Testing Library.

## Global Constraints

- No duplicated matching logic: the one-time backfill (Task 3) and any future keyword-matching code must reuse `scraper/src/lib/matching.ts`'s `classifica()`, never reimplement the normalization/substring rules elsewhere.
- All UI copy is Italian.
- All interactive controls keep the existing 44px minimum touch target (`sx={{ minHeight: 44 }}` / `sx={{ minWidth: 44, minHeight: 44 }}`).
- Single admin only, hardcoded `EMAIL_AMMINISTRATORE` (`panto75@gmail.com`) — no roles work.
- RLS policies always need an explicit `GRANT` alongside them — this project has hit "permission denied" from RLS-without-grant twice before; every new table in this plan must ship with both.
- The card badge showing the matched keyword (Task 4) and the live text-search keyword filter (`filtriBandi.ts`, unchanged in this plan) are deliberately different: the badge reflects the stable, stored reason a bando was classified; the filter recomputes live against current title/description text. Do not unify them.

---

## Task 1: Scraper records which keyword(s) matched

**Files:**
- Modify: `scraper/src/lib/types.ts`
- Modify: `scraper/src/lib/matching.ts`
- Modify: `scraper/src/lib/matching.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `MatchResult` gains `paroleTrovate: string[]`, consumed by Task 2 (threading it into the save path) and Task 3 (the backfill script imports `classifica` directly).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `scraper/src/lib/matching.test.ts` with:

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
    expect(risultato).toEqual({ priorita: 'alta', scartato: false, paroleTrovate: ['gaming'] });
  });

  it('riconosce le keyword di livello 1 case-insensitive', () => {
    const risultato = classifica('BANDO GAMING 2026', '', keywords);
    expect(risultato.priorita).toBe('alta');
  });

  it('riconosce varianti con trattino/spazio (start-up)', () => {
    const risultato = classifica('Bando per le start-up innovative', '', keywords);
    expect(risultato).toEqual({ priorita: 'da_verificare', scartato: false, paroleTrovate: ['startup', 'start-up'] });
  });

  it('assegna da_verificare se trova solo keyword di livello 2', () => {
    const risultato = classifica('Bando sulla tecnologia', 'Progetto di innovazione', keywords);
    expect(risultato).toEqual({ priorita: 'da_verificare', scartato: false, paroleTrovate: ['tecnologia', 'innovazione'] });
  });

  it('riconosce keyword in inglese', () => {
    const risultato = classifica('Call for artificial intelligence projects', '', keywords);
    expect(risultato.priorita).toBe('da_verificare');
  });

  it('scarta se non trova nessuna keyword', () => {
    const risultato = classifica('Bando per la ristrutturazione edilizia', 'Contributi per facciate', keywords);
    expect(risultato).toEqual({ priorita: null, scartato: true, paroleTrovate: [] });
  });

  it('da priorita alta anche se e presente anche una keyword di livello 2', () => {
    const risultato = classifica('Bando fintech e innovazione', '', keywords);
    expect(risultato.priorita).toBe('alta');
  });

  it('elenca tutte le parole di livello 1 trovate, non solo la prima', () => {
    const risultato = classifica('Bando fintech per il gaming', '', keywords);
    expect(risultato.paroleTrovate).toEqual(['gaming', 'fintech']);
  });

  it('non elenca parole di livello 2 quando ne ha gia trovata una di livello 1', () => {
    const risultato = classifica('Bando fintech e innovazione', '', keywords);
    expect(risultato.paroleTrovate).toEqual(['fintech']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd scraper && npm test -- matching`
Expected: FAIL — `classifica()` currently returns only `{ priorita, scartato }`, so every `.toEqual` assertion including `paroleTrovate` fails, and `risultato.paroleTrovate` is `undefined` in the two tests that read it directly.

- [ ] **Step 3: Add `paroleTrovate` to `MatchResult`**

In `scraper/src/lib/types.ts`, replace:

```ts
export interface MatchResult {
  priorita: Priorita | null;
  scartato: boolean;
}
```

with:

```ts
export interface MatchResult {
  priorita: Priorita | null;
  scartato: boolean;
  paroleTrovate: string[];
}
```

- [ ] **Step 4: Update `classifica()` to collect matched keywords**

Leave the `import` line and `normalizzaTesto()` in `scraper/src/lib/matching.ts` completely untouched — do not retype or reformat that function (it contains a Unicode combining-diacritics regex, `/[̀-ͯ]/g`, that must stay byte-for-byte exactly as it already is; retyping it from scratch risks silently corrupting the accent-stripping behavior). Only replace the part below it. Replace:

```ts
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

with:

```ts
function keywordCorrispondenti(testoNormalizzato: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => testoNormalizzato.includes(normalizzaTesto(keyword)));
}

export function classifica(titolo: string, descrizione: string, keywords: Keywords): MatchResult {
  const testoNormalizzato = normalizzaTesto(`${titolo} ${descrizione}`);

  const trovateLivello1 = keywordCorrispondenti(testoNormalizzato, keywords.livello1);
  if (trovateLivello1.length > 0) {
    return { priorita: 'alta', scartato: false, paroleTrovate: trovateLivello1 };
  }

  const trovateLivello2 = keywordCorrispondenti(testoNormalizzato, keywords.livello2);
  if (trovateLivello2.length > 0) {
    return { priorita: 'da_verificare', scartato: false, paroleTrovate: trovateLivello2 };
  }

  return { priorita: null, scartato: true, paroleTrovate: [] };
}
```

(`contieneKeyword` — the old boolean-only helper — is fully superseded by `keywordCorrispondenti`, which returns the actual matched words; there is no remaining caller of `contieneKeyword`, so this removes it rather than leaving dead code.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd scraper && npm test -- matching`
Expected: PASS (11 tests: 9 existing + 2 new).

- [ ] **Step 6: Typecheck and commit**

Run: `cd scraper && npm run typecheck` (if the script exists; otherwise `npx tsc --noEmit`)
Expected: FAIL only if `MatchResult` is used elsewhere with the old shape — that is expected and fixed in Task 2. If typecheck fails here on files outside `matching.ts`/`matching.test.ts`/`types.ts`, that is Task 2's job, not this task's — do not fix it now.

```bash
git add scraper/src/lib/types.ts scraper/src/lib/matching.ts scraper/src/lib/matching.test.ts
git commit -m "feat(scraper): classifica() records which keyword(s) actually matched"
```

---

## Task 2: Thread matched keywords into the save path, add the database column

**Files:**
- Modify: `scraper/src/lib/db-port.ts`
- Modify: `scraper/src/lib/db-port-supabase.ts`
- Modify: `scraper/src/lib/db-port-fake.ts`
- Modify: `scraper/src/lib/orchestrator.ts`
- Modify: `scraper/src/lib/orchestrator.test.ts`

**Interfaces:**
- Consumes: `MatchResult.paroleTrovate` (Task 1).
- Produces: `DbPort.inserisciBando` gains a `paroleTrovate: string[]` parameter; the `bandi` table gains a `parole_corrispondenti text[]` column. Task 3's backfill and Task 4's dashboard display both read this column.

- [ ] **Step 1: Write the failing test**

In `scraper/src/lib/orchestrator.test.ts`, replace the first test:

```ts
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
```

with:

```ts
  it('salva un nuovo bando rilevante, con le parole trovate, e lo segnala tra i nuovi match', async () => {
    const stato = creaDbPortFake();
    const scraperOk: Scraper = { id: 'fonte-test', scrape: async () => [creaBando()] };

    const risultato = await eseguiRaccolta([scraperOk], keywords, stato.db);

    expect(stato.salvati).toHaveLength(1);
    expect(stato.salvati[0].priorita).toBe('alta');
    expect(stato.salvati[0].paroleTrovate).toEqual(['gaming']);
    expect(risultato.nuoviBandiRilevanti).toHaveLength(1);
    expect(risultato.fontiOk).toEqual(['fonte-test']);
    expect(risultato.fontiFallite).toEqual([]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd scraper && npm test -- orchestrator`
Expected: FAIL — `stato.salvati[0].paroleTrovate` is `undefined`, since `inserisciBando` doesn't accept or store it yet.

- [ ] **Step 3: Add `paroleTrovate` to the `DbPort` interface**

In `scraper/src/lib/db-port.ts`, replace:

```ts
export interface DbPort {
  trovaEsistente(fonte: string, url: string): Promise<EsistenteBando | null>;
  inserisciBando(bando: BandoRaw, priorita: Priorita | null, scartato: boolean): Promise<void>;
  aggiornaBando(fonte: string, url: string, bando: BandoRaw): Promise<void>;
  registraEsitoJob(fontiOk: string[], fontiFallite: FonteFallita[], nuoviBandi: number): Promise<void>;
}
```

with:

```ts
export interface DbPort {
  trovaEsistente(fonte: string, url: string): Promise<EsistenteBando | null>;
  inserisciBando(bando: BandoRaw, priorita: Priorita | null, scartato: boolean, paroleTrovate: string[]): Promise<void>;
  aggiornaBando(fonte: string, url: string, bando: BandoRaw): Promise<void>;
  registraEsitoJob(fontiOk: string[], fontiFallite: FonteFallita[], nuoviBandi: number): Promise<void>;
}
```

- [ ] **Step 4: Update the orchestrator to pass `paroleTrovate` through**

In `scraper/src/lib/orchestrator.ts`, replace:

```ts
        const { priorita, scartato } = classifica(bando.titolo, bando.descrizione, keywords);
        await db.inserisciBando(bando, priorita, scartato);
```

with:

```ts
        const { priorita, scartato, paroleTrovate } = classifica(bando.titolo, bando.descrizione, keywords);
        await db.inserisciBando(bando, priorita, scartato, paroleTrovate);
```

- [ ] **Step 5: Update the fake DB port used by tests**

In `scraper/src/lib/db-port-fake.ts`, replace:

```ts
export interface BandoSalvato {
  bando: BandoRaw;
  priorita: Priorita | null;
  scartato: boolean;
}
```

with:

```ts
export interface BandoSalvato {
  bando: BandoRaw;
  priorita: Priorita | null;
  scartato: boolean;
  paroleTrovate: string[];
}
```

and replace:

```ts
    async inserisciBando(bando, priorita, scartato) {
      salvati.push({ bando, priorita, scartato });
      esistenti.set(`${bando.fonte}::${bando.url}`, { hash_contenuto: bando.hash_contenuto });
    },
```

with:

```ts
    async inserisciBando(bando, priorita, scartato, paroleTrovate) {
      salvati.push({ bando, priorita, scartato, paroleTrovate });
      esistenti.set(`${bando.fonte}::${bando.url}`, { hash_contenuto: bando.hash_contenuto });
    },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd scraper && npm test -- orchestrator`
Expected: PASS (6 tests, all unchanged except the one edited in Step 1).

- [ ] **Step 7: Update the real Supabase DB port**

In `scraper/src/lib/db-port-supabase.ts`, replace:

```ts
    async inserisciBando(bando: BandoRaw, priorita: Priorita | null, scartato: boolean): Promise<void> {
      const { error } = await client.from('bandi').insert({
        fonte: bando.fonte,
        titolo: bando.titolo,
        descrizione: bando.descrizione,
        url: bando.url,
        scadenza: bando.scadenza,
        data_pubblicazione: bando.data_pubblicazione,
        hash_contenuto: bando.hash_contenuto,
        priorita,
        scartato,
      });
      if (error) throw new Error(`Supabase inserisciBando: ${error.message}`);
    },
```

with:

```ts
    async inserisciBando(bando: BandoRaw, priorita: Priorita | null, scartato: boolean, paroleTrovate: string[]): Promise<void> {
      const { error } = await client.from('bandi').insert({
        fonte: bando.fonte,
        titolo: bando.titolo,
        descrizione: bando.descrizione,
        url: bando.url,
        scadenza: bando.scadenza,
        data_pubblicazione: bando.data_pubblicazione,
        hash_contenuto: bando.hash_contenuto,
        priorita,
        scartato,
        parole_corrispondenti: paroleTrovate,
      });
      if (error) throw new Error(`Supabase inserisciBando: ${error.message}`);
    },
```

- [ ] **Step 8: Full scraper test suite, typecheck, and commit**

Run: `cd scraper && npm test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

```bash
git add scraper/src/lib/db-port.ts scraper/src/lib/db-port-supabase.ts scraper/src/lib/db-port-fake.ts scraper/src/lib/orchestrator.ts scraper/src/lib/orchestrator.test.ts
git commit -m "feat(scraper): persist matched keywords into bandi.parole_corrispondenti"
```

- [ ] **Step 9: Add the database column**

Append to `supabase/schema.sql`:

```sql
-- Fase 6e: colonna per le parole chiave che hanno causato la classificazione
-- di ogni bando (invece di mostrare solo l'etichetta astratta "Match
-- diretto"/"Da verificare" nella dashboard).
alter table bandi add column if not exists parole_corrispondenti text[] not null default '{}';
```

Apply it to the live database (this project has no authenticated Supabase CLI in this environment — use the `apply_migration` MCP tool against project ref `atcdtnmwbllvdeikswfk` with the same SQL, or guide the user through the SQL Editor if that tool isn't available in the execution environment). Verify with a read-only query that the column exists before continuing.

```bash
git add supabase/schema.sql
git commit -m "docs(supabase): track parole_corrispondenti column in schema.sql"
```

---

## Task 3: One-time backfill for bandi collected before this change

**Files:**
- Create: `scraper/scripts/backfill-parole-corrispondenti.ts`
- Create: `.github/workflows/backfill-parole-corrispondenti.yml`

**Interfaces:**
- Consumes: `classifica()` (Task 1), `caricaKeywords()` (existing, `scraper/src/lib/config.ts`), `creaClienteSupabaseReale()` (existing, `scraper/src/lib/db-port-supabase.ts`). Reuses all three directly — no reimplementation.
- Produces: nothing consumed by later tasks — this is a one-time operational script, run once after merge, not part of the ongoing pipeline.

This task has no automated test: it is a one-off data migration against production data, not a feature with a test suite. Its correctness is verified by construction (it calls the exact same, already-tested `classifica()` function Task 1 covers) and by a live spot-check after running it (Step 4).

- [ ] **Step 1: Write the backfill script**

Create `scraper/scripts/backfill-parole-corrispondenti.ts`:

```ts
import { creaClienteSupabaseReale } from '../src/lib/db-port-supabase.js';
import { caricaKeywords } from '../src/lib/config.js';
import { classifica } from '../src/lib/matching.js';

async function main() {
  const client = creaClienteSupabaseReale();
  const keywords = await caricaKeywords(client);

  const { data, error } = await client.from('bandi').select('id, titolo, descrizione');
  if (error) {
    throw new Error(`Impossibile leggere i bandi: ${error.message}`);
  }

  const bandi = (data ?? []) as { id: string; titolo: string; descrizione: string }[];
  let aggiornati = 0;
  let senzaCorrispondenza = 0;

  for (const bando of bandi) {
    const { paroleTrovate } = classifica(bando.titolo, bando.descrizione, keywords);
    if (paroleTrovate.length === 0) {
      senzaCorrispondenza++;
      continue;
    }

    const { error: erroreUpdate } = await client
      .from('bandi')
      .update({ parole_corrispondenti: paroleTrovate })
      .eq('id', bando.id);
    if (erroreUpdate) {
      console.error(`Errore aggiornando il bando ${bando.id}: ${erroreUpdate.message}`);
      continue;
    }
    aggiornati++;
  }

  console.log(
    `Backfill completato: ${aggiornati} bandi aggiornati, ${senzaCorrispondenza} senza corrispondenza con le parole chiave attuali, su ${bandi.length} totali.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add a one-off GitHub Actions workflow to run it**

Create `.github/workflows/backfill-parole-corrispondenti.yml`:

```yaml
name: Backfill parole corrispondenti (una tantum)

on:
  workflow_dispatch:

jobs:
  esegui:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: scraper
    steps:
      - name: Scarica il codice
        uses: actions/checkout@v4

      - name: Prepara Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: scraper/package-lock.json

      - name: Installa le dipendenze
        run: npm ci

      - name: Esegui il backfill
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: npx tsx scripts/backfill-parole-corrispondenti.ts
```

This reuses the same `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` repo secrets already configured for `daily-job.yml` — no new secrets needed.

- [ ] **Step 3: Typecheck and commit**

Run: `cd scraper && npx tsc --noEmit`
Expected: no errors (the script only imports already-typed, already-compiling modules).

```bash
git add scraper/scripts/backfill-parole-corrispondenti.ts .github/workflows/backfill-parole-corrispondenti.yml
git commit -m "feat(scraper): one-time backfill script for parole_corrispondenti"
```

- [ ] **Step 4: Run it once against production and verify**

After this task's commit is merged to `main` (do not run against a branch that hasn't merged — the workflow reads code via `actions/checkout` from whatever ref `main` points to at dispatch time):

```bash
gh workflow run backfill-parole-corrispondenti.yml
```

Poll `gh run list --workflow=backfill-parole-corrispondenti.yml --limit 1` until the run shows `completed`/`success`, then check its log for the summary line ("Backfill completato: N bandi aggiornati..."). Spot-check with a read-only query against the `atcdtnmwbllvdeikswfk` project (`select id, titolo, parole_corrispondenti from bandi where priorita is not null limit 5;`) to confirm `parole_corrispondenti` is now populated (non-empty array) for existing rows.

---

## Task 4: Dashboard shows the matched keyword instead of the abstract badge

**Files:**
- Modify: `dashboard/src/lib/types.ts`
- Modify: `dashboard/src/components/ListaBandi.tsx`
- Modify: `dashboard/src/components/BandoCard.tsx`
- Modify: `dashboard/src/components/BandoCard.test.tsx`

**Interfaces:**
- Consumes: `bandi.parole_corrispondenti` (Task 2's column, populated going forward and by Task 3's backfill).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing tests**

In `dashboard/src/components/BandoCard.test.tsx`, replace:

```tsx
function creaBando(overrides: Partial<Bando> = {}): Bando {
  return {
    id: '1',
    fonte: 'eit',
    titolo: 'Bando di test',
    descrizione: 'Descrizione',
    url: 'https://esempio.it/bando-test',
    scadenza: '2026-12-31',
    data_pubblicazione: null,
    priorita: 'alta',
    stato: 'nuovo',
    ...overrides,
  };
}

describe('BandoCard', () => {
  it('mostra il badge "Match diretto" per priorita alta', () => {
    render(<BandoCard bando={creaBando({ priorita: 'alta' })} onCambiaStato={vi.fn()} />);
    expect(screen.getByText('Match diretto')).toBeInTheDocument();
  });

  it('mostra il badge "Da verificare" per priorita da_verificare', () => {
    render(<BandoCard bando={creaBando({ priorita: 'da_verificare' })} onCambiaStato={vi.fn()} />);
    expect(screen.getByText('Da verificare')).toBeInTheDocument();
  });
```

with:

```tsx
function creaBando(overrides: Partial<Bando> = {}): Bando {
  return {
    id: '1',
    fonte: 'eit',
    titolo: 'Bando di test',
    descrizione: 'Descrizione',
    url: 'https://esempio.it/bando-test',
    scadenza: '2026-12-31',
    data_pubblicazione: null,
    priorita: 'alta',
    stato: 'nuovo',
    parole_corrispondenti: ['gaming'],
    ...overrides,
  };
}

describe('BandoCard', () => {
  it('mostra la parola chiave corrispondente invece di un\'etichetta astratta', () => {
    render(<BandoCard bando={creaBando({ parole_corrispondenti: ['fintech'] })} onCambiaStato={vi.fn()} />);
    expect(screen.getByText('Corrisponde a: fintech')).toBeInTheDocument();
  });

  it('elenca più parole corrispondenti separate da virgola', () => {
    render(<BandoCard bando={creaBando({ parole_corrispondenti: ['gaming', 'fintech'] })} onCambiaStato={vi.fn()} />);
    expect(screen.getByText('Corrisponde a: gaming, fintech')).toBeInTheDocument();
  });

  it('non mostra il vecchio badge "Match diretto"/"Da verificare"', () => {
    render(<BandoCard bando={creaBando({ priorita: 'alta', parole_corrispondenti: ['gaming'] })} onCambiaStato={vi.fn()} />);
    expect(screen.queryByText('Match diretto')).not.toBeInTheDocument();
    expect(screen.queryByText('Da verificare')).not.toBeInTheDocument();
  });
```

Leave every other test in the file unchanged (they exercise unrelated behavior — title/fonte/scadenza display, the visto/nuovo toggle, the countdown badge — and `creaBando`'s new `parole_corrispondenti: ['gaming']` default keeps them passing without modification).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dashboard && npm test -- BandoCard`
Expected: FAIL — the component still renders a "Match diretto"/"Da verificare" `Chip`, so `getByText('Corrisponde a: fintech')` finds nothing, and the two old-badge tests you just removed no longer exist to conflict, but the three new tests fail as described.

- [ ] **Step 3: Add `parole_corrispondenti` to the `Bando` type**

In `dashboard/src/lib/types.ts`, replace:

```ts
export interface Bando {
  id: string;
  fonte: string;
  titolo: string;
  descrizione: string;
  url: string;
  scadenza: string | null;
  data_pubblicazione: string | null;
  priorita: Priorita | null;
  stato: Stato;
}
```

with:

```ts
export interface Bando {
  id: string;
  fonte: string;
  titolo: string;
  descrizione: string;
  url: string;
  scadenza: string | null;
  data_pubblicazione: string | null;
  priorita: Priorita | null;
  stato: Stato;
  parole_corrispondenti: string[];
}
```

- [ ] **Step 4: Fetch the new column in `ListaBandi.tsx`**

In `dashboard/src/components/ListaBandi.tsx`, replace:

```tsx
      .select('id, fonte, titolo, descrizione, url, scadenza, data_pubblicazione, priorita, stato')
```

with:

```tsx
      .select('id, fonte, titolo, descrizione, url, scadenza, data_pubblicazione, priorita, stato, parole_corrispondenti')
```

- [ ] **Step 5: Replace the badge in `BandoCard.tsx`**

In `dashboard/src/components/BandoCard.tsx`, replace:

```tsx
export function BandoCard({ bando, onCambiaStato }: BandoCardProps) {
  const eVisto = bando.stato === 'visto';
  const eAlta = bando.priorita === 'alta';
  const giorniAllaScadenza = bando.scadenza ? calcolaGiorniAllaScadenza(bando.scadenza, new Date()) : null;
  const eInAllarme = giorniAllaScadenza !== null && giorniAllaScadenza < SOGLIA_GIORNI_ALLARME;

  return (
    <Card sx={{ opacity: eVisto ? 0.6 : 1, transition: 'opacity 0.2s ease', height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Chip
            label={eAlta ? 'Match diretto' : 'Da verificare'}
            size="small"
            sx={{
              bgcolor: eAlta ? 'primary.main' : 'secondary.main',
              color: '#ffffff',
              fontWeight: 600,
            }}
          />
```

with:

```tsx
export function BandoCard({ bando, onCambiaStato }: BandoCardProps) {
  const eVisto = bando.stato === 'visto';
  const eAlta = bando.priorita === 'alta';
  const giorniAllaScadenza = bando.scadenza ? calcolaGiorniAllaScadenza(bando.scadenza, new Date()) : null;
  const eInAllarme = giorniAllaScadenza !== null && giorniAllaScadenza < SOGLIA_GIORNI_ALLARME;

  return (
    <Card sx={{ opacity: eVisto ? 0.6 : 1, transition: 'opacity 0.2s ease', height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          {bando.parole_corrispondenti.length > 0 && (
            <Chip
              label={`Corrisponde a: ${bando.parole_corrispondenti.join(', ')}`}
              size="small"
              sx={{
                bgcolor: eAlta ? 'primary.main' : 'secondary.main',
                color: '#ffffff',
                fontWeight: 600,
              }}
            />
          )}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd dashboard && npm test -- BandoCard`
Expected: PASS (10 tests: 7 unchanged + 3 new).

- [ ] **Step 7: Full suite, typecheck, and commit**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: no errors, all suites pass.

```bash
git add dashboard/src/lib/types.ts dashboard/src/components/ListaBandi.tsx dashboard/src/components/BandoCard.tsx dashboard/src/components/BandoCard.test.tsx
git commit -m "feat(dashboard): show the matched keyword on bando cards instead of an abstract badge"
```

---

## Task 5: Keyword suggestions from logged-in users

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `dashboard/src/lib/types.ts`
- Create: `dashboard/src/components/SuggerisciParolaChiave.tsx`
- Create: `dashboard/src/components/SuggerisciParolaChiave.test.tsx`
- Modify: `dashboard/src/components/ListaBandi.tsx`
- Modify: `dashboard/src/components/admin/Configurazione.tsx`
- Modify: `dashboard/src/components/admin/Configurazione.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks in this plan.
- Produces: `SuggerimentoParolaChiave` type (`dashboard/src/lib/types.ts`), consumed only within this task's own files.

- [ ] **Step 1: Add the table, RLS, and grants**

Append to `supabase/schema.sql`:

```sql
-- Fase 6e: suggerimenti di nuove parole chiave da parte di utenti loggati
-- (non solo l'amministratore). Stesso schema di approvazione già usato per
-- richieste_accesso: chiunque autenticato può proporre, solo l'amministratore
-- legge/gestisce.
create table if not exists suggerimenti_parole_chiave (
  id uuid primary key default gen_random_uuid(),
  parola text not null,
  proposto_da text not null default (auth.jwt() ->> 'email'),
  proposto_il timestamptz not null default now(),
  stato text not null default 'in_attesa' check (stato in ('in_attesa', 'accettato', 'rifiutato'))
);

alter table suggerimenti_parole_chiave enable row level security;

create policy "suggerimenti_insert_authenticated" on suggerimenti_parole_chiave
  for insert to authenticated with check (true);

create policy "suggerimenti_admin_select" on suggerimenti_parole_chiave
  for select to authenticated using (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "suggerimenti_admin_update" on suggerimenti_parole_chiave
  for update to authenticated
  using (auth.jwt() ->> 'email' = 'panto75@gmail.com')
  with check (auth.jwt() ->> 'email' = 'panto75@gmail.com');

-- Grant esplicita: RLS da sola non basta senza questa (già scoperto due
-- volte in questo progetto).
grant select, insert, update on table public.suggerimenti_parole_chiave to authenticated;
grant all on table public.suggerimenti_parole_chiave to service_role;
```

Apply it to the live database (`apply_migration` MCP tool against project ref `atcdtnmwbllvdeikswfk`, or guide the user through the SQL Editor). Verify with `select * from suggerimenti_parole_chiave limit 1;` (should return zero rows, no error) before continuing.

```bash
git add supabase/schema.sql
git commit -m "docs(supabase): add suggerimenti_parole_chiave table, RLS, and grants"
```

- [ ] **Step 2: Add the `SuggerimentoParolaChiave` type**

In `dashboard/src/lib/types.ts`, add after the `ParolaChiave` interface:

```ts
export interface SuggerimentoParolaChiave {
  id: string;
  parola: string;
  proposto_da: string;
  proposto_il: string;
  stato: 'in_attesa' | 'accettato' | 'rifiutato';
}
```

- [ ] **Step 3: Write the failing test for the suggestion form**

Create `dashboard/src/components/SuggerisciParolaChiave.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const inserisciFinto = vi.fn(async (valori: { parola: string }) => ({
  error: null as { message: string } | null,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (valori: { parola: string }) => inserisciFinto(valori),
    }),
  },
}));

import { SuggerisciParolaChiave } from './SuggerisciParolaChiave';

describe('SuggerisciParolaChiave', () => {
  it('invia il suggerimento e mostra una conferma', async () => {
    const utente = userEvent.setup();
    render(<SuggerisciParolaChiave />);

    await utente.type(screen.getByLabelText('Suggerisci una parola chiave'), 'blockchain');
    await utente.click(screen.getByRole('button', { name: 'Invia' }));

    await waitFor(() => expect(inserisciFinto).toHaveBeenCalledWith({ parola: 'blockchain' }));
    await waitFor(() => expect(screen.getByText(/suggerimento inviato/i)).toBeInTheDocument());
  });

  it('non invia nulla se il campo è vuoto', async () => {
    const utente = userEvent.setup();
    render(<SuggerisciParolaChiave />);

    await utente.click(screen.getByRole('button', { name: 'Invia' }));

    expect(inserisciFinto).not.toHaveBeenCalled();
  });

  it('mostra un errore se l\'invio fallisce', async () => {
    inserisciFinto.mockResolvedValueOnce({ error: { message: 'Errore di rete' } });
    const utente = userEvent.setup();
    render(<SuggerisciParolaChiave />);

    await utente.type(screen.getByLabelText('Suggerisci una parola chiave'), 'blockchain');
    await utente.click(screen.getByRole('button', { name: 'Invia' }));

    await waitFor(() => expect(screen.getByText('Errore di rete')).toBeInTheDocument());
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd dashboard && npm test -- SuggerisciParolaChiave`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 5: Create the component**

Create `dashboard/src/components/SuggerisciParolaChiave.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, TextField } from '@mui/material';
import { supabase } from '../lib/supabase';

export function SuggerisciParolaChiave() {
  const [parola, setParola] = useState('');
  const [inviato, setInviato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [invioInCorso, setInvioInCorso] = useState(false);

  async function gestisciInvio(evento: FormEvent) {
    evento.preventDefault();
    if (parola.trim() === '') return;

    setErrore(null);
    setInvioInCorso(true);
    const { error } = await supabase.from('suggerimenti_parole_chiave').insert({ parola: parola.trim() });
    setInvioInCorso(false);

    if (error) {
      setErrore(error.message);
      return;
    }
    setParola('');
    setInviato(true);
  }

  return (
    <Box
      component="form"
      onSubmit={gestisciInvio}
      sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap', mt: 1.5 }}
    >
      <TextField
        label="Suggerisci una parola chiave"
        size="small"
        value={parola}
        onChange={(e) => {
          setParola(e.target.value);
          setInviato(false);
        }}
        sx={{ minWidth: 220 }}
      />
      <Button type="submit" variant="outlined" disabled={invioInCorso} sx={{ minHeight: 44 }}>
        Invia
      </Button>
      {inviato && (
        <Alert severity="success" sx={{ width: '100%' }}>
          Suggerimento inviato, grazie!
        </Alert>
      )}
      {errore && (
        <Alert severity="error" sx={{ width: '100%' }}>
          {errore}
        </Alert>
      )}
    </Box>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd dashboard && npm test -- SuggerisciParolaChiave`
Expected: PASS (3 tests).

- [ ] **Step 7: Render it in `ListaBandi.tsx`**

In `dashboard/src/components/ListaBandi.tsx`, add the import:

```tsx
import { SuggerisciParolaChiave } from './SuggerisciParolaChiave';
```

and render it right after `<FiltriBar ... />`:

```tsx
      <FiltriBar
        filtri={filtri}
        fontiDisponibili={FONTI_ATTIVE}
        conteggiPriorita={conteggiPriorita}
        onCambiaFiltri={onCambiaFiltri}
      />
      <SuggerisciParolaChiave />
```

(Note: Task 6 modifies this same `<FiltriBar ... />` block further to add two more props — apply Task 6's version on top of this one, don't revert this addition.)

- [ ] **Step 8: Write the failing test for the admin review UI**

In `dashboard/src/components/admin/Configurazione.test.tsx`, add a new `let suggerimentiFinti` alongside the existing `let paroleFinte`/`let impostazioniFinte`, a new mock function, and wire up the mock. Replace:

```tsx
let paroleFinte: ParolaChiave[] = [];
let impostazioniFinte: ImpostazioniJob | null = null;
const inserisciFinto = vi.fn(async (valori: Partial<ParolaChiave>) => ({
  data: { id: '99', ...valori },
  error: null as { message: string } | null,
}));
const eliminaFinto = vi.fn(async (colonna: string, valore: string) => ({
  error: null as { message: string } | null,
}));
const aggiornaOraFinto = vi.fn(async (valori: Partial<ImpostazioniJob>, colonna: string, valore: number) => ({
  error: null as { message: string } | null,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (tabella: string) => {
      if (tabella === 'parole_chiave') {
        return {
          select: () => ({
            order: async () => ({ data: paroleFinte, error: null }),
          }),
          insert: (valori: Partial<ParolaChiave>) => ({
            select: () => ({
              single: async () => inserisciFinto(valori),
            }),
          }),
          delete: () => ({
            eq: (colonna: string, valore: string) => eliminaFinto(colonna, valore),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: impostazioniFinte, error: null }),
          }),
        }),
        update: (valori: Partial<ImpostazioniJob>) => ({
          eq: (colonna: string, valore: number) => aggiornaOraFinto(valori, colonna, valore),
        }),
      };
    },
  },
}));
```

with:

```tsx
import type { ImpostazioniJob, ParolaChiave, SuggerimentoParolaChiave } from '../../lib/types';

let paroleFinte: ParolaChiave[] = [];
let impostazioniFinte: ImpostazioniJob | null = null;
let suggerimentiFinti: SuggerimentoParolaChiave[] = [];
const inserisciFinto = vi.fn(async (valori: Partial<ParolaChiave>) => ({
  data: { id: '99', ...valori },
  error: null as { message: string } | null,
}));
const eliminaFinto = vi.fn(async (colonna: string, valore: string) => ({
  error: null as { message: string } | null,
}));
const aggiornaOraFinto = vi.fn(async (valori: Partial<ImpostazioniJob>, colonna: string, valore: number) => ({
  error: null as { message: string } | null,
}));
const aggiornaSuggerimentoFinto = vi.fn(async (valori: Partial<SuggerimentoParolaChiave>, colonna: string, valore: string) => ({
  error: null as { message: string } | null,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (tabella: string) => {
      if (tabella === 'parole_chiave') {
        return {
          select: () => ({
            order: async () => ({ data: paroleFinte, error: null }),
          }),
          insert: (valori: Partial<ParolaChiave>) => ({
            select: () => ({
              single: async () => inserisciFinto(valori),
            }),
          }),
          delete: () => ({
            eq: (colonna: string, valore: string) => eliminaFinto(colonna, valore),
          }),
        };
      }
      if (tabella === 'suggerimenti_parole_chiave') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: suggerimentiFinti, error: null }),
            }),
          }),
          update: (valori: Partial<SuggerimentoParolaChiave>) => ({
            eq: (colonna: string, valore: string) => aggiornaSuggerimentoFinto(valori, colonna, valore),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: impostazioniFinte, error: null }),
          }),
        }),
        update: (valori: Partial<ImpostazioniJob>) => ({
          eq: (colonna: string, valore: number) => aggiornaOraFinto(valori, colonna, valore),
        }),
      };
    },
  },
}));
```

Then update `beforeEach` — replace:

```tsx
  beforeEach(() => {
    inserisciFinto.mockClear();
    eliminaFinto.mockClear();
    aggiornaOraFinto.mockClear();
    paroleFinte = [
      { id: '1', parola: 'gaming', livello: 'livello1' },
      { id: '2', parola: 'startup', livello: 'livello2' },
    ];
    impostazioniFinte = { id: 1, ora: 8, fuso_orario: 'Europe/Rome' };
  });
```

with:

```tsx
  beforeEach(() => {
    inserisciFinto.mockClear();
    eliminaFinto.mockClear();
    aggiornaOraFinto.mockClear();
    aggiornaSuggerimentoFinto.mockClear();
    paroleFinte = [
      { id: '1', parola: 'gaming', livello: 'livello1' },
      { id: '2', parola: 'startup', livello: 'livello2' },
    ];
    impostazioniFinte = { id: 1, ora: 8, fuso_orario: 'Europe/Rome' };
    suggerimentiFinti = [];
  });
```

Then add these tests inside the `describe('Configurazione', ...)` block, after the existing `'salva la nuova ora'` test:

```tsx
  it('mostra i suggerimenti in attesa', async () => {
    suggerimentiFinti = [
      { id: 's1', parola: 'blockchain', proposto_da: 'mario.rossi@esempio.it', proposto_il: '2026-07-20T10:00:00Z', stato: 'in_attesa' },
    ];
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('blockchain')).toBeInTheDocument());
    expect(screen.getByText(/mario.rossi@esempio.it/)).toBeInTheDocument();
  });

  it('accettando un suggerimento lo aggiunge alle parole chiave e lo rimuove dall\'elenco', async () => {
    suggerimentiFinti = [
      { id: 's1', parola: 'blockchain', proposto_da: 'mario.rossi@esempio.it', proposto_il: '2026-07-20T10:00:00Z', stato: 'in_attesa' },
    ];
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('blockchain')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Accetta' }));

    await waitFor(() => expect(inserisciFinto).toHaveBeenCalledWith({ parola: 'blockchain', livello: 'livello2' }));
    await waitFor(() =>
      expect(aggiornaSuggerimentoFinto).toHaveBeenCalledWith({ stato: 'accettato' }, 'id', 's1')
    );
    await waitFor(() => expect(screen.queryByText('blockchain')).not.toBeInTheDocument());
  });

  it('rifiutando un suggerimento aggiorna solo il suo stato', async () => {
    suggerimentiFinti = [
      { id: 's1', parola: 'blockchain', proposto_da: 'mario.rossi@esempio.it', proposto_il: '2026-07-20T10:00:00Z', stato: 'in_attesa' },
    ];
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('blockchain')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Rifiuta' }));

    await waitFor(() =>
      expect(aggiornaSuggerimentoFinto).toHaveBeenCalledWith({ stato: 'rifiutato' }, 'id', 's1')
    );
    expect(inserisciFinto).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('blockchain')).not.toBeInTheDocument());
  });

  it('mostra un messaggio quando non ci sono suggerimenti in attesa', async () => {
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('Nessun suggerimento in attesa.')).toBeInTheDocument());
  });
```

- [ ] **Step 9: Run the tests to verify they fail**

Run: `cd dashboard && npm test -- Configurazione`
Expected: FAIL — `Configurazione.tsx` doesn't fetch or render suggestions yet.

- [ ] **Step 10: Add the suggestions section to `Configurazione.tsx`**

Five precise edits against the current file, in order.

**Edit 1 — import.** Replace:

```tsx
import type { ImpostazioniJob, ParolaChiave } from '../../lib/types';
```

with:

```tsx
import type { ImpostazioniJob, ParolaChiave, SuggerimentoParolaChiave } from '../../lib/types';
```

**Edit 2 — state.** Replace:

```tsx
  const [oraModificata, setOraModificata] = useState<number>(8);
  const [salvataggioOraInCorso, setSalvataggioOraInCorso] = useState(false);
```

with:

```tsx
  const [oraModificata, setOraModificata] = useState<number>(8);
  const [salvataggioOraInCorso, setSalvataggioOraInCorso] = useState(false);
  const [suggerimenti, setSuggerimenti] = useState<SuggerimentoParolaChiave[]>([]);
  const [azioneSuggerimentoInCorso, setAzioneSuggerimentoInCorso] = useState<string | null>(null);
```

**Edit 3 — the parallel fetch in `carica()`.** Replace:

```tsx
      const [risultatoParole, risultatoImpostazioni] = await Promise.all([
        supabase.from('parole_chiave').select('id, parola, livello').order('parola'),
        supabase.from('impostazioni_job').select('id, ora, fuso_orario').eq('id', 1).single(),
      ]);

      if (risultatoParole.error) {
        setErrore(risultatoParole.error.message);
      } else {
        setParoleChiave((risultatoParole.data ?? []) as ParolaChiave[]);
      }

      if (risultatoImpostazioni.error) {
        setErrore(risultatoImpostazioni.error.message);
      } else if (risultatoImpostazioni.data) {
        const impostazioniLette = risultatoImpostazioni.data as ImpostazioniJob;
        setImpostazioni(impostazioniLette);
        setOraModificata(impostazioniLette.ora);
      }
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setCaricamento(false);
    }
  }
```

with:

```tsx
      const [risultatoParole, risultatoImpostazioni, risultatoSuggerimenti] = await Promise.all([
        supabase.from('parole_chiave').select('id, parola, livello').order('parola'),
        supabase.from('impostazioni_job').select('id, ora, fuso_orario').eq('id', 1).single(),
        supabase
          .from('suggerimenti_parole_chiave')
          .select('id, parola, proposto_da, proposto_il, stato')
          .eq('stato', 'in_attesa')
          .order('proposto_il'),
      ]);

      if (risultatoParole.error) {
        setErrore(risultatoParole.error.message);
      } else {
        setParoleChiave((risultatoParole.data ?? []) as ParolaChiave[]);
      }

      if (risultatoImpostazioni.error) {
        setErrore(risultatoImpostazioni.error.message);
      } else if (risultatoImpostazioni.data) {
        const impostazioniLette = risultatoImpostazioni.data as ImpostazioniJob;
        setImpostazioni(impostazioniLette);
        setOraModificata(impostazioniLette.ora);
      }

      if (risultatoSuggerimenti.error) {
        setErrore(risultatoSuggerimenti.error.message);
      } else {
        setSuggerimenti((risultatoSuggerimenti.data ?? []) as SuggerimentoParolaChiave[]);
      }
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setCaricamento(false);
    }
  }
```

**Edit 4 — two new functions, inserted between `rimuoviParola` and `salvaOra`.** Replace:

```tsx
  async function rimuoviParola(parola: ParolaChiave) {
    setErrore(null);
    const { error } = await supabase.from('parole_chiave').delete().eq('id', parola.id);
    if (error) {
      setErrore(error.message);
      return;
    }
    setParoleChiave((precedenti) => precedenti.filter((p) => p.id !== parola.id));
  }

  async function salvaOra() {
```

with:

```tsx
  async function rimuoviParola(parola: ParolaChiave) {
    setErrore(null);
    const { error } = await supabase.from('parole_chiave').delete().eq('id', parola.id);
    if (error) {
      setErrore(error.message);
      return;
    }
    setParoleChiave((precedenti) => precedenti.filter((p) => p.id !== parola.id));
  }

  async function accettaSuggerimento(suggerimento: SuggerimentoParolaChiave) {
    setErrore(null);
    setAzioneSuggerimentoInCorso(suggerimento.id);
    const { data: nuovaParola, error: erroreInserimento } = await supabase
      .from('parole_chiave')
      .insert({ parola: suggerimento.parola, livello: 'livello2' })
      .select('id, parola, livello')
      .single();
    if (erroreInserimento) {
      setErrore(erroreInserimento.message);
      setAzioneSuggerimentoInCorso(null);
      return;
    }
    const { error: erroreStato } = await supabase
      .from('suggerimenti_parole_chiave')
      .update({ stato: 'accettato' })
      .eq('id', suggerimento.id);
    if (erroreStato) {
      setErrore(erroreStato.message);
      setAzioneSuggerimentoInCorso(null);
      return;
    }
    setParoleChiave((precedenti) => [...precedenti, nuovaParola as ParolaChiave]);
    setSuggerimenti((precedenti) => precedenti.filter((s) => s.id !== suggerimento.id));
    setAzioneSuggerimentoInCorso(null);
  }

  async function rifiutaSuggerimento(suggerimento: SuggerimentoParolaChiave) {
    setErrore(null);
    setAzioneSuggerimentoInCorso(suggerimento.id);
    const { error } = await supabase
      .from('suggerimenti_parole_chiave')
      .update({ stato: 'rifiutato' })
      .eq('id', suggerimento.id);
    if (error) {
      setErrore(error.message);
      setAzioneSuggerimentoInCorso(null);
      return;
    }
    setSuggerimenti((precedenti) => precedenti.filter((s) => s.id !== suggerimento.id));
    setAzioneSuggerimentoInCorso(null);
  }

  async function salvaOra() {
```

(the `async function salvaOra() {` line is intentionally repeated at the end — the old block consumed it as an anchor, this puts it back so `salvaOra`'s existing, untouched body re-attaches to a real function declaration instead of being orphaned).

**Edit 5 — JSX section, inserted before the existing "Parole chiave" heading.** Replace:

```tsx
      <Typography variant="h6" sx={{ mb: 1 }}>
        Parole chiave
      </Typography>
```

with:

```tsx
      <Typography variant="h6" sx={{ mb: 1 }}>
        Suggerimenti in attesa
      </Typography>
      {suggerimenti.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Nessun suggerimento in attesa.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
          {suggerimenti.map((suggerimento) => (
            <Box
              key={suggerimento.id}
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            >
              <Box>
                <Typography>{suggerimento.parola}</Typography>
                <Typography variant="body2" color="text.secondary">
                  proposto da {suggerimento.proposto_da}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={azioneSuggerimentoInCorso === suggerimento.id}
                  onClick={() => accettaSuggerimento(suggerimento)}
                  sx={{ minHeight: 44 }}
                >
                  Accetta
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  disabled={azioneSuggerimentoInCorso === suggerimento.id}
                  onClick={() => rifiutaSuggerimento(suggerimento)}
                  sx={{ minHeight: 44 }}
                >
                  Rifiuta
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Parole chiave
      </Typography>
```

(the trailing `Parole chiave` heading is intentionally repeated — the old block consumed it as an anchor, this puts it back immediately after the new section instead of losing it).

- [ ] **Step 11: Run the tests to verify they pass**

Run: `cd dashboard && npm test -- Configurazione`
Expected: PASS (9 tests: 5 existing + 4 new).

- [ ] **Step 12: Full suite, typecheck, and commit**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: no errors, all suites pass.

```bash
git add dashboard/src/lib/types.ts dashboard/src/components/SuggerisciParolaChiave.tsx dashboard/src/components/SuggerisciParolaChiave.test.tsx dashboard/src/components/ListaBandi.tsx dashboard/src/components/admin/Configurazione.tsx dashboard/src/components/admin/Configurazione.test.tsx
git commit -m "feat(dashboard): let logged-in users suggest keywords, admin reviews in Configurazione"
```

---

## Task 6: Keyword filter chips read from Supabase, click counter

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `dashboard/src/lib/types.ts`
- Modify: `dashboard/src/components/FiltriBar.tsx`
- Modify: `dashboard/src/components/FiltriBar.test.tsx`
- Modify: `dashboard/src/components/ListaBandi.tsx`
- Modify: `dashboard/src/components/admin/Configurazione.tsx`
- Modify: `dashboard/src/components/admin/Configurazione.test.tsx`
- Delete: `dashboard/src/lib/keywords.ts`
- Delete: `dashboard/src/lib/keywords.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks in this plan.
- Produces: `FiltriBarProps` gains `paroleChiaveDisponibili: ParolaChiave[]` and `onParolaChiaveCliccata: (id: string) => void`. `ParolaChiave` gains `contatore_click: number`.

- [ ] **Step 1: Add the counter column and the atomic-increment function**

Append to `supabase/schema.sql`:

```sql
-- Fase 6e: contatore di quante volte ogni parola chiave è stata usata come
-- filtro, per aiutare a capire quali restano pertinenti.
alter table parole_chiave add column if not exists contatore_click integer not null default 0;

-- Incremento atomico lato database: evita che due click quasi simultanei si
-- perdano a vicenda se calcolati lato client (leggi valore, scrivi valore+1).
create or replace function increment_click_parola(id_parola uuid)
returns void
language sql
as $$
  update parole_chiave set contatore_click = contatore_click + 1 where id = id_parola;
$$;

grant execute on function increment_click_parola(uuid) to authenticated;
```

Apply it to the live database (`apply_migration` MCP tool against project ref `atcdtnmwbllvdeikswfk`, or guide the user through the SQL Editor). Verify with `select increment_click_parola(id) from parole_chiave limit 1;` followed by re-reading that row's `contatore_click` to confirm it moved from 0 to 1, then reset it back to 0 with a manual update so the real count starts clean.

```bash
git add supabase/schema.sql
git commit -m "docs(supabase): add parole_chiave.contatore_click and increment_click_parola()"
```

- [ ] **Step 2: Add `contatore_click` to the `ParolaChiave` type**

In `dashboard/src/lib/types.ts`, replace:

```ts
export interface ParolaChiave {
  id: string;
  parola: string;
  livello: 'livello1' | 'livello2';
}
```

with:

```ts
export interface ParolaChiave {
  id: string;
  parola: string;
  livello: 'livello1' | 'livello2';
  contatore_click: number;
}
```

- [ ] **Step 3: Write the failing tests for `FiltriBar`**

Replace the full contents of `dashboard/src/components/FiltriBar.test.tsx` with:

```tsx
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiltriBar } from './FiltriBar';
import type { FiltriStato } from '../lib/filtriBandi';
import type { ParolaChiave } from '../lib/types';

const filtriBase: FiltriStato = {
  priorita: 'tutti',
  fonti: [],
  paroleChiave: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
  direzioneOrdinamento: 'decrescente',
};

const conteggiEsempio = { tutti: 5, alta: 2, da_verificare: 3 };
const paroleChiaveEsempio: ParolaChiave[] = [
  { id: 'p1', parola: 'gaming', livello: 'livello1', contatore_click: 0 },
];

function renderFiltriBar(props: Partial<ComponentProps<typeof FiltriBar>> = {}) {
  return render(
    <FiltriBar
      filtri={filtriBase}
      fontiDisponibili={['eit']}
      conteggiPriorita={conteggiEsempio}
      paroleChiaveDisponibili={paroleChiaveEsempio}
      onCambiaFiltri={vi.fn()}
      onParolaChiaveCliccata={vi.fn()}
      {...props}
    />
  );
}

describe('FiltriBar', () => {
  it('chiama onCambiaFiltri con il testo di ricerca aggiornato', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    renderFiltriBar({ onCambiaFiltri });

    await utente.type(screen.getByPlaceholderText(/cerca per titolo/i), 'g');
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, ricerca: 'g' });
  });

  it('chiama onCambiaFiltri quando si seleziona "Match diretto"', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    renderFiltriBar({ onCambiaFiltri });

    await utente.click(screen.getByRole('button', { name: /match diretto/i }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, priorita: 'alta' });
  });

  it('permette di selezionare più fonti (multi-select)', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    renderFiltriBar({ fontiDisponibili: ['eit', 'invitalia'], onCambiaFiltri });

    await utente.click(screen.getByLabelText('Fonte'));
    await utente.click(await screen.findByRole('option', { name: 'eit' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, fonti: ['eit'] });
  });

  it('chiama onCambiaFiltri quando si cambia ordinamento a scadenza', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    renderFiltriBar({ onCambiaFiltri });

    await utente.click(screen.getByLabelText('Ordina per'));
    await utente.click(await screen.findByRole('option', { name: 'Scadenza' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, ordinamento: 'scadenza' });
  });

  it('la sezione parole chiave è chiusa di default e si apre al tap', async () => {
    const utente = userEvent.setup();
    renderFiltriBar();

    expect(screen.queryByRole('button', { name: 'gaming' })).not.toBeInTheDocument();
    await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
    expect(screen.getByRole('button', { name: 'gaming' })).toBeInTheDocument();
  });

  it('chiama onCambiaFiltri e onParolaChiaveCliccata con la parola chiave selezionata', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    const onParolaChiaveCliccata = vi.fn();
    renderFiltriBar({ onCambiaFiltri, onParolaChiaveCliccata });

    await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
    await utente.click(screen.getByRole('button', { name: 'gaming' }));

    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, paroleChiave: ['gaming'] });
    expect(onParolaChiaveCliccata).toHaveBeenCalledWith('p1');
  });

  it('deseleziona una parola chiave già selezionata, e conta comunque il click', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    const onParolaChiaveCliccata = vi.fn();
    renderFiltriBar({ filtri: { ...filtriBase, paroleChiave: ['gaming'] }, onCambiaFiltri, onParolaChiaveCliccata });

    await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
    await utente.click(screen.getByRole('button', { name: 'gaming' }));

    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, paroleChiave: [] });
    expect(onParolaChiaveCliccata).toHaveBeenCalledWith('p1');
  });

  it('chiama onCambiaFiltri con la direzione invertita quando si clicca il pulsante di direzione', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    renderFiltriBar({ onCambiaFiltri });

    await utente.click(screen.getByLabelText(/inverti direzione ordinamento/i));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, direzioneOrdinamento: 'crescente' });
  });

  it('mostra i contatori sulle schede di priorità', () => {
    renderFiltriBar();
    expect(screen.getByRole('button', { name: /tutti \(5\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /match diretto \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /da verificare \(3\)/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd dashboard && npm test -- FiltriBar`
Expected: FAIL — `FiltriBarProps` doesn't accept `paroleChiaveDisponibili`/`onParolaChiaveCliccata` yet, and the component still imports the static `PAROLE_CHIAVE` list instead of using the prop.

- [ ] **Step 5: Update `FiltriBar.tsx`**

Replace:

```tsx
import type { FiltriStato } from '../lib/filtriBandi';
import { PAROLE_CHIAVE } from '../lib/keywords';

export interface FiltriBarProps {
  filtri: FiltriStato;
  fontiDisponibili: string[];
  conteggiPriorita: { tutti: number; alta: number; da_verificare: number };
  onCambiaFiltri: (filtri: FiltriStato) => void;
}

export function FiltriBar({ filtri, fontiDisponibili, conteggiPriorita, onCambiaFiltri }: FiltriBarProps) {
```

with:

```tsx
import type { FiltriStato } from '../lib/filtriBandi';
import type { ParolaChiave } from '../lib/types';

export interface FiltriBarProps {
  filtri: FiltriStato;
  fontiDisponibili: string[];
  conteggiPriorita: { tutti: number; alta: number; da_verificare: number };
  paroleChiaveDisponibili: ParolaChiave[];
  onCambiaFiltri: (filtri: FiltriStato) => void;
  onParolaChiaveCliccata: (id: string) => void;
}

export function FiltriBar({
  filtri,
  fontiDisponibili,
  conteggiPriorita,
  paroleChiaveDisponibili,
  onCambiaFiltri,
  onParolaChiaveCliccata,
}: FiltriBarProps) {
```

Then replace:

```tsx
            {PAROLE_CHIAVE.map((parola) => (
              <Chip
                key={parola}
                label={parola}
                clickable
                onClick={() => gestisciToggleParolaChiave(parola)}
                color={filtri.paroleChiave.includes(parola) ? 'primary' : 'default'}
                sx={{ minHeight: 44 }}
              />
            ))}
```

with:

```tsx
            {paroleChiaveDisponibili.map((parola) => (
              <Chip
                key={parola.id}
                label={parola.parola}
                clickable
                onClick={() => {
                  gestisciToggleParolaChiave(parola.parola);
                  onParolaChiaveCliccata(parola.id);
                }}
                color={filtri.paroleChiave.includes(parola.parola) ? 'primary' : 'default'}
                sx={{ minHeight: 44 }}
              />
            ))}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd dashboard && npm test -- FiltriBar`
Expected: PASS (9 tests).

- [ ] **Step 7: Delete the now-unused static keyword file**

```bash
rm dashboard/src/lib/keywords.ts dashboard/src/lib/keywords.test.ts
```

- [ ] **Step 8: Wire `ListaBandi.tsx` up to fetch and pass the live keyword list**

Add state and a fetch function. Replace:

```tsx
export function ListaBandi() {
  const [bandi, setBandi] = useState<Bando[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<FiltriStato>(() => caricaFiltriSalvati() ?? FILTRI_DEFAULT);

  useEffect(() => {
    caricaBandi();
  }, []);
```

with:

```tsx
export function ListaBandi() {
  const [bandi, setBandi] = useState<Bando[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<FiltriStato>(() => caricaFiltriSalvati() ?? FILTRI_DEFAULT);
  const [paroleChiaveDisponibili, setParoleChiaveDisponibili] = useState<ParolaChiave[]>([]);

  useEffect(() => {
    caricaBandi();
    caricaParoleChiave();
  }, []);

  async function caricaParoleChiave() {
    const { data, error } = await supabase
      .from('parole_chiave')
      .select('id, parola, livello, contatore_click')
      .order('parola');
    if (!error) {
      setParoleChiaveDisponibili((data ?? []) as ParolaChiave[]);
    }
  }

  async function incrementaContatoreParola(id: string) {
    await supabase.rpc('increment_click_parola', { id_parola: id });
  }
```

Add the import:

```tsx
import type { Bando, ParolaChiave } from '../lib/types';
```

(replacing the existing `import type { Bando } from '../lib/types';`)

Finally, replace the `<FiltriBar ... />` render (already touched by Task 5's `<SuggerisciParolaChiave />` addition right after it — keep that line, only change the `FiltriBar` props):

```tsx
      <FiltriBar
        filtri={filtri}
        fontiDisponibili={FONTI_ATTIVE}
        conteggiPriorita={conteggiPriorita}
        onCambiaFiltri={onCambiaFiltri}
      />
      <SuggerisciParolaChiave />
```

with:

```tsx
      <FiltriBar
        filtri={filtri}
        fontiDisponibili={FONTI_ATTIVE}
        conteggiPriorita={conteggiPriorita}
        paroleChiaveDisponibili={paroleChiaveDisponibili}
        onCambiaFiltri={onCambiaFiltri}
        onParolaChiaveCliccata={incrementaContatoreParola}
      />
      <SuggerisciParolaChiave />
```

- [ ] **Step 9: Write the failing test for the click count display in `Configurazione.tsx`**

Add to `dashboard/src/components/admin/Configurazione.test.tsx`, updating `paroleFinte` in `beforeEach` to include a count, and adding a new test. Replace:

```tsx
    paroleFinte = [
      { id: '1', parola: 'gaming', livello: 'livello1' },
      { id: '2', parola: 'startup', livello: 'livello2' },
    ];
```

with:

```tsx
    paroleFinte = [
      { id: '1', parola: 'gaming', livello: 'livello1', contatore_click: 12 },
      { id: '2', parola: 'startup', livello: 'livello2', contatore_click: 0 },
    ];
```

and add a new test after `'rimuove una parola chiave esistente'`:

```tsx
  it('mostra quante volte ogni parola chiave è stata usata come filtro', async () => {
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming')).toBeInTheDocument());
    expect(screen.getByText('12')).toBeInTheDocument();
  });
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `cd dashboard && npm test -- Configurazione`
Expected: FAIL — the click count isn't rendered anywhere yet (and the `ParolaChiave` fixtures now carry `contatore_click`, which doesn't break existing tests since they don't assert the full object shape).

- [ ] **Step 11: Show the count next to each keyword chip in `Configurazione.tsx`**

Find the existing keyword `Chip` render (inside the `paroleChiave.filter((p) => p.livello === livello).map((parola) => (...))` block) and change its `label` from just the word to word-plus-count. Replace:

```tsx
                <Chip
                  key={parola.id}
                  label={parola.parola}
                  onDelete={() => rimuoviParola(parola)}
                  sx={{
                    minHeight: 44,
                    '& .MuiChip-deleteIcon': {
                      fontSize: '1.3rem',
                      margin: '0 6px 0 -6px',
                    },
                  }}
                />
```

with:

```tsx
                <Chip
                  key={parola.id}
                  label={`${parola.parola} (${parola.contatore_click})`}
                  onDelete={() => rimuoviParola(parola)}
                  sx={{
                    minHeight: 44,
                    '& .MuiChip-deleteIcon': {
                      fontSize: '1.3rem',
                      margin: '0 6px 0 -6px',
                    },
                  }}
                />
```

- [ ] **Step 12: Update the three existing tests that wait on the bare keyword text**

MUI's `Chip` renders its `label` as a single text node, so `screen.getByText('gaming')` (exact match) stops finding anything once the label becomes `"gaming (12)"`. Three existing tests use `screen.getByText('gaming')` this way. Replace:

```tsx
  it('mostra le parole chiave raggruppate per livello', async () => {
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming')).toBeInTheDocument());
    expect(screen.getByText('startup')).toBeInTheDocument();
  });
```

with:

```tsx
  it('mostra le parole chiave raggruppate per livello', async () => {
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming (12)')).toBeInTheDocument());
    expect(screen.getByText('startup (0)')).toBeInTheDocument();
  });
```

Replace:

```tsx
  it('aggiunge una nuova parola chiave', async () => {
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming')).toBeInTheDocument());

    await utente.type(screen.getByLabelText('Nuova parola chiave'), 'fintech');
    await utente.click(screen.getByRole('button', { name: 'Aggiungi' }));

    await waitFor(() => expect(inserisciFinto).toHaveBeenCalledWith({ parola: 'fintech', livello: 'livello2' }));
  });
```

with:

```tsx
  it('aggiunge una nuova parola chiave', async () => {
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming (12)')).toBeInTheDocument());

    await utente.type(screen.getByLabelText('Nuova parola chiave'), 'fintech');
    await utente.click(screen.getByRole('button', { name: 'Aggiungi' }));

    await waitFor(() => expect(inserisciFinto).toHaveBeenCalledWith({ parola: 'fintech', livello: 'livello2' }));
  });
```

Replace:

```tsx
  it('rimuove una parola chiave esistente', async () => {
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming')).toBeInTheDocument());

    const chipGaming = screen.getByText('gaming').closest('.MuiChip-root') as HTMLElement;
    const pulsanteElimina = within(chipGaming).getByTestId('CancelIcon');
    await utente.click(pulsanteElimina);

    await waitFor(() => expect(eliminaFinto).toHaveBeenCalledWith('id', '1'));
  });
```

with:

```tsx
  it('rimuove una parola chiave esistente', async () => {
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming (12)')).toBeInTheDocument());

    const chipGaming = screen.getByText('gaming (12)').closest('.MuiChip-root') as HTMLElement;
    const pulsanteElimina = within(chipGaming).getByTestId('CancelIcon');
    await utente.click(pulsanteElimina);

    await waitFor(() => expect(eliminaFinto).toHaveBeenCalledWith('id', '1'));
  });
```

- [ ] **Step 13: Run the test to verify it passes**

Run: `cd dashboard && npm test -- Configurazione`
Expected: PASS (10 tests: 9 from Task 5 + 1 new).

- [ ] **Step 14: Full suite, typecheck, and commit**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: no errors, all suites pass.

```bash
git add supabase/schema.sql dashboard/src/lib/types.ts dashboard/src/components/FiltriBar.tsx dashboard/src/components/FiltriBar.test.tsx dashboard/src/components/ListaBandi.tsx dashboard/src/components/admin/Configurazione.tsx dashboard/src/components/admin/Configurazione.test.tsx
git rm dashboard/src/lib/keywords.ts dashboard/src/lib/keywords.test.ts
git commit -m "feat(dashboard): keyword filters read from Supabase, count clicks per keyword"
```

---

## Task 7: Header tooltips and a "Segnala" bug-report icon

**Files:**
- Modify: `dashboard/src/App.tsx`
- Modify: `dashboard/src/App.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks — last dashboard task in this plan.

- [ ] **Step 1: Write the failing tests**

In `dashboard/src/App.test.tsx`, add these tests inside the `describe('App', ...)` block, after `'cambia icona quando si clicca il pulsante di cambio tema'`:

```tsx
  it('mostra "Tema chiaro" al passaggio del mouse quando si è in modalità scura', async () => {
    vi.mocked(useAuth).mockReturnValue({ sessione: null, caricamento: false });
    const utente = userEvent.setup();
    render(<App />);

    await utente.hover(screen.getByLabelText('Cambia tema chiaro/scuro'));
    expect(await screen.findByText('Tema chiaro')).toBeInTheDocument();
  });

  it('mostra "Tema scuro" al passaggio del mouse dopo aver attivato la modalità chiara', async () => {
    vi.mocked(useAuth).mockReturnValue({ sessione: null, caricamento: false });
    const utente = userEvent.setup();
    render(<App />);

    await utente.click(screen.getByLabelText('Cambia tema chiaro/scuro'));
    await utente.hover(screen.getByLabelText('Cambia tema chiaro/scuro'));
    expect(await screen.findByText('Tema scuro')).toBeInTheDocument();
  });

  it('mostra "Esci" al passaggio del mouse sul pulsante di logout', async () => {
    vi.mocked(useAuth).mockReturnValue({
      sessione: creaSessioneFinta('mario.rossi@esempio.it'),
      caricamento: false,
    });
    const utente = userEvent.setup();
    render(<App />);

    await utente.hover(screen.getByLabelText('Esci'));
    expect(await screen.findByText('Esci', { selector: '[role="tooltip"]' })).toBeInTheDocument();
  });
```

and after `'non mostra il pulsante Esci quando non c\'è sessione'`:

```tsx
  it('mostra il pulsante Segnala per un utente collegato, con link mailto', () => {
    vi.mocked(useAuth).mockReturnValue({
      sessione: creaSessioneFinta('mario.rossi@esempio.it'),
      caricamento: false,
    });
    render(<App />);

    const link = screen.getByLabelText('Segnala un problema o un suggerimento');
    expect(link).toHaveAttribute('href', 'mailto:panto75@gmail.com?subject=Segnalazione%20Fund%20Radar');
  });

  it('non mostra il pulsante Segnala quando non c\'è sessione', () => {
    vi.mocked(useAuth).mockReturnValue({ sessione: null, caricamento: false });
    render(<App />);
    expect(screen.queryByLabelText('Segnala un problema o un suggerimento')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dashboard && npm test -- App`
Expected: FAIL — no tooltips exist yet, and there's no "Segnala" control.

- [ ] **Step 3: Update `App.tsx`**

Replace:

```tsx
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  IconButton,
  ThemeProvider,
  Toolbar,
  Typography,
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
```

with:

```tsx
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  IconButton,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import BugReportIcon from '@mui/icons-material/BugReport';
```

Then replace the toolbar's icon buttons block:

```tsx
          <IconButton
            color="inherit"
            onClick={() => setModalita((m) => (m === 'dark' ? 'light' : 'dark'))}
            aria-label="Cambia tema chiaro/scuro"
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            {modalita === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
          {sessione && (
            <IconButton
              color="inherit"
              onClick={() => supabase.auth.signOut()}
              aria-label="Esci"
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <LogoutIcon />
            </IconButton>
          )}
```

with:

```tsx
          <Tooltip title={modalita === 'dark' ? 'Tema chiaro' : 'Tema scuro'}>
            <IconButton
              color="inherit"
              onClick={() => setModalita((m) => (m === 'dark' ? 'light' : 'dark'))}
              aria-label="Cambia tema chiaro/scuro"
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              {modalita === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
          {sessione && (
            <Tooltip title="Segnala">
              <IconButton
                color="inherit"
                component="a"
                href="mailto:panto75@gmail.com?subject=Segnalazione%20Fund%20Radar"
                aria-label="Segnala un problema o un suggerimento"
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <BugReportIcon />
              </IconButton>
            </Tooltip>
          )}
          {sessione && (
            <Tooltip title="Esci">
              <IconButton
                color="inherit"
                onClick={() => supabase.auth.signOut()}
                aria-label="Esci"
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd dashboard && npm test -- App`
Expected: PASS (13 tests: 8 existing + 5 new).

- [ ] **Step 5: Full suite, typecheck, and commit**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: no errors, all suites pass.

```bash
git add dashboard/src/App.tsx dashboard/src/App.test.tsx
git commit -m "feat(dashboard): tooltips on theme/logout buttons, add a Segnala bug-report icon"
```

---

## Task 8: Notification email for every new access request

**Files:**
- Create: `supabase/functions/notifica-richiesta/index.ts`
- Create: `supabase/functions/notifica-richiesta/README.md`

**Interfaces:**
- Consumes: nothing from earlier tasks in this plan.
- Produces: nothing consumed by later tasks. Deployed and wired to a Database Webhook by the controller directly (Edge Function deploy) plus a guided manual step with the user (the webhook itself, since Database Webhook creation has no MCP tool available).

This task has no automated test: it's a Deno Edge Function with no test harness in this repo (same as `admin-actions`), triggered by infrastructure (a Database Webhook) outside the dashboard's test suite. Verified live after deploy and webhook setup (Step 3).

- [ ] **Step 1: Write the Edge Function**

Create `supabase/functions/notifica-richiesta/index.ts`:

```ts
const URL_DASHBOARD = 'https://darthkazuya.github.io/qyros-bandi-monitor/';
const EMAIL_AMMINISTRATORE = 'panto75@gmail.com';
const RESEND_API_URL = 'https://api.resend.com/emails';

interface PayloadWebhook {
  type: string;
  table: string;
  record: {
    email: string;
    nome: string;
    cognome: string;
    richiesto_il: string;
  };
}

function escapeHtml(testo: string): string {
  return testo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (richiesta: Request) => {
  if (richiesta.method !== 'POST') {
    return new Response(JSON.stringify({ errore: 'Metodo non consentito' }), { status: 405 });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ errore: "Variabile d'ambiente RESEND_API_KEY mancante" }), { status: 500 });
  }

  const payload = (await richiesta.json()) as PayloadWebhook;
  const { email, nome, cognome } = payload.record;

  const rispostaResend = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Fund Radar <notifiche@qyros.net>',
      to: [EMAIL_AMMINISTRATORE],
      subject: 'Nuova richiesta di accesso — Fund Radar',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2>Nuova richiesta di accesso</h2>
          <p>Hai ricevuto una nuova richiesta di accesso da <strong>${escapeHtml(nome)} ${escapeHtml(cognome)}</strong> (${escapeHtml(email)}).</p>
          <p><a href="${URL_DASHBOARD}">Vai al pannello per approvarla o rifiutarla</a></p>
        </div>
      `,
    }),
  });

  if (!rispostaResend.ok) {
    const corpoErrore = await rispostaResend.text();
    return new Response(JSON.stringify({ errore: `Resend: ${corpoErrore}` }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

- [ ] **Step 2: Write the README**

Create `supabase/functions/notifica-richiesta/README.md`:

```markdown
# Edge Function `notifica-richiesta`

Manda un'email all'amministratore (`panto75@gmail.com`) ogni volta che nasce
una riga nuova in `richieste_accesso`. Non viene mai chiamata direttamente
dal sito: parte da un **Database Webhook** di Supabase (Database → Webhooks),
che avvisa questa funzione a ogni INSERT sulla tabella, autenticato con la
chiave di servizio — nessun endpoint pubblico da proteggere.

## Segreto necessario

`RESEND_API_KEY` — un'API key di Resend con permesso "Sending access",
configurata come segreto di questa funzione (Edge Functions → Secrets su
Supabase), separata da quella usata per l'SMTP di Supabase Auth.

## Pubblicazione

```bash
npx supabase functions deploy notifica-richiesta --project-ref atcdtnmwbllvdeikswfk --use-api
```

Non richiede Docker (grazie al flag `--use-api`).

## Configurazione del Database Webhook (manuale, una tantum)

1. Supabase Dashboard → Database → Webhooks → Create a new webhook.
2. Tabella: `richieste_accesso`. Evento: `INSERT`.
3. Tipo: HTTP Request, verso l'URL di questa funzione
   (`https://atcdtnmwbllvdeikswfk.supabase.co/functions/v1/notifica-richiesta`).
4. Autenticazione: includere l'header `Authorization: Bearer <service_role key>`
   (l'interfaccia di Supabase offre un'opzione dedicata per farlo senza
   scrivere la chiave a mano).
```

- [ ] **Step 3: Deploy and configure**

Deploy the function directly (this environment has the Supabase MCP connector's `deploy_edge_function` capability, used successfully for `admin-actions` in a prior phase — no CLI auth needed):

- project_id: `atcdtnmwbllvdeikswfk`, name: `notifica-richiesta`, entrypoint: `index.ts`, verify_jwt: `true`, files: the contents of `index.ts` from Step 1.

Then, guided manual steps with the user (no MCP tool covers either of these):
1. A new Resend API key ("Sending access" scope, e.g. named "Notifiche richieste accesso").
2. Paste it as the `RESEND_API_KEY` secret for this specific Edge Function (Supabase Dashboard → Edge Functions → `notifica-richiesta` → Secrets).
3. Create the Database Webhook exactly as described in the README's last section — walk the user through it with screenshots, the same way prior SMTP/webhook-adjacent settings were configured in this project.

- [ ] **Step 4: Verify live**

Submit a fresh test access request from the login screen (an email that isn't already an authorized user) and confirm the notification email arrives at `panto75@gmail.com` within a few seconds, with the requester's name, email, and a working link to the dashboard.

```bash
git add supabase/functions/notifica-richiesta/
git commit -m "feat(supabase): notifica-richiesta Edge Function for new access requests"
```
