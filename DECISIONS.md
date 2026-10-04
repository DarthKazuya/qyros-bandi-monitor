# Decisioni

- **2026-07-16** — Tre servizi gratuiti senza server sempre acceso: GitHub (Actions + Pages), Supabase, Resend — costo zero o quasi.
- **2026-07-16** — Scraper in Node + TypeScript, un modulo per fonte con interfaccia comune e errori isolati — una fonte rotta non ferma le altre.
- **2026-07-16** — Cron orario su GitHub Actions che si autolimita all'ora configurata — l'orario si cambia senza toccare il workflow.
- **2026-07-16** — Parole chiave su due livelli (match diretto / da verificare) — motivo: DA VERIFICARE nella spec.
- **2026-07-17** — Fondazione Cariplo con Playwright non headless sotto xvfb — Cloudflare blocca la modalità headless.
- **2026-07-17** — DbPort come interfaccia con implementazioni supabase/console/fake — test e prove locali senza credenziali né dati reali.
- **2026-07-17** — Dashboard React + Vite + MUI, statica su GitHub Pages, che parla con Supabase dal browser protetta da RLS — nessun backend da mantenere.
- **2026-07-17** — Accesso con link via email, registrazione pubblica disattivata — solo utenti autorizzati.
- **2026-07-19** — Azioni di amministrazione in una Edge Function (`admin-actions`) — la chiave service role non deve stare nel browser.
- **2026-07-19** — Parole chiave e orario spostati da file JSON a tabelle Supabase, con i JSON come ripiego locale — modificabili dal pannello senza codice.
- **2026-07-20** — Palette indaco/teal, Roboto, token Material 3 (Fase 7) — motivo: vedi spec `2026-07-20-palette-font-responsivita-design.md`.
- **2026-07-20** — Rimosso il filtro per priorità "Match diretto"/"Da verificare" dalla dashboard — motivo: DA VERIFICARE.
- **2026-10-04** — Fund Radar sospeso; il progetto Supabase "Qyros BANDI" verrà eliminato. Backup verificato in `~/Backups/Qyros-BANDI-2026-10-04/fund-radar/`, fuori da Dropbox — motivo della sospensione: DA VERIFICARE.
- **2026-10-04** — Backup fatto con `pg_dump` dello schema `public` più elenco utenti senza hash, non con una copia dell'intero database — bastano a ripartire su un progetto nuovo; password e chiavi si rigenerano.

Date ricavate dalla storia git e dalle spec; le scelte precedenti a oggi sono ricostruite, non registrate al momento.
