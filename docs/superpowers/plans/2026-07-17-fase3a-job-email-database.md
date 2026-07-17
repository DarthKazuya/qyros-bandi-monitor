# Fase 3a — Job schedulato, database reale e invio email (QYROS Bandi Monitor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scrivere e testare (con dati finti) l'adattatore Supabase reale, l'invio email via Resend, lo schema del database, e il workflow GitHub Actions — tutta la parte che si può costruire e verificare senza ancora avere le credenziali reali dell'utente. Il collegamento e la verifica dal vivo (Fase 3b) seguiranno appena l'utente avrà creato gli account.

**Architecture:** `DbPort` (Fase 1) riceve una seconda implementazione reale basata su `@supabase/supabase-js`, selezionata a runtime in base alla presenza delle variabili d'ambiente `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (altrimenti `index.ts` continua a usare l'implementazione console già esistente, per non rompere i test manuali locali). L'invio email è una funzione iniettabile analoga a `FetchHtml`, con un'implementazione reale che chiama l'API REST di Resend via `axios` (già una dipendenza, nessun nuovo pacchetto per l'email). Un workflow GitHub Actions esegue il job ogni ora (stesso pattern di autocontrollo dell'orario di Fase 1) con `xvfb-run` per lo scraper Cariplo che richiede un browser non-headless.

**Tech Stack:** stesso stack di Fase 1/2, più `@supabase/supabase-js` (nuova dipendenza, solo per l'adattatore Supabase).

## Global Constraints

- Stesse regole di Fase 1/2: import relativi con estensione `.js`, termini di dominio in italiano, un commit per task, comandi git dalla root del repository.
- Nessuna credenziale reale nei test automatici: l'adattatore Supabase e l'invio email seguono lo stesso pattern di dependency injection già usato per tutti gli scraper (funzione/client iniettabile con default reale, test con un finto).
- La verifica dal vivo contro Supabase e Resend reali è **fuori scope per questo piano** (richiede credenziali dell'utente non ancora disponibili) — è oggetto del piano successivo "Fase 3b — Deploy", scritto quando le credenziali saranno note.
- Segreti (chiavi API, URL del database) vivono solo in variabili d'ambiente/GitHub Secrets, mai nel codice o nei file di configurazione committati.
- Percorso di lavoro: repository `/Users/lucapanto/qyros-bandi-monitor`, ramo `main` già aggiornato con la Fase 2 completa (7/8 fonti attive, 46/46 test).

---

### Task 1: Adattatore Supabase per DbPort

**Files:**
- Modify: `scraper/package.json` (aggiunge `@supabase/supabase-js`)
- Create: `scraper/src/lib/db-port-supabase.ts`
- Test: `scraper/src/lib/db-port-supabase.test.ts`

**Interfaces:**
- Consumes: `DbPort`, `FonteFallita` da `./db-port.js`; `BandoRaw`, `EsistenteBando`, `Priorita` da `./types.js`.
- Produces: `creaClienteSupabaseReale(): SupabaseClient` (legge `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` da `process.env`), `creaDbPortSupabase(client: SupabaseClient): DbPort` — usato da `index.ts` (Task 4).

- [ ] **Step 1: Aggiungere `@supabase/supabase-js` a `scraper/package.json`**

Modificare la sezione `dependencies`:

```json
  "dependencies": {
    "@supabase/supabase-js": "^2.47.10",
    "axios": "^1.7.9",
    "cheerio": "^1.0.0",
    "form-data": "^4.0.1",
    "playwright": "^1.49.0"
  },
```

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm install`
Expected: installazione completata senza errori.

- [ ] **Step 2: Scrivere il test (fallirà, `db-port-supabase.ts` non esiste)**

Create `scraper/src/lib/db-port-supabase.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { creaDbPortSupabase } from './db-port-supabase.js';
import type { BandoRaw } from './types.js';

interface RisultatoFinto {
  data?: unknown;
  error?: { message: string } | null;
}

function creaBuilderFinto(risultato: RisultatoFinto) {
  const builder: any = {
    eq: () => builder,
    select: () => builder,
    insert: (valori: unknown) => {
      builder.ultimoInsert = valori;
      return builder;
    },
    update: (valori: unknown) => {
      builder.ultimoUpdate = valori;
      return builder;
    },
    maybeSingle: async () => ({ data: risultato.data ?? null, error: risultato.error ?? null }),
    then(resolve: (v: { data: unknown; error: unknown }) => void) {
      resolve({ data: risultato.data ?? null, error: risultato.error ?? null });
    },
  };
  return builder;
}

function creaClienteFinto(risultatiPerTabella: Record<string, RisultatoFinto>) {
  const buildersCreati: Record<string, ReturnType<typeof creaBuilderFinto>> = {};
  const client: any = {
    from(tabella: string) {
      const builder = creaBuilderFinto(risultatiPerTabella[tabella] ?? {});
      buildersCreati[tabella] = builder;
      return builder;
    },
  };
  return { client, buildersCreati };
}

function creaBando(overrides: Partial<BandoRaw> = {}): BandoRaw {
  return {
    fonte: 'eit',
    titolo: 'Bando di test',
    descrizione: 'Descrizione di test',
    url: 'https://esempio.it/bando-test',
    scadenza: '2026-12-31',
    data_pubblicazione: null,
    hash_contenuto: 'abc123',
    ...overrides,
  };
}

describe('creaDbPortSupabase', () => {
  it('trovaEsistente restituisce null quando non trova righe', async () => {
    const { client } = creaClienteFinto({ bandi: { data: null, error: null } });
    const db = creaDbPortSupabase(client);

    const risultato = await db.trovaEsistente('eit', 'https://esempio.it/bando-test');

    expect(risultato).toBeNull();
  });

  it('trovaEsistente restituisce hash_contenuto quando trova una riga', async () => {
    const { client } = creaClienteFinto({ bandi: { data: { hash_contenuto: 'xyz789' }, error: null } });
    const db = creaDbPortSupabase(client);

    const risultato = await db.trovaEsistente('eit', 'https://esempio.it/bando-test');

    expect(risultato).toEqual({ hash_contenuto: 'xyz789' });
  });

  it('inserisciBando invia tutti i campi corretti alla tabella bandi', async () => {
    const { client, buildersCreati } = creaClienteFinto({ bandi: { error: null } });
    const db = creaDbPortSupabase(client);

    await db.inserisciBando(creaBando(), 'alta', false);

    expect(buildersCreati.bandi.ultimoInsert).toMatchObject({
      fonte: 'eit',
      titolo: 'Bando di test',
      url: 'https://esempio.it/bando-test',
      priorita: 'alta',
      scartato: false,
      hash_contenuto: 'abc123',
    });
  });

  it('lancia un errore descrittivo quando Supabase restituisce un errore', async () => {
    const { client } = creaClienteFinto({ bandi: { error: { message: 'connessione rifiutata' } } });
    const db = creaDbPortSupabase(client);

    await expect(db.inserisciBando(creaBando(), 'alta', false)).rejects.toThrow('connessione rifiutata');
  });

  it('registraEsitoJob invia fonti_ok, fonti_fallite e nuovi_bandi alla tabella job_run_log', async () => {
    const { client, buildersCreati } = creaClienteFinto({ job_run_log: { error: null } });
    const db = creaDbPortSupabase(client);

    await db.registraEsitoJob(['eit'], [{ fonte: 'invitalia', errore: 'timeout' }], 3);

    expect(buildersCreati.job_run_log.ultimoInsert).toEqual({
      fonti_ok: ['eit'],
      fonti_fallite: [{ fonte: 'invitalia', errore: 'timeout' }],
      nuovi_bandi: 3,
    });
  });

  it('aggiornaBando invia i campi aggiornati (senza fonte/url, usati solo per il filtro) alla tabella bandi', async () => {
    const { client, buildersCreati } = creaClienteFinto({ bandi: { error: null } });
    const db = creaDbPortSupabase(client);

    await db.aggiornaBando('eit', 'https://esempio.it/bando-test', creaBando({ titolo: 'Titolo aggiornato' }));

    expect(buildersCreati.bandi.ultimoUpdate).toMatchObject({
      titolo: 'Titolo aggiornato',
      hash_contenuto: 'abc123',
    });
    expect(buildersCreati.bandi.ultimoUpdate).toHaveProperty('aggiornato_il');
  });
});
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- db-port-supabase.test`
Expected: FAIL — `Cannot find module './db-port-supabase.js'`.

- [ ] **Step 4: Implementare `scraper/src/lib/db-port-supabase.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BandoRaw, EsistenteBando, Priorita } from './types.js';
import type { DbPort, FonteFallita } from './db-port.js';

export function creaClienteSupabaseReale(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chiave) {
    throw new Error("Variabili d'ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY mancanti");
  }
  return createClient(url, chiave);
}

export function creaDbPortSupabase(client: SupabaseClient): DbPort {
  return {
    async trovaEsistente(fonte: string, url: string): Promise<EsistenteBando | null> {
      const { data, error } = await client
        .from('bandi')
        .select('hash_contenuto')
        .eq('fonte', fonte)
        .eq('url', url)
        .maybeSingle();
      if (error) throw new Error(`Supabase trovaEsistente: ${error.message}`);
      return data ? { hash_contenuto: (data as { hash_contenuto: string }).hash_contenuto } : null;
    },

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

    async aggiornaBando(fonte: string, url: string, bando: BandoRaw): Promise<void> {
      const { error } = await client
        .from('bandi')
        .update({
          titolo: bando.titolo,
          descrizione: bando.descrizione,
          scadenza: bando.scadenza,
          data_pubblicazione: bando.data_pubblicazione,
          hash_contenuto: bando.hash_contenuto,
          aggiornato_il: new Date().toISOString(),
        })
        .eq('fonte', fonte)
        .eq('url', url);
      if (error) throw new Error(`Supabase aggiornaBando: ${error.message}`);
    },

    async registraEsitoJob(fontiOk: string[], fontiFallite: FonteFallita[], nuoviBandi: number): Promise<void> {
      const { error } = await client.from('job_run_log').insert({
        fonti_ok: fontiOk,
        fonti_fallite: fontiFallite,
        nuovi_bandi: nuoviBandi,
      });
      if (error) throw new Error(`Supabase registraEsitoJob: ${error.message}`);
    },
  };
}
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- db-port-supabase.test`
Expected: PASS — 6 test verdi.

- [ ] **Step 6: Eseguire il typecheck**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm run typecheck`
Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/package.json scraper/package-lock.json scraper/src/lib/db-port-supabase.ts scraper/src/lib/db-port-supabase.test.ts
git commit -m "Implementa adattatore Supabase per DbPort, testato con client finto"
```

---

### Task 2: Schema del database

**Files:**
- Create: `supabase/schema.sql`

**Interfaces:**
- Nessuna interfaccia di codice: produce lo script SQL che l'utente incollerà nell'SQL Editor di Supabase durante il deploy (Fase 3b).

- [ ] **Step 1: Creare `supabase/schema.sql`**

```sql
-- QYROS Bandi Monitor — schema Supabase (Fase 3)
-- Da eseguire una sola volta nell'SQL Editor di Supabase:
-- Project → SQL Editor → New query → incollare questo intero file → Run

create table if not exists bandi (
  id uuid primary key default gen_random_uuid(),
  fonte text not null,
  titolo text not null,
  descrizione text not null,
  url text not null,
  scadenza date,
  data_pubblicazione date,
  hash_contenuto text not null,
  priorita text check (priorita in ('alta', 'da_verificare')),
  scartato boolean not null default false,
  stato text not null default 'nuovo' check (stato in ('nuovo', 'visto', 'scaduto')),
  primo_rilevamento timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  unique (fonte, url)
);

create table if not exists job_run_log (
  id uuid primary key default gen_random_uuid(),
  eseguito_il timestamptz not null default now(),
  fonti_ok text[] not null default '{}',
  fonti_fallite jsonb not null default '[]'::jsonb,
  nuovi_bandi integer not null default 0
);

-- Row Level Security: lettura e modifica riservate agli utenti autenticati
-- (dashboard, Fase 4). Il job scrive con la service_role key, che bypassa
-- sempre le policy RLS per progetto/disegno di Supabase: non serve alcuna
-- policy esplicita per l'inserimento dal job.
alter table bandi enable row level security;
alter table job_run_log enable row level security;

create policy "bandi_select_authenticated" on bandi
  for select to authenticated using (true);

create policy "bandi_update_stato_authenticated" on bandi
  for update to authenticated using (true) with check (true);
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add supabase/schema.sql
git commit -m "Aggiunge schema database Supabase (tabelle bandi e job_run_log, RLS)"
```

---

### Task 3: Invio email digest via Resend

**Files:**
- Create: `scraper/src/lib/email.ts`
- Test: `scraper/src/lib/email.test.ts`

**Interfaces:**
- Consumes: `BandoRaw`, `Priorita` da `./types.js`; `FonteFallita` da `./db-port.js`.
- Produces: `formattaEmailDigest(nuoviBandi: NuovoBandoTrovato[], fontiFallite: FonteFallita[]): string`, `inviaEmailReale(opzioni): Promise<void>`, tipo `FunzioneInvioEmail` — usati da `index.ts` (Task 4).

- [ ] **Step 1: Scrivere il test (fallirà, `email.ts` non esiste)**

Create `scraper/src/lib/email.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formattaEmailDigest } from './email.js';
import type { BandoRaw } from './types.js';

