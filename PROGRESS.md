# Progress

Aggiornato: domenica 4 ottobre 2026.

## Stato attuale

140 commit, il primo il 16 luglio 2026, l'ultimo il 20 luglio 2026. Nessun commit da allora. Ramo `main`.
Il job giornaliero potrebbe non girare più (vedi Aperto, punto 1).

## Cosa funziona

Secondo README e storia git:

- 7 scraper su 8.
- Job giornaliero con Supabase e Resend.
- Dashboard pubblicata su https://darthkazuya.github.io/qyros-bandi-monitor/ con login via email, filtri (fonte, parole chiave, ricerca, ordinamento), visto/nuovo, tema chiaro/scuro.
- Pannello admin: richieste di accesso, utenti autorizzati, storico esecuzioni, configurazione parole chiave e orario.
- Suggerimento di parole chiave dagli utenti e contatore dei click per parola chiave.
- Notifica all'admin per nuove richieste di accesso.
- Fase 7: palette indaco/teal, Roboto, responsività mobile.

Audit Supabase del 31 luglio 2026 (`supabase-audit.md`, non tracciato da git): database 12 MB, 267 righe in `bandi`, storage a zero, 0 foreign key, 9 avvisi `auth_rls_initplan`, lista bandi caricata senza paginazione, un tentativo fallito ed estraneo al progetto di creare ruolo/schema `jarvis` sullo stesso progetto Supabase.

## Aperto

1. DA VERIFICARE — Il job giornaliero gira ancora regolarmente? Al 31 luglio `job_run_log` aveva solo 2 righe, e GitHub disattiva i cron dopo 60 giorni senza attività nel repo (ultimo commit 20 luglio).
2. DA VERIFICARE — I README di `scraper/` e `dashboard/` sono in parte superati: lo scraper dice ancora che database ed email non sono collegati; quello della dashboard cita il filtro per priorità (rimosso il 20 luglio) e "un solo utente autorizzato".
3. DA VERIFICARE — Accesso con codice OTP in due passi (spec e piano del 19 luglio): è in produzione o è rimasto il solo link via email?
4. DA VERIFICARE — Nome ufficiale: "Fund Radar" o "QYROS Bandi Monitor"? Il repo e i pacchetti usano ancora il secondo.
5. DA VERIFICARE — `supabase-audit.md`: va committato, spostato in `docs/` o lasciato fuori?
6. DA VERIFICARE — `supabase/.temp/` e `.claude/` non sono in `.gitignore`; `.claude/worktrees/fase6b-pannello-dashboard` è un residuo non registrato come worktree git: si può eliminare?
7. DA VERIFICARE — Lo schema reale su Supabase coincide con `supabase/schema.sql`? Non esistono file di migrazione.
8. DA VERIFICARE — Le Edge Function pubblicate coincidono con il codice in `supabase/functions/`?
