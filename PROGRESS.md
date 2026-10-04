# Progress

Aggiornato: domenica 4 ottobre 2026.

## PROGETTO SOSPESO — 4 ottobre 2026

- Fund Radar è sospeso e il progetto Supabase "Qyros BANDI" (ref `atcdtnmwbllvdeikswfk`) verrà eliminato. Motivo: DA VERIFICARE (non indicato da Luca in sessione).
- Backup completo e verificato in `~/Backups/Qyros-BANDI-2026-10-04/fund-radar/` (fuori da Dropbox, 2,2 MB). Il `README.md` lì dentro spiega contenuto, ripristino e passi per ripartire.
- Verifica passata: righe uguali tra Supabase, dump e ripristino in un Postgres locale temporaneo (bandi 327, job_run_log 25, parole_chiave 18, richieste_accesso 7, suggerimenti_parole_chiave 3, impostazioni_job 1; auth.users 4 salvati come elenco), e impronte del contenuto coincidenti.
- Ancora da fare prima di eliminare Supabase: screenshot del pannello (Auth, SMTP, modelli email, webhook, elenco segreti) nella cartella `screenshot/` del backup.
- Dopo l'eliminazione di Supabase la dashboard su GitHub Pages non funzionerà più. Il workflow `deploy-dashboard.yml` è stato disattivato a mano il 4 ottobre 2026 e il job giornaliero era già disattivato; il sito resta pubblicato finché non lo si toglie da Settings → Pages.
- Su Supabase non è stato modificato né cancellato nulla.

## Stato attuale

140 commit, il primo il 16 luglio 2026, l'ultimo il 20 luglio 2026. Nessun commit da allora. Ramo `main`.
Il job giornaliero è fermo dal 18 settembre 2026: GitHub ha disattivato il workflow per inattività del repo (verificato il 4 ottobre 2026).

## Cosa funziona

Secondo README e storia git:

- 5 scraper su 8 in produzione (EIT, EU Portal, Invitalia, Regione Lombardia, Fondazione Cariplo); in locale ne risultavano 7.
- Job giornaliero con Supabase e Resend, quando parte (vedi Verificato il 4 ottobre).
- Dashboard pubblicata su https://darthkazuya.github.io/qyros-bandi-monitor/ con login via email, filtri (fonte, parole chiave, ricerca, ordinamento), visto/nuovo, tema chiaro/scuro.
- Pannello admin: richieste di accesso, utenti autorizzati, storico esecuzioni, configurazione parole chiave e orario.
- Suggerimento di parole chiave dagli utenti e contatore dei click per parola chiave.
- Notifica all'admin per nuove richieste di accesso.
- Fase 7: palette indaco/teal, Roboto, responsività mobile.

Audit Supabase del 31 luglio 2026 (`supabase-audit.md`, non tracciato da git): database 12 MB, 267 righe in `bandi`, storage a zero, 0 foreign key, 9 avvisi `auth_rls_initplan`, lista bandi caricata senza paginazione, un tentativo fallito ed estraneo al progetto di creare ruolo/schema `jarvis` sullo stesso progetto Supabase.

## Verificato il 4 ottobre 2026

- Job giornaliero: workflow `daily-job.yml` in stato `disabled_inactivity`; ultima esecuzione 18 settembre 2026. Va riattivato a mano (`gh workflow enable daily-job.yml` o dal tab Actions) e si ridisattiva dopo 60 giorni senza commit.
- Il job ha fatto la scansione vera solo 25 giorni su 64 (17 luglio – 18 settembre). Causa: GitHub salta molte esecuzioni del cron orario (544 partite su circa 1500 attese) e lo scraper lavora solo se parte nell'ora configurata (8, Europe/Rome); se quell'ora salta, il giorno è perso.
- Due fonti falliscono in tutte e 25 le esecuzioni registrate, con `connect ETIMEDOUT`: `incentivi-gov` e `europa-creativa-media`. Da GitHub Actions non sono mai state lette; in locale funzionavano. Ipotesi di Claude, non verificata: i due siti bloccano gli indirizzi IP dei runner GitHub.
- Altri errori sporadici: `regione-lombardia` 3 volte (`Supabase trovaEsistente: Gateway Timeout`), `eu-portal` 1 volta (404).
- Database: 327 righe in `bandi`, 25 in `job_run_log`.
- Schema: tabelle, colonne, vincoli, policy RLS e funzione `increment_click_parola` su Supabase coincidono con `supabase/schema.sql`. Due differenze: il trigger `notifica-nuova-richiesta` su `richieste_accesso` (webhook verso la Edge Function `notifica-richiesta`) esiste nel database ma non in `schema.sql`; i ruoli `anon` e `authenticated` hanno su tutte le tabelle i permessi REFERENCES, TRIGGER e TRUNCATE, non previsti da `schema.sql` (TRUNCATE non passa da RLS; non è raggiungibile dall'API REST, ma conviene revocarlo).
- Edge Function: `admin-actions` (versione 4) e `notifica-richiesta` (versione 2) pubblicate sono identiche al codice in `supabase/functions/`.

## Aperto

1. DA VERIFICARE — I README di `scraper/` e `dashboard/` sono in parte superati: lo scraper dice ancora che database ed email non sono collegati; quello della dashboard cita il filtro per priorità (rimosso il 20 luglio) e "un solo utente autorizzato".
2. DA VERIFICARE — Accesso con codice OTP in due passi (spec e piano del 19 luglio): è in produzione o è rimasto il solo link via email?
3. DA VERIFICARE — Nome ufficiale: "Fund Radar" o "QYROS Bandi Monitor"? Il repo e i pacchetti usano ancora il secondo.
4. DA VERIFICARE — `supabase-audit.md`: va committato, spostato in `docs/` o lasciato fuori?
5. DA VERIFICARE — `supabase/.temp/` e `.claude/` non sono in `.gitignore`; `.claude/worktrees/fase6b-pannello-dashboard` è un residuo non registrato come worktree git: si può eliminare?
