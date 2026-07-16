# QYROS Bandi Monitor — Design

Data: 2026-07-16

## Obiettivo

Web app che monitora quotidianamente 8 (espandibili) fonti italiane/europee di bandi e
finanziamenti, filtra i risultati per rilevanza tramite due livelli di keyword, salva i
risultati in un database, invia una notifica email quando trova nuovi bandi rilevanti, e
li mostra in una dashboard web con filtri, ricerca e gestione dello stato di lettura.

Vincoli guida: costo di hosting zero/quasi-zero, nessun server always-on, manutenibile da
un solo sviluppatore (Claude Code) per un utente non tecnico che deve poter modificare
fonti/keyword/orario senza scrivere codice.

## Architettura generale

Tre servizi esterni gratuiti, nessun server persistente:

- **GitHub** — repository del codice, esecuzione del job schedulato via GitHub Actions,
  hosting della dashboard via GitHub Pages.
- **Supabase** — database Postgres gestito (free tier, 500MB) con API REST/JS pronte e
  sistema di autenticazione (magic link) incluso.
- **Resend** — invio email transazionali (free tier, 100 email/giorno).

```
GitHub Actions (cron orario, si autolimita all'ora configurata)
        │
        ▼
  scraper/  (Node.js + TypeScript)
   ├─ 8 moduli sources/*.ts, uno per fonte, isolati con try/catch
   ├─ normalizzazione + hash contenuto
   ├─ matching keyword (livello 1 / livello 2)
   ├─ upsert su Supabase (bandi, job_run_log)
   └─ invio email via Resend se ci sono nuovi bandi rilevanti
        │
        ▼
   Supabase Postgres (bandi, job_run_log) + Supabase Auth (magic link)
        ▲
        │  (letture/scritture stato via API pubblica + RLS)
        │
  dashboard/  (React + TypeScript + MUI, build statica su GitHub Pages)
```

Nessun processo è sempre acceso: il job gira, fa il suo lavoro, termina. La dashboard è
un sito statico che parla direttamente con Supabase dal browser.

## Struttura del repository

```
qyros-bandi-monitor/
├── scraper/
│   ├── src/
│   │   ├── sources/          # un modulo per fonte, stessa interfaccia
│   │   ├── lib/               # matching.ts, hash.ts, db.ts, email.ts, types.ts, time.ts
│   │   └── index.ts            # orchestratore: gira le fonti, isola gli errori, notifica
│   └── package.json
├── dashboard/
│   ├── src/
│   └── package.json
├── config/
│   ├── sources.json             # elenco fonti (id, nome, url, modulo scraper, attivo)
│   ├── keywords.json            # livello1 / livello2
│   └── schedule.json            # ora di esecuzione (default 8), timezone
└── .github/workflows/
    ├── daily-job.yml             # trigger orario, il job stesso decide se agire
    └── deploy-dashboard.yml      # build + pubblica su GitHub Pages
```

Regola di estensibilità: aggiungere una nona fonte richiede solo un nuovo file in
`scraper/src/sources/` che implementa `scrape(): Promise<BandoRaw[]>` più una riga in
`config/sources.json`. Nessuna modifica a matching, orchestratore o dashboard.

## Gestione orario e fuso orario

GitHub Actions esegue i cron trigger in UTC e non può leggere un file di config per
decidere *quando* attivarsi (il trigger è statico nel YAML). Per permettere all'utente di
cambiare l'orario da un file JSON senza toccare YAML:

- Il workflow `daily-job.yml` si attiva **ogni ora** (`cron: '0 * * * *'`).
- Lo script calcola l'ora locale reale di Europe/Rome (gestisce automaticamente il cambio
  ora legale/solare tramite `Intl.DateTimeFormat` con timezone esplicito).
- Se l'ora locale non coincide con `schedule.json.ora`, il job esce subito (pochi secondi
  di esecuzione, irrilevante ai fini del limite gratuito di minuti Actions).
- Se coincide, esegue il ciclo completo.

## Formato dati normalizzato (output di ogni scraper)

