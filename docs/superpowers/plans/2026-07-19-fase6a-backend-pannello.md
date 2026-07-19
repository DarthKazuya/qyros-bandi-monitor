# Fase 6a — Backend pannello di controllo (schema, scraper, Edge Function) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend pieces the admin panel (Fase 6b, a separate later plan) will depend on: three new database tables with RLS, the scraper reading keywords/schedule from Supabase (with the existing local-file fallback preserved), and a Supabase Edge Function exposing the three privileged admin actions (list users, approve a request, revoke a user).

**Architecture:** Pure additions to `supabase/schema.sql` (new tables + policies + grants + one-time data migration), `scraper/src/lib/config.ts` and `scraper/src/index.ts` (Supabase-backed config with graceful fallback to the existing JSON files when no real credentials are present — this fallback is a hard requirement, not a shortcut), and a brand-new `supabase/functions/admin-actions/index.ts` (Deno-based Supabase Edge Function, deployed separately from everything else in this repo).

**Tech Stack:** Same scraper stack as before (Node/TypeScript, Vitest, `@supabase/supabase-js`) for Tasks 1-3. Deno + the Supabase Edge Functions runtime for Tasks 4-6 — a new runtime for this project, deployed via `npx supabase functions deploy` (works without Docker using the `--use-api` flag, confirmed available in this environment).

## Global Constraints

- No changes to `dashboard/` in this plan — the admin panel UI is a separate, later plan (Fase 6b) that will consume what this plan builds.
- Fallback behavior is mandatory: when `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are absent, `caricaKeywords()`/`caricaSchedule()` must keep reading `config/keywords.json`/`config/schedule.json` exactly as today — this is an explicitly valued, already-documented project behavior (local testing without touching real data), not something this phase may regress.
- The sole recognized administrator is the literal email `panto75@gmail.com`, hardcoded (not configurable) in both the new RLS policies and the Edge Function — one admin, by design, for this phase.
- RLS policies alone are never sufficient in this project's Supabase setup — every new table needs an explicit `grant` alongside its policies (a mistake this project has already made and fixed twice; do not repeat it a third time).
- New tables must be safe to re-run `supabase/schema.sql` multiple times (`create table if not exists`, `on conflict do nothing` on the migration inserts, matching the file's existing style).
- The Edge Function has no automated test suite in this plan (Deno is a different runtime with no existing test tooling in this repo, and this environment has no Docker for local Edge Function serving). Verification for Tasks 4-6 is: careful code review against Supabase Edge Function / Deno API conventions (same standard already applied to this project's GitHub Actions YAML, which is also untested by an automated suite) — real behavioral verification happens via a live `curl` smoke test after deployment, in a separate interactive step after this plan's tasks are merged (same pattern as the daily job's and dashboard's post-merge live verification in Fase 3b/4b).
- No `.js` extensions are used in Deno imports in the Edge Function (Deno resolves URL-based and relative imports differently from Node — this constraint from the rest of the codebase does not apply inside `supabase/functions/`).

---

### Task 1: Schema database — tre nuove tabelle, RLS, grant, migrazione dati

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Produces: tables `richieste_accesso(id, email, nome, cognome, richiesto_il, stato)`, `parole_chiave(id, parola, livello)`, `impostazioni_job(id, ora, fuso_orario)`, plus a new read policy+grant on the existing `job_run_log`. Consumed by Task 2 (scraper reads `parole_chiave`/`impostazioni_job`), and later by Fase 6b (dashboard reads/writes `richieste_accesso`/`parole_chiave`/`impostazioni_job`/`job_run_log`) and by this plan's own Edge Function (Tasks 4-6, updates `richieste_accesso`).

This task has no automated test (it's SQL executed manually in the Supabase SQL Editor by the user, exactly like every previous schema change in this project) — its "test" is Step 2 below: the user runs it once against the real database.

- [ ] **Step 1: Append to `supabase/schema.sql`**

```sql

-- Fase 6: pannello di controllo riservato

