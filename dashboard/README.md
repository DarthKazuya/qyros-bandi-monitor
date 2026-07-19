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
l'altra. Tutta testata (nessuna chiamata di rete reale nei test automatici), più
un controllo di non-regressione nel browser locale (schermata di login, nessun
errore in console) — la verifica completa con dati reali avviene dopo la
pubblicazione. Pubblicazione automatica su GitHub Pages ad ogni push su `main`
che tocca `dashboard/**` (`.github/workflows/deploy-dashboard.yml`).

## Stato Fase 6b

Pannello di controllo riservato, visibile solo all'amministratore
(`panto75@gmail.com`), aggiunto sopra al backend della Fase 6a (tabelle Supabase
e Edge Function `admin-actions`, già live).

- **Schermata di login**: guadagna i campi Nome e Cognome (obbligatori, insieme
  all'email già presente). Se l'email inserita è già autorizzata, comportamento
  invariato (link di accesso via email). Se non lo è, invece di mostrare l'errore
  grezzo di Supabase, salva una richiesta di accesso (email, nome, cognome) e
  mostra un messaggio di conferma — nessuna "Richiedi accesso" separata, è lo
  stesso modulo di sempre.
- **Pannello** (pulsante nell'intestazione, solo per l'amministratore): quattro
  schede — Richieste in attesa (approva/rifiuta le richieste di accesso, con
  approvazione che crea davvero l'utente Supabase Auth), Utenti autorizzati
  (elenco con revoca, l'amministratore non può revocare se stesso), Storico
  esecuzioni (sola lettura dal job giornaliero), Configurazione (parole chiave
  aggiungibili/rimovibili per livello, orario di esecuzione modificabile).
- **Esci**: pulsante nell'intestazione, visibile per qualunque utente collegato
  (non solo l'amministratore).

Tutto testato (nessuna chiamata di rete reale nei test automatici, tabelle e
Edge Function mockate), più un controllo di non-regressione nel browser locale
sulla sola schermata di login (Nome/Cognome/Email nell'ordine corretto, nessun
errore in console) — il flusso autenticato completo (richiesta di accesso reale,
pannello con dati reali, approvazione/rifiuto/revoca) viene verificato dopo la
pubblicazione, in modo interattivo.