```ts
type BandoRaw = {
  fonte: string;
  titolo: string;
  descrizione: string;
  url: string;
  scadenza: string | null;          // ISO date
  data_pubblicazione: string | null; // ISO date
  hash_contenuto: string;            // sha256(titolo + descrizione normalizzati)
};
```

## Schema database (Supabase Postgres)

**Tabella `bandi`**

| campo | tipo | note |
|---|---|---|
| id | uuid, PK | |
| fonte | text | |
| titolo, descrizione, url | text | |
| scadenza, data_pubblicazione | date, nullable | |
| hash_contenuto | text | |
| priorita | text, nullable | `'alta'` \| `'da_verificare'`; `null` se `scartato = true` |
| scartato | boolean | true se nessuna keyword matcha; non mostrato in dashboard di default |
| stato | text | `'nuovo'` \| `'visto'` \| `'scaduto'`, modificato solo manualmente dall'utente |
| primo_rilevamento | timestamptz | |
| aggiornato_il | timestamptz | |

Chiave naturale di deduplica: `(fonte, url)` — indice unico.

**Tabella `job_run_log`**

| campo | tipo | note |
|---|---|---|
| id | uuid, PK | |
| eseguito_il | timestamptz | |
| fonti_ok | text[] | |
| fonti_fallite | jsonb | `[{fonte, errore}]` |
| nuovi_bandi | int | |

**Logica di upsert per record scaricato:**

1. Cerca riga esistente per `(fonte, url)`.
2. Non esiste → nuova riga. Applica matching: se `scartato` resta `false`, il bando entra
   nel digest email del giorno.
3. Esiste, hash identico → nessuna azione.
4. Esiste, hash diverso → aggiorna i campi (titolo/descrizione/scadenza possono essere
   cambiati dalla fonte) e `aggiornato_il`, ma **non** genera una nuova notifica email:
   solo i bandi mai visti prima attivano l'invio.

## Motore di rilevanza

`config/keywords.json`:

```json
{
  "livello1": ["gaming", "fintech", "regtech", "economia circolare", "circular economy"],
  "livello2": ["intelligenza artificiale", "artificial intelligence", "ai", "tecnologia", "tecnologico", "technology", "tech", "startup", "start-up", "innovazione", "innovation"]
}
```

Pipeline di matching su `titolo + " " + descrizione`:

1. Minuscolo, rimozione accenti/diacritici.
2. Normalizzazione varianti con trattino/spazio (es. `start-up`, `start up` → `startup`)
   prima del confronto, sia nel testo sia nelle keyword.
3. Se ≥1 keyword di livello 1 trovata → `priorita = 'alta'`, `scartato = false`.
4. Altrimenti, se ≥1 keyword di livello 2 trovata → `priorita = 'da_verificare'`,
   `scartato = false`.
5. Altrimenti → `scartato = true` (riga comunque salvata per debug, esclusa dalla
   dashboard di default).

Funziona indistintamente su testo italiano e inglese perché entrambe le liste contengono
i termini nelle due lingue.

## Scraper per fonte

Un modulo isolato per fonte in `scraper/src/sources/`, stessa interfaccia
(`scrape(): Promise<BandoRaw[]>`). L'orchestratore chiama ogni scraper dentro un
`try/catch` indipendente: un fallimento viene loggato in `job_run_log.fonti_fallite` e
riportato come avviso nell'email del giorno, senza bloccare le altre fonti.

Le 8 fonti, con approccio previsto (da confermare/adattare in fase di implementazione
dopo ispezione diretta dei siti live):

1. EU Funding & Tenders Portal — API SEDIA se accessibile senza autenticazione,
   altrimenti feed RSS del portale.
2. EIT (eit.europa.eu) — scraping HTML sezione news/bandi.
3. Europa Creativa MEDIA (europacreativa-media.it) — scraping HTML sezione bandi.
4. incentivi.gov.it — scraping HTML, verifica di un eventuale endpoint interno.
5. Invitalia — scraping HTML sezione bandi/incentivi attivi.
6. Bandi e Servizi Regione Lombardia — scraping HTML, verifica di un endpoint JSON dietro
   le chiamate AJAX della pagina elenco.
