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

App scaffolded e componenti principali (login, lista bandi, filtri, card) implementati
e testati. Il deploy reale su GitHub Pages e la configurazione dell'autenticazione
Supabase arrivano in Fase 4b.