function creaBando(overrides: Partial<BandoRaw> = {}): BandoRaw {
  return {
    fonte: 'eit',
    titolo: 'Bando di test',
    descrizione: 'Descrizione',
    url: 'https://esempio.it/bando-test',
    scadenza: '2026-12-31',
    data_pubblicazione: null,
    hash_contenuto: 'abc123',
    ...overrides,
  };
}

describe('formattaEmailDigest', () => {
  it('include titolo, fonte, scadenza e link per ogni bando, con il badge di priorita corretto', () => {
    const html = formattaEmailDigest(
      [
        { bando: creaBando({ titolo: 'Bando Alta Priorita' }), priorita: 'alta' },
        { bando: creaBando({ titolo: 'Bando Da Verificare' }), priorita: 'da_verificare' },
      ],
      []
    );

    expect(html).toContain('Bando Alta Priorita');
    expect(html).toContain('Bando Da Verificare');
    expect(html).toContain('https://esempio.it/bando-test');
    expect(html).toContain('2026-12-31');
    expect(html).toContain('Match diretto');
    expect(html).toContain('Da verificare');
  });

  it('include il conteggio dei nuovi bandi nel titolo', () => {
    const html = formattaEmailDigest([{ bando: creaBando(), priorita: 'alta' }], []);
    expect(html).toContain('1 nuovi bandi');
  });

  it('include una sezione di avviso quando ci sono fonti fallite', () => {
    const html = formattaEmailDigest([{ bando: creaBando(), priorita: 'alta' }], [{ fonte: 'invitalia', errore: 'timeout' }]);
    expect(html).toContain('invitalia');
    expect(html).toContain('non raggiungibili');
  });

  it('non include alcuna sezione di avviso quando non ci sono fonti fallite', () => {
    const html = formattaEmailDigest([{ bando: creaBando(), priorita: 'alta' }], []);
    expect(html).not.toContain('non raggiungibili');
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- email.test`
Expected: FAIL — `Cannot find module './email.js'`.

- [ ] **Step 3: Implementare `scraper/src/lib/email.ts`**

```ts
import axios from 'axios';
import type { BandoRaw, Priorita } from './types.js';
import type { FonteFallita } from './db-port.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

export interface NuovoBandoTrovato {
  bando: BandoRaw;
  priorita: Priorita;
}

export type FunzioneInvioEmail = (opzioni: { a: string; oggetto: string; html: string }) => Promise<void>;

export async function inviaEmailReale(opzioni: { a: string; oggetto: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Variabile d'ambiente RESEND_API_KEY mancante");
  }
  await axios.post(
    RESEND_API_URL,
    {
      from: 'QYROS Bandi Monitor <onboarding@resend.dev>',
      to: [opzioni.a],
      subject: opzioni.oggetto,
      html: opzioni.html,
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
}

function formattaBadgePriorita(priorita: Priorita): string {
  if (priorita === 'alta') {
    return '<span style="background:#ff6500;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">Match diretto</span>';
  }
  return '<span style="background:#3c6a8b;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">Da verificare</span>';
}

export function formattaEmailDigest(nuoviBandi: NuovoBandoTrovato[], fontiFallite: FonteFallita[]): string {
  const righeBandi = nuoviBandi
    .map(
      ({ bando, priorita }) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee;">
          <div>${formattaBadgePriorita(priorita)}</div>
          <div style="font-weight:600;margin-top:6px;"><a href="${bando.url}" style="color:#040a1b;text-decoration:none;">${bando.titolo}</a></div>
          <div style="color:#666;font-size:13px;margin-top:4px;">${bando.fonte}${bando.scadenza ? ` &middot; scadenza ${bando.scadenza}` : ''}</div>
        </td>
      </tr>`
    )
    .join('');

  const sezioneErrori =
    fontiFallite.length > 0
      ? `<p style="margin-top:24px;color:#b00020;">Attenzione, fonti non raggiungibili oggi: ${fontiFallite
          .map((f) => f.fonte)
          .join(', ')}</p>`
      : '';

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#040a1b;">QYROS Bandi Monitor &mdash; ${nuoviBandi.length} nuovi bandi</h2>
      <table style="width:100%;border-collapse:collapse;">${righeBandi}</table>
      ${sezioneErrori}
    </div>
  `;
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test -- email.test`
Expected: PASS — 4 test verdi.

- [ ] **Step 5: Eseguire il typecheck**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm run typecheck`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/lib/email.ts scraper/src/lib/email.test.ts
git commit -m "Implementa formattazione e invio email digest via Resend"
```

---

### Task 4: Collegare Supabase ed email nell'entry point

**Files:**
- Modify: `scraper/src/index.ts`

**Interfaces:**
- Consumes: `creaClienteSupabaseReale`, `creaDbPortSupabase` da `./lib/db-port-supabase.js`; `formattaEmailDigest`, `inviaEmailReale` da `./lib/email.js`; `creaDbPortConsole` da `./lib/db-port-console.js` (Fase 1, invariato).

- [ ] **Step 1: Sostituire `scraper/src/index.ts` con la versione che seleziona il DbPort e invia l'email**

```ts
import { caricaKeywords, caricaSchedule, caricaSources } from './lib/config.js';
import { creaDbPortConsole } from './lib/db-port-console.js';
import { creaClienteSupabaseReale, creaDbPortSupabase } from './lib/db-port-supabase.js';
import { formattaEmailDigest, inviaEmailReale } from './lib/email.js';
import { eseguiRaccolta } from './lib/orchestrator.js';
import { eOraDiEseguire } from './lib/schedule.js';
import type { DbPort } from './lib/db-port.js';
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

function costruisciDbPort(): DbPort {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Uso il database Supabase reale.');
    return creaDbPortSupabase(creaClienteSupabaseReale());
  }
  console.log('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY assenti: uso il DbPort console (solo log, nessun salvataggio reale).');
  return creaDbPortConsole();
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
  const db = costruisciDbPort();

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
      oggetto: `QYROS Bandi Monitor: ${risultato.nuoviBandiRilevanti.length} nuovi bandi`,
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

- [ ] **Step 2: Eseguire l'intera suite di test**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test`
Expected: PASS — tutti i test esistenti più i nuovi di Task 1 e Task 3, nessuna regressione.

- [ ] **Step 3: Eseguire il typecheck**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm run typecheck`
Expected: nessun errore.

- [ ] **Step 4: Verificare che il comportamento locale (senza credenziali reali) resti invariato**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npx tsx src/index.ts --force`
Expected: senza `SUPABASE_URL`/`RESEND_API_KEY` impostate nell'ambiente, stampa `SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY assenti: uso il DbPort console...`, esegue la pipeline come nelle fasi precedenti, e se trova nuovi bandi rilevanti stampa `RESEND_API_KEY/NOTIFICATION_EMAIL assenti: email non inviata...` invece di lanciare un errore. Questo conferma che il codice è pronto per le credenziali reali senza aver rotto il funzionamento locale esistente.

- [ ] **Step 5: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/src/index.ts
git commit -m "Collega Supabase ed email digest nell'entry point, con fallback locale invariato"
```

---

### Task 5: Workflow GitHub Actions per il job giornaliero

**Files:**
- Create: `.github/workflows/daily-job.yml`

**Interfaces:**
- Nessuna interfaccia di codice: produce il file YAML che GitHub Actions eseguirà una volta che il repository sarà su GitHub (Fase 3b).

Nota: questo workflow non può essere eseguito né verificato localmente (richiede l'ambiente reale di GitHub Actions) — verrà collaudato dal vivo nella Fase 3b, dopo il push del repository. Questo task ne verifica solo la correttezza sintattica e la coerenza con quanto già costruito.

- [ ] **Step 1: Creare `.github/workflows/daily-job.yml`**

```yaml
name: Job giornaliero bandi

on:
  schedule:
    - cron: '0 * * * *'
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
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: scraper/package-lock.json

      - name: Installa le dipendenze
        run: npm ci

      - name: Installa il browser Chromium (per lo scraper Fondazione Cariplo)
        run: npx playwright install --with-deps chromium

      - name: Installa un display virtuale (Chromium qui gira in modalita non-headless)
        run: sudo apt-get update && sudo apt-get install -y xvfb

      - name: Esegui il job
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          NOTIFICATION_EMAIL: ${{ secrets.NOTIFICATION_EMAIL }}
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            xvfb-run --auto-servernum npx tsx src/index.ts --force
          else
            xvfb-run --auto-servernum npx tsx src/index.ts
          fi
```

Note di design incorporate in questo file:
- `cron: '0 * * * *'` (ogni ora) invece di un orario fisso: lo script stesso (Fase 1, `schedule.ts`) decide se è davvero l'ora configurata in `config/schedule.json`, gestendo automaticamente il cambio ora legale/solare — coerente con la Fase 1.
- `workflow_dispatch` permette di avviare il job manualmente da GitHub (utile per il collaudo in Fase 3b) e in quel caso passa `--force` per non dover aspettare l'orario esatto.
- `xvfb-run` fornisce un display virtuale, necessario perché lo scraper Fondazione Cariplo usa Chromium in modalità non-headless (Fase 2, Task 6) — Cloudflare blocca specificamente la modalità headless su quel sito.
- I quattro segreti (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NOTIFICATION_EMAIL`) vanno impostati nelle GitHub Secrets del repository durante il deploy (Fase 3b) — non esistono ancora a questo punto del piano.

- [ ] **Step 2: Verificare la sintassi YAML**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor" && python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/daily-job.yml')); print('YAML valido')"`
Expected: stampa `YAML valido` (nessun errore di parsing). Se `python3`/`pyyaml` non sono disponibili nell'ambiente, va bene anche un controllo visivo attento dell'indentazione come alternativa, purché venga dichiarato esplicitamente nel report che non è stata usata una verifica automatica.

- [ ] **Step 3: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add .github/workflows/daily-job.yml
git commit -m "Aggiunge il workflow GitHub Actions per il job giornaliero"
```

---

### Task 6: Wrap-up Fase 3a

**Files:**
- Modify: `scraper/README.md`

**Interfaces:**
- Nessuna nuova interfaccia: task di sola documentazione.

- [ ] **Step 1: Eseguire l'intera suite finale**

Run: `cd "/Users/lucapanto/qyros-bandi-monitor/scraper" && npm test && npm run typecheck`
Expected: tutti i test passano, nessun errore di tipo.

- [ ] **Step 2: Aggiornare `scraper/README.md`**

Aggiungere in fondo al file:

```markdown
## Stato Fase 3a

Adattatore Supabase e invio email via Resend scritti e testati con dati finti
(nessuna credenziale reale usata in questa fase). Il workflow GitHub Actions
`.github/workflows/daily-job.yml` è pronto ma non ancora collaudato dal vivo:
serve prima che il repository sia su GitHub con i quattro segreti configurati
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
`NOTIFICATION_EMAIL`) e che lo schema in `supabase/schema.sql` sia stato
eseguito una volta nel progetto Supabase reale.

Localmente, senza queste variabili d'ambiente impostate, `npx tsx src/index.ts
--force` continua a funzionare esattamente come nelle fasi precedenti (DbPort
console, nessuna email inviata) — utile per continuare a testare in locale
senza bisogno delle credenziali reali.

Il collegamento finale e la verifica dal vivo (push del repository, creazione
del progetto Supabase e dell'account Resend, configurazione dei segreti,
prima esecuzione reale del workflow) sono il contenuto della Fase 3b.
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/lucapanto/qyros-bandi-monitor"
git add scraper/README.md
git commit -m "Documenta stato della Fase 3a"
```

---

## Riepilogo copertura spec (Fase 3a)

- Adattatore database reale (Supabase) dietro l'interfaccia `DbPort` già esistente — Task 1.
- Schema database (tabelle `bandi`, `job_run_log`, Row Level Security) — Task 2.
- Invio email digest via Resend, con badge di priorità nei colori QYROS — Task 3.
- Selezione automatica dell'implementazione (console in locale, reale con le credenziali) — Task 4.
- Job schedulato via GitHub Actions, con lo stesso pattern di autocontrollo orario di Fase 1 e gestione del browser non-headless per Fondazione Cariplo — Task 5.

Fuori scope per questo piano (Fase 3b, quando le credenziali saranno disponibili):
push del repository su GitHub, creazione del progetto Supabase e dell'account
Resend, esecuzione dello schema SQL sul database reale, configurazione dei
GitHub Secrets, prima esecuzione reale e verificata del job (email
effettivamente ricevuta, riga effettivamente scritta su Supabase).

Fuori scope per l'intero progetto Fase 3 (rimandato, come da spec): dashboard
web (Fase 4), creazione manuale dell'utente Supabase Auth per il login della
dashboard (Fase 4/5).