7. Fondazione Cariplo — scraping HTML.
8. Ottavo slot configurabile, disattivato finché non viene definita una fonte reale in
   `config/sources.json`.

La verifica tecnica (API disponibile sì/no, struttura HTML reale, presenza di endpoint
JSON) richiede di ispezionare i siti live e viene fatta durante l'implementazione di ogni
scraper, non in questa fase di design.

## Email di notifica (Resend)

Inviata solo se il job trova ≥1 bando nuovo (mai visto prima) e non scartato. Contenuto:

- Elenco dei nuovi bandi del giorno, raggruppati per priorità (Match diretto prima, poi
  Da verificare): titolo, fonte, badge priorità, scadenza (se nota), link diretto.
- Se una o più fonti sono fallite quel giorno, sezione finale con l'avviso.

Destinatario: panto75@gmail.com (configurabile).

## Dashboard

React + TypeScript + Vite, componenti MUI (Material 3), build statica pubblicata su
GitHub Pages via Actions ad ogni push su main.

- **Tema**: dark mode di default con sfondo `#040a1b` (coerente con la landing page QYROS
  esistente), toggle per light mode. Accento `#ff6500` (CTA, badge "Match diretto"),
  secondario `#3c6a8b` (header, link, badge "Da verificare").
- **Layout mobile-first**: card impilate su schermo stretto, griglia su desktop; touch
  target ≥44px; nessuno scroll orizzontale.
- **Card bando**: titolo, fonte, badge priorità, scadenza, link esterno, pulsante "Segna
  come visto"/"Segna come nuovo" (le card viste restano visibili con stile attenuato).
- **Barra filtri**: priorità (tutti/Match diretto/Da verificare), fonte (multi-select),
  ricerca testo libero, ordinamento (data pubblicazione di default, o scadenza).
- **Accesso**: login via Supabase Auth con magic link inviato a panto75@gmail.com.
  Nessuna registrazione pubblica: un solo utente, creato manualmente in fase di setup.
  Row Level Security: lettura e modifica `stato` solo per utenti autenticati; inserimento
  nuovi bandi solo dal job (chiave privilegiata `service_role`, mai esposta al browser).

## Configurazione editabile dall'utente (senza scrivere codice)

Tre file JSON in `config/`, modificabili dall'interfaccia web di GitHub (editor di testo
integrato su github.com), ognuno con istruzioni dedicate nella guida di deploy:

- `sources.json` — aggiungere/disattivare fonti.
- `keywords.json` — aggiungere/rimuovere parole chiave nei due livelli.
- `schedule.json` — cambiare l'ora di esecuzione giornaliera.

## Fuori scope (per questa versione)

- Scadenza automatica dello stato "Scaduto" in base alla data di scadenza (lo stato resta
  gestito manualmente dall'utente, come richiesto).
- Riassunto automatico via LLM delle descrizioni (si usa l'estratto/riassunto già
  disponibile sulla fonte, se presente).
- Notifiche push o su altri canali oltre email.
- Gestione multi-utente/multi-tenant.

## Piano di implementazione (fasi)

Il progetto verrà implementato in fasi verificabili singolarmente (dettaglio nel piano di
implementazione separato):

1. **Fondamenta**: scaffold repo, schema Supabase, config files, libreria comune
   (matching, hash, db, email, gestione orario), pipeline end-to-end validata con 1-2
   scraper di prova.
2. **Scraper**: implementazione delle restanti fonti, una alla volta.
3. **Job schedulato + email**: workflow GitHub Actions, orchestrazione con isolamento
   errori, invio email reale via Resend.
4. **Dashboard**: app React/MUI, autenticazione, filtri, ricerca, gestione stato.
5. **Deploy end-to-end**: creazione account (GitHub, Supabase, Resend), configurazione
   chiavi/secrets, primo deploy reale, guida utente in linguaggio semplice per la
   manutenzione futura (modifica config, lettura log errori).
