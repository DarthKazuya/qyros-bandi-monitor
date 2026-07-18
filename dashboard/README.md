# Fund Radar — dashboard

## Comandi disponibili

- `npm install` — installa le dipendenze
- `cp .env.example .env` poi modifica `.env` con l'URL e la chiave `anon` reali del
  progetto Supabase (Project Settings → API) — necessario per `npm run dev`
- `npm run dev` — avvia il server di sviluppo locale
- `npm test` — esegue tutti i test automatici (nessuna chiamata di rete reale)
- `npm run typecheck` — verifica i tipi TypeScript
- `npm run build` — crea la build statica di produzione in `dist/`

## Stato

Live in produzione: https://darthkazuya.github.io/qyros-bandi-monitor/ (login via
link email, un solo utente autorizzato, registrazione pubblica disattivata).

Funzionalità: login con link via email, tema Fund Radar (scuro di default, con
toggle chiaro/scuro), card bando con badge priorità e conto alla rovescia alla
scadenza (colore di allarme sotto i 30 giorni), filtri per priorità (con contatori),
fonte (sempre tutte le attive, multi-selezione), parole chiave (selezione multipla,
intersezione — un bando deve contenerle tutte), ricerca libera, ordinamento con
direzione invertibile, segna come visto/nuovo, filtri ricordati tra una visita e
l'altra. Tutta testata (nessuna chiamata di rete reale nei test automatici),
verificata anche manualmente in un browser reale con dati reali. Pubblicazione
automatica su GitHub Pages ad ogni push su `main` che tocca `dashboard/**`
(`.github/workflows/deploy-dashboard.yml`).