create table if not exists richieste_accesso (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text not null,
  cognome text not null,
  richiesto_il timestamptz not null default now(),
  stato text not null default 'in_attesa' check (stato in ('in_attesa', 'approvata', 'rifiutata'))
);

create table if not exists parole_chiave (
  id uuid primary key default gen_random_uuid(),
  parola text not null,
  livello text not null check (livello in ('livello1', 'livello2')),
  unique (parola, livello)
);

create table if not exists impostazioni_job (
  id int primary key default 1,
  ora int not null check (ora >= 0 and ora <= 23),
  fuso_orario text not null default 'Europe/Rome'
);

alter table richieste_accesso enable row level security;
alter table parole_chiave enable row level security;
alter table impostazioni_job enable row level security;

-- Un solo amministratore, per disegno di questa fase: panto75@gmail.com.
create policy "richieste_accesso_admin_select" on richieste_accesso
  for select to authenticated using (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "richieste_accesso_admin_update" on richieste_accesso
  for update to authenticated
  using (auth.jwt() ->> 'email' = 'panto75@gmail.com')
  with check (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "richieste_accesso_public_insert" on richieste_accesso
  for insert to anon, authenticated with check (true);

create policy "parole_chiave_admin_select" on parole_chiave
  for select to authenticated using (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "parole_chiave_admin_insert" on parole_chiave
  for insert to authenticated with check (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "parole_chiave_admin_delete" on parole_chiave
  for delete to authenticated using (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "impostazioni_job_admin_select" on impostazioni_job
  for select to authenticated using (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "impostazioni_job_admin_update" on impostazioni_job
  for update to authenticated
  using (auth.jwt() ->> 'email' = 'panto75@gmail.com')
  with check (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "job_run_log_admin_select" on job_run_log
  for select to authenticated using (auth.jwt() ->> 'email' = 'panto75@gmail.com');

-- Grant espliciti: RLS da sola non basta senza queste, come già scoperto due volte.
grant select, insert, update on table public.richieste_accesso to anon, authenticated;
grant select, insert, delete on table public.parole_chiave to authenticated;
grant select, update on table public.impostazioni_job to authenticated;
grant select on table public.job_run_log to authenticated;
grant all on table public.richieste_accesso to service_role;
grant all on table public.parole_chiave to service_role;
grant all on table public.impostazioni_job to service_role;

-- Migrazione una tantum dei valori oggi in config/keywords.json e config/schedule.json.
insert into parole_chiave (parola, livello) values
  ('gaming', 'livello1'),
  ('fintech', 'livello1'),
  ('regtech', 'livello1'),
  ('economia circolare', 'livello1'),
  ('circular economy', 'livello1'),
  ('intelligenza artificiale', 'livello2'),
  ('artificial intelligence', 'livello2'),
  ('ai', 'livello2'),
  ('tecnologia', 'livello2'),
  ('tecnologico', 'livello2'),
  ('technology', 'livello2'),
  ('tech', 'livello2'),
  ('startup', 'livello2'),
  ('start-up', 'livello2'),
  ('innovazione', 'livello2'),
  ('innovation', 'livello2')
on conflict (parola, livello) do nothing;

insert into impostazioni_job (id, ora, fuso_orario) values (1, 8, 'Europe/Rome')
on conflict (id) do nothing;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): add richieste_accesso, parole_chiave, impostazioni_job tables with RLS"
```

This task's real verification (the user running the new SQL block in the Supabase SQL Editor, confirming the three new tables and the seeded rows appear) happens in the interactive step after this whole plan is merged — do not attempt to execute SQL yourself, you have no direct database connection.

---

### Task 2: Scraper — caricaKeywords/caricaSchedule Supabase-backed con ripiego su file

**Files:**
- Modify: `scraper/src/lib/config.ts`
- Modify: `scraper/src/lib/config.test.ts`

**Interfaces:**
- Produces: `caricaKeywords(client: SupabaseClient | null): Promise<Keywords>` and `caricaSchedule(client: SupabaseClient | null): Promise<ScheduleConfig>` — both now async and both take a nullable client (`null` = use the local JSON file fallback). `caricaSources()` is unchanged (still sync, still reads `config/sources.json` unconditionally). Consumed by Task 3 (`index.ts`).

- [ ] **Step 1: Write the failing tests — replace the entire content of `scraper/src/lib/config.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { caricaKeywords, caricaSchedule, caricaSources } from './config.js';

interface RisultatoFinto {
  data?: unknown;
  error?: { message: string } | null;
}

function creaClienteFinto(risultatiPerTabella: Record<string, RisultatoFinto>): any {
  return {
    from(tabella: string) {
      const risultato = risultatiPerTabella[tabella] ?? { data: null, error: null };
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        single: async () => ({ data: risultato.data ?? null, error: risultato.error ?? null }),
        then(resolve: (v: { data: unknown; error: unknown }) => void) {
          resolve({ data: risultato.data ?? null, error: risultato.error ?? null });
        },
      };
      return builder;
    },
  };
}

describe('caricaKeywords', () => {
  it('legge da Supabase quando è passato un client, dividendo per livello', async () => {
    const client = creaClienteFinto({
      parole_chiave: {
        data: [
          { parola: 'gaming', livello: 'livello1' },
          { parola: 'startup', livello: 'livello2' },
          { parola: 'fintech', livello: 'livello1' },
        ],
        error: null,
      },
    });

    const keywords = await caricaKeywords(client);
    expect(keywords.livello1).toEqual(['gaming', 'fintech']);
    expect(keywords.livello2).toEqual(['startup']);
  });

  it('lancia un errore se Supabase restituisce un errore', async () => {
    const client = creaClienteFinto({
      parole_chiave: { data: null, error: { message: 'connessione fallita' } },
    });

    await expect(caricaKeywords(client)).rejects.toThrow('connessione fallita');
  });

  it('legge dal file locale quando il client è null (ripiego senza credenziali)', async () => {
    const keywords = await caricaKeywords(null);
    expect(keywords.livello1).toContain('gaming');
    expect(keywords.livello2).toContain('startup');
  });
});

describe('caricaSchedule', () => {
  it('legge da Supabase quando è passato un client', async () => {
    const client = creaClienteFinto({
      impostazioni_job: { data: { ora: 9, fuso_orario: 'Europe/Rome' }, error: null },
    });

    const schedule = await caricaSchedule(client);
    expect(schedule).toEqual({ ora: 9, timezone: 'Europe/Rome' });
  });

  it('lancia un errore se Supabase restituisce un errore', async () => {
    const client = creaClienteFinto({
      impostazioni_job: { data: null, error: { message: 'riga non trovata' } },
    });

    await expect(caricaSchedule(client)).rejects.toThrow('riga non trovata');
  });

  it('legge dal file locale quando il client è null (ripiego senza credenziali)', async () => {
    const schedule = await caricaSchedule(null);
    expect(schedule.ora).toBe(8);
    expect(schedule.timezone).toBe('Europe/Rome');
  });
});

describe('caricaSources', () => {
  it('carica le fonti dal file reale, con almeno EIT attiva', () => {
    const fonti = caricaSources();
    const eit = fonti.find((f) => f.id === 'eit');
    expect(eit).toBeDefined();
    expect(eit?.attivo).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scraper && npx vitest run config`
Expected: FAIL — `caricaKeywords`/`caricaSchedule` don't accept a client parameter yet, type errors and/or wrong (sync) behavior.

- [ ] **Step 3: Replace `scraper/src/lib/config.ts`**

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Keywords, ScheduleConfig, SourceConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, '../../../config');

export async function caricaKeywords(client: SupabaseClient | null): Promise<Keywords> {
  if (!client) {
    const raw = readFileSync(resolve(CONFIG_DIR, 'keywords.json'), 'utf8');
    return JSON.parse(raw) as Keywords;
  }

  const { data, error } = await client.from('parole_chiave').select('parola, livello');
  if (error) {
    throw new Error(`Impossibile caricare le parole chiave da Supabase: ${error.message}`);
  }

  const righe = (data ?? []) as { parola: string; livello: string }[];
  return {
    livello1: righe.filter((r) => r.livello === 'livello1').map((r) => r.parola),
    livello2: righe.filter((r) => r.livello === 'livello2').map((r) => r.parola),
  };
}

export function caricaSources(): SourceConfig[] {
  const raw = readFileSync(resolve(CONFIG_DIR, 'sources.json'), 'utf8');
  const parsed = JSON.parse(raw) as { fonti: SourceConfig[] };
  return parsed.fonti;
}

export async function caricaSchedule(client: SupabaseClient | null): Promise<ScheduleConfig> {
  if (!client) {
    const raw = readFileSync(resolve(CONFIG_DIR, 'schedule.json'), 'utf8');
    return JSON.parse(raw) as ScheduleConfig;
  }

  const { data, error } = await client
    .from('impostazioni_job')
    .select('ora, fuso_orario')
    .eq('id', 1)
    .single();
  if (error) {
    throw new Error(`Impossibile caricare l'orario di esecuzione da Supabase: ${error.message}`);
  }

  const riga = data as { ora: number; fuso_orario: string };
  return { ora: riga.ora, timezone: riga.fuso_orario };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scraper && npx vitest run config`
Expected: PASS (7 tests)

- [ ] **Step 5: Run full scraper suite and typecheck**

Run: `cd scraper && npm test && npx tsc --noEmit`
Expected: all pass — other files that call `caricaKeywords`/`caricaSchedule` (only `index.ts`, handled in Task 3) will show type errors until Task 3 lands; this is expected transitional state, exactly like Fase 5's `FiltriStato` extension. Confirm the failures are confined to `index.ts` and nothing else.

- [ ] **Step 6: Commit**

```bash
git add scraper/src/lib/config.ts scraper/src/lib/config.test.ts
git commit -m "feat(scraper): make caricaKeywords/caricaSchedule Supabase-backed with local-file fallback"
```

---

### Task 3: Scraper — collegare index.ts al nuovo client condiviso

**Files:**
- Modify: `scraper/src/index.ts`

**Interfaces:**
- Consumes: `caricaKeywords(client)`, `caricaSchedule(client)` from Task 2; `creaClienteSupabaseReale()` from `./lib/db-port-supabase.js` (unchanged, pre-existing).
- Produces: no new exports — this is the entry point, not imported elsewhere.

- [ ] **Step 1: Replace `scraper/src/index.ts` in full**

```ts
import { caricaKeywords, caricaSchedule, caricaSources } from './lib/config.js';
import { creaDbPortConsole } from './lib/db-port-console.js';
import { creaClienteSupabaseReale, creaDbPortSupabase } from './lib/db-port-supabase.js';
import { formattaEmailDigest, inviaEmailReale } from './lib/email.js';
import { eseguiRaccolta } from './lib/orchestrator.js';
import { eOraDiEseguire } from './lib/schedule.js';
import type { DbPort } from './lib/db-port.js';
import type { Scraper } from './lib/types.js';
import type { SupabaseClient } from '@supabase/supabase-js';

async function costruisciScraperAttivi(): Promise<Scraper[]> {
  const fontiAttive = caricaSources().filter((f) => f.attivo && f.scraperModule);
  const scrapers: Scraper[] = [];

  for (const fonte of fontiAttive) {
    const modulo = await import(`./sources/${fonte.scraperModule}.js`);
    scrapers.push(modulo.default as Scraper);
  }

  return scrapers;
}

function costruisciClienteSupabase(): SupabaseClient | null {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return creaClienteSupabaseReale();
  }
  return null;
}

function costruisciDbPort(client: SupabaseClient | null): DbPort {
  if (client) {
    console.log('Uso il database Supabase reale.');
    return creaDbPortSupabase(client);
  }
  console.log('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY assenti: uso il DbPort console (solo log, nessun salvataggio reale).');
  return creaDbPortConsole();
}

async function main(): Promise<void> {
  const client = costruisciClienteSupabase();
  const schedule = await caricaSchedule(client);
  const forzaEsecuzione = process.argv.includes('--force');

  if (!forzaEsecuzione && !eOraDiEseguire(schedule)) {
    console.log(`Non e l'ora configurata (${schedule.ora}:00 ${schedule.timezone}), esco senza eseguire.`);
    return;
  }

  const keywords = await caricaKeywords(client);
  const scrapers = await costruisciScraperAttivi();
  const db = costruisciDbPort(client);

  const risultato = await eseguiRaccolta(scrapers, keywords, db);

  console.log(`\nTrovati ${risultato.nuoviBandiRilevanti.length} nuovi bandi rilevanti.`);
  if (risultato.fontiFallite.length > 0) {
    console.log('Attenzione, fonti fallite:', risultato.fontiFallite);
  }

  const destinatario = process.env.NOTIFICATION_EMAIL;
  if (risultato.nuoviBandiRilevanti.length === 0) {
    console.log('Nessun nuovo bando rilevante: nessuna email da inviare.');
  } else if (!process.env.RESEND_API_KEY || !destinatario) {
    console.log('RESEND_API_KEY/NOTIFICATION_EMAIL assenti: email non inviata (solo log).');
  } else {
    const html = formattaEmailDigest(risultato.nuoviBandiRilevanti, risultato.fontiFallite);
    await inviaEmailReale({
      a: destinatario,
      oggetto: `Fund Radar: ${risultato.nuoviBandiRilevanti.length} nuovi bandi`,
      html,
    });
    console.log(`Email inviata a ${destinatario}.`);
  }
}

main().catch((err) => {
  console.error('Errore fatale nel job:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run typecheck and the full suite**

Run: `cd scraper && npx tsc --noEmit && npm test`
Expected: both clean — this closes the transitional gap Task 2 opened. 58+ tests (whatever the current scraper suite total is) all passing, zero typecheck errors anywhere in the project.

- [ ] **Step 3: Manual local dry-run without real credentials (fallback path)**

Run: `cd scraper && npx tsx src/index.ts --force`
Expected: completes exactly as before this plan — no `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` set locally means `costruisciClienteSupabase()` returns `null`, so `caricaKeywords`/`caricaSchedule` read the local JSON files and the whole pipeline runs in console/demo mode, unchanged from pre-Fase-6 behavior. This is the regression check for the fallback requirement — if this now fails or requires real credentials, STOP and report BLOCKED.

- [ ] **Step 4: Commit**

```bash
git add scraper/src/index.ts
git commit -m "feat(scraper): build the Supabase client once and thread it through config loading"
```

---

### Task 4: Edge Function — struttura, verifica amministratore, azione elenco_utenti

**Files:**
- Create: `supabase/functions/admin-actions/index.ts`

**Interfaces:**
- Produces: an HTTP endpoint accepting `POST` requests with an `Authorization: Bearer <token>` header and a JSON body `{ azione: string, ... }`. This task implements the shared request-handling scaffolding (auth check, action routing) plus the `elenco_utenti` action. Tasks 5 and 6 add more `azione` branches to this same file — read this task's final file content carefully, since your dispatch will hand you the exact starting point to extend.

- [ ] **Step 1: Create `supabase/functions/admin-actions/index.ts`**

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

const EMAIL_AMMINISTRATORE = 'panto75@gmail.com';

function clienteServizio() {
  const url = Deno.env.get('SUPABASE_URL');
  const chiave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !chiave) {
    throw new Error("Variabili d'ambiente SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY mancanti");
  }
  return createClient(url, chiave);
}

async function emailUtenteAutenticato(richiesta: Request, client: ReturnType<typeof clienteServizio>): Promise<string | null> {
  const intestazione = richiesta.headers.get('Authorization');
  if (!intestazione) return null;

  const token = intestazione.replace('Bearer ', '');
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

function risposta(corpo: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (richiesta: Request) => {
  if (richiesta.method !== 'POST') {
    return risposta({ errore: 'Metodo non consentito' }, 405);
  }

  const client = clienteServizio();
  const email = await emailUtenteAutenticato(richiesta, client);
  if (email !== EMAIL_AMMINISTRATORE) {
    return risposta({ errore: 'Non autorizzato' }, 403);
  }

  const corpo = await richiesta.json();

  if (corpo.azione === 'elenco_utenti') {
    const { data, error } = await client.auth.admin.listUsers();
    if (error) {
      return risposta({ errore: error.message }, 500);
    }
    const utenti = data.users.map((u) => ({ id: u.id, email: u.email }));
    return risposta({ utenti }, 200);
  }

  return risposta({ errore: 'Azione sconosciuta' }, 400);
});
```

- [ ] **Step 2: Read through the file once for correctness**

There is no automated test for this file (see the plan's Global Constraints). Instead, verify by reading:
- Every `Response` includes a status code and valid JSON body.
- The admin-email check happens before the body is parsed and before any action branch runs — no action can execute without it passing.
- `emailUtenteAutenticato` returns `null` (not throwing) when the header is missing or the token is invalid, so the check above correctly falls through to the 403 branch rather than crashing.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/admin-actions/index.ts
git commit -m "feat(edge-function): add admin-actions scaffolding with auth check and elenco_utenti"
```

---

### Task 5: Edge Function — azione approva_richiesta

**Files:**
- Modify: `supabase/functions/admin-actions/index.ts`

**Interfaces:**
- Consumes: the file as Task 4 left it.
- Produces: adds one more `azione` branch. No new exports (this file has none — it's a Deno HTTP handler).

- [ ] **Step 1: Add the `approva_richiesta` branch to `supabase/functions/admin-actions/index.ts`**

Insert this new `if` block immediately after the existing `elenco_utenti` block (before the final `return risposta({ errore: 'Azione sconosciuta' }, 400);` line):

```ts
  if (corpo.azione === 'approva_richiesta') {
    const { id, email: emailRichiedente } = corpo;
    if (!id || !emailRichiedente) {
      return risposta({ errore: 'id ed email sono obbligatori' }, 400);
    }

    const { error: erroreCreazione } = await client.auth.admin.createUser({
      email: emailRichiedente,
      email_confirm: true,
    });
    if (erroreCreazione) {
      return risposta({ errore: erroreCreazione.message }, 500);
    }

    const { error: erroreAggiornamento } = await client
      .from('richieste_accesso')
      .update({ stato: 'approvata' })
      .eq('id', id);
    if (erroreAggiornamento) {
      return risposta({ errore: erroreAggiornamento.message }, 500);
    }

    return risposta({ ok: true }, 200);
  }
```

- [ ] **Step 2: Read through the change for correctness**

Verify: both Supabase calls (`createUser`, then the `update`) check their own `error` before proceeding to the next step — if user creation fails, the request's `stato` must NOT be marked `'approvata'` (the code above returns early on `erroreCreazione`, before reaching the update — confirm this ordering is preserved). Confirm `id` and `email` are read from the request body, not assumed/hardcoded.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/admin-actions/index.ts
git commit -m "feat(edge-function): add approva_richiesta action"
```

---

### Task 6: Edge Function — azione revoca_utente

**Files:**
- Modify: `supabase/functions/admin-actions/index.ts`

**Interfaces:**
- Consumes: the file as Task 5 left it.
- Produces: adds the final `azione` branch.

- [ ] **Step 1: Add the `revoca_utente` branch to `supabase/functions/admin-actions/index.ts`**

Insert this new `if` block immediately after the `approva_richiesta` block (still before the final `'Azione sconosciuta'` fallback):

```ts
  if (corpo.azione === 'revoca_utente') {
    const { id: idUtente } = corpo;
    if (!idUtente) {
      return risposta({ errore: 'id è obbligatorio' }, 400);
    }

    const { error } = await client.auth.admin.deleteUser(idUtente);
    if (error) {
      return risposta({ errore: error.message }, 500);
    }

    return risposta({ ok: true }, 200);
  }
```

- [ ] **Step 2: Read through the complete file one final time**

Confirm the file now has exactly three action branches (`elenco_utenti`, `approva_richiesta`, `revoca_utente`) plus the unchanged fallback, all reachable only after the admin-email check, each returning a well-formed JSON response with an appropriate status code.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/admin-actions/index.ts
git commit -m "feat(edge-function): add revoca_utente action"
```

---

### Task 7: Wrap-up

**Files:**
- Modify: `scraper/README.md`
- Modify: `supabase/functions/admin-actions/README.md` (new file)

**Interfaces:**
- None — documentation only.

- [ ] **Step 1: Add a status paragraph to `scraper/README.md`**

Do not edit any existing content in this file — only append a new section at the very end of the file:

```markdown

## Stato Fase 6a

`caricaKeywords()` e `caricaSchedule()` leggono ora da Supabase (tabelle
`parole_chiave` e `impostazioni_job`) quando le credenziali reali sono presenti,
mantenendo `config/keywords.json`/`config/schedule.json` come ripiego per i test
locali senza credenziali — verificato che `npx tsx src/index.ts --force` continua a
funzionare senza toccare dati reali, esattamente come prima.

Resta da fare (dopo il merge): eseguire lo schema aggiornato nell'SQL Editor di
Supabase, pubblicare la Edge Function `admin-actions`, e verificarla con una
chiamata reale.
```

- [ ] **Step 2: Create `supabase/functions/admin-actions/README.md`**

```markdown
# Edge Function `admin-actions`

Gestisce le azioni riservate all'amministratore del pannello di controllo (Fase 6):
creare un accesso approvato, revocarlo, elencare gli utenti autorizzati. Non
richiama mai queste azioni dal browser con la chiave `service_role` — la chiave
resta sempre lato server, dentro questa funzione.

## Azioni supportate

Richiesta `POST` con intestazione `Authorization: Bearer <token della sessione>` e
corpo JSON `{ "azione": "...", ... }`:

- `elenco_utenti` — nessun parametro aggiuntivo. Restituisce `{ utenti: [...] }`.
- `approva_richiesta` — richiede `id` (id della riga in `richieste_accesso`) ed
  `email`. Crea l'utente Supabase Auth e marca la richiesta come approvata.
- `revoca_utente` — richiede `id` (id dell'utente Supabase Auth). Elimina l'utente.

Ogni richiesta viene rifiutata con `403` se il token non corrisponde all'email
`panto75@gmail.com`.

## Pubblicazione (da fare dopo il merge, non automatizzata in questo piano)

```bash
npx supabase functions deploy admin-actions --project-ref atcdtnmwbllvdeikswfk --use-api
```

Non richiede Docker (grazie al flag `--use-api`). Le variabili
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` sono già disponibili automaticamente a
ogni Edge Function del progetto, non vanno configurate a parte.
```

- [ ] **Step 3: Commit**

```bash
git add scraper/README.md supabase/functions/admin-actions/README.md
git commit -m "docs: add Fase 6a status and admin-actions Edge Function README"
```

---

## Fine Fase 6a — piano

Dopo l'esecuzione di tutti i task: revisione a due stadi per ciascun task, più una
revisione finale sull'intero insieme (compresi Tasks 4-6, valutati per lettura
attenta data l'assenza di test automatici per il codice Deno, come dichiarato nei
Vincoli Globali). Il deploy reale e la verifica dal vivo della Edge Function
(pubblicazione, chiamata di prova via `curl`, esecuzione dello schema SQL
aggiornato) avvengono dopo il merge, in modo interattivo — stesso schema già usato
per la Fase 3b e la Fase 4b. La Fase 6b (interfaccia del pannello nella dashboard)
è un piano separato successivo, che userà queste tabelle e questa Edge Function.
