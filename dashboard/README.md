# QYROS Bandi Monitor — dashboard

## Comandi disponibili

- `npm install` — installa le dipendenze
- `cp .env.example .env` poi modifica `.env` con l'URL e la chiave `anon` reali del
  progetto Supabase (Project Settings → API) — necessario per `npm run dev`
- `npm run dev` — avvia il server di sviluppo locale
- `npm test` — esegue tutti i test automatici (nessuna chiamata di rete reale)
- `npm run typecheck` — verifica i tipi TypeScript
- `npm run build` — crea la build statica di produzione in `dist/`

## Stato Fase 4a

App completa (login, tema QYROS, filtri multi-fonte, ricerca, ordinamento, card bando,
segna come visto/nuovo), tutta testata (nessuna chiamata di rete reale nei test
automatici), verificata anche manualmente in un browser locale. Workflow di
pubblicazione su GitHub Pages (`.github/workflows/deploy-dashboard.yml`) creato.

Resta da fare (Fase 4b): impostare il segreto `SUPABASE_ANON_KEY` su GitHub, abilitare
GitHub Pages per il repository, creare l'utente autorizzato su Supabase Auth,
registrare l'URL della dashboard pubblicata come redirect URL autorizzato, e verificare
l'accesso reale end-to-end.
