# Fund Radar

## Cos'è

Monitora ogni giorno fonti italiane ed europee di bandi e finanziamenti, filtra per parole chiave a due livelli, salva su Supabase, manda una email via Resend quando trova bandi nuovi e li mostra in una dashboard web.
Nome del repo e dei pacchetti: `qyros-bandi-monitor` (nome ufficiale: DA VERIFICARE).
Vincoli: costo di hosting zero o quasi, nessun server sempre acceso, utente non tecnico che cambia fonti, parole chiave e orario senza scrivere codice.

**Attenzione: un push su `main` che tocca `dashboard/**` pubblica subito in produzione (GitHub Pages).**

## Struttura

- `scraper/` — Node 22 + TypeScript (ESM), axios, cheerio, playwright, supabase-js. `src/index.ts` orchestratore; `src/sources/<fonte>.ts` un modulo per fonte (con `.fixtures.ts` e `.test.ts`); `src/lib/` (matching, dedup, hash, email, schedule, config, orchestrator, db-port con implementazioni supabase, console, fake); `src/dev/dry-run-<fonte>.ts`; `scripts/backfill-parole-corrispondenti.ts`.
- `dashboard/` — React 18 + TypeScript + Vite 6 + MUI 6, font Roboto. `src/components/` (più `admin/`), `src/hooks/`, `src/lib/`, `src/theme.ts`.
- `supabase/` — `schema.sql`, Edge Function `admin-actions` e `notifica-richiesta`, `email-templates/`.
- `config/` — `sources.json` (7 fonti attive più `slot-personalizzato` disattivato), `keywords.json`, `schedule.json`. Keywords e schedule sono solo ripiego locale: con le credenziali reali si leggono dalle tabelle Supabase `parole_chiave` e `impostazioni_job`.
- `docs/superpowers/specs/` e `docs/superpowers/plans/` — spec e piani datati per fase.
- `.github/workflows/` — `daily-job.yml` (cron orario, lo scraper si autolimita all'ora configurata), `deploy-dashboard.yml`, `backfill-parole-corrispondenti.yml`.

## Come si avvia

Ogni comando va eseguito dentro la rispettiva cartella. Non c'è un `package.json` nella radice.

- scraper: `npm install`; `npx tsx src/index.ts` (gira solo all'ora configurata); `npx tsx src/index.ts --force`. Senza `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NOTIFICATION_EMAIL` usa il DbPort console: niente salvataggio, niente email.
- dashboard: `npm install`; `cp .env.example .env` e compilare `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; `npm run dev`.
- Segreti solo in GitHub Secrets e `.env` locale.

## Come si prova

- scraper: `npm test` (vitest, nessuna rete reale); `npm run typecheck`; `npx tsx src/dev/dry-run-<fonte>.ts` (una fonte contro il sito reale).
- dashboard: `npm test`; `npm run typecheck`; `npm run build`.
- Non c'è un linter configurato.

## Convenzioni

- Nomi di dominio, componenti, test e commenti in italiano (es. `BandoCard`, `FiltriBar`, `caricaKeywords`).
- Ogni file ha il suo `*.test.ts(x)` accanto; i test non fanno mai chiamate di rete reali (fixtures per gli scraper, mock per Supabase).
- Commit in stile conventional con ambito: `feat(dashboard): …`, `fix(supabase): …`, `docs(specs): …`, `chore(...)`. Negli ultimi commit il testo è in italiano.
- Ogni fase: spec in `docs/superpowers/specs/`, poi piano in `docs/superpowers/plans/`, poi codice.
- Ogni fonte è isolata: un errore in una fonte non ferma le altre.

## Errori da non ripetere

(nessuno per ora)
