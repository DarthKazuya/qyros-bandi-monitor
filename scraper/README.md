# Fund Radar — scraper

## Comandi disponibili

- `npm install` — installa le dipendenze
- `npm test` — esegue tutti i test automatici (nessuna chiamata di rete reale)
- `npm run typecheck` — verifica i tipi TypeScript
- `npx tsx src/index.ts` — esegue la pipeline reale (solo se e l'ora configurata in `config/schedule.json`)
- `npx tsx src/index.ts --force` — esegue la pipeline reale ignorando l'orario configurato (utile per test manuali)
- `npx tsx src/dev/dry-run-eit.ts` — esegue solo lo scraper EIT contro il sito reale e stampa i risultati

## Stato Fase 2

7 fonti su 8 attive e verificate contro dati reali: EIT, EU Funding & Tenders Portal
(API SEDIA), incentivi.gov.it (endpoint Solr), Invitalia, Bandi e Servizi Regione
Lombardia, Europa Creativa MEDIA, Fondazione Cariplo (unica fonte che richiede un
browser headless via Playwright, per via di una protezione Cloudflare).

L'ottavo slot (`slot-personalizzato` in `config/sources.json`) resta disattivato,
pronto per una fonte futura da configurare senza toccare il codice esistente.

Il salvataggio su database e l'invio email non sono ancora collegati a servizi reali
(la pipeline usa una implementazione "console" del DbPort a scopo dimostrativo). Il vero
adattatore Supabase e l'invio email via Resend arrivano in Fase 3, quando gli account
saranno stati creati.

### Limiti noti

- **Regione Lombardia**: vengono lette solo le prime 15 pagine dell'elenco (~90 bandi
  più recenti), non l'intero catalogo storico (centinaia di pagine).
- **EU Portal**: per i bandi con più scadenze (multi-cutoff) viene usata solo la prima.
- **Tetti di volume per chiamata**: EU Portal richiede fino a 1000 risultati per
  chiamata, incentivi.gov.it fino a 8000, Fondazione Cariplo fino a 100 — tutti
  ampiamente sopra i volumi reali osservati oggi (rispettivamente ~751, ~5671 prima del
  filtro, 33), quindi nessuna perdita di dati al momento. Se una di queste fonti
  crescesse molto oltre questi numeri in futuro, andrebbe aggiunta la paginazione.
- **Fondazione Cariplo**: usa un browser reale in modalità "normale" (non headless) —
  necessario perché Cloudflare blocca specificamente la modalità headless su questo
  sito. In Fase 3, l'esecuzione su GitHub Actions richiederà un display virtuale
  (es. `xvfb-run`), da configurare nel workflow. Aggiunge inoltre qualche minuto al
  job giornaliero per via della navigazione reale pagina per pagina.
- **Primo avvio**: la prima esecuzione con tutte e 7 le fonti attive ha trovato 845
  bandi "nuovi" (perché nel database non c'era ancora nulla con cui confrontarli),
  soprattutto grazie al volume di EU Portal e incentivi.gov.it e alle parole chiave di
  Livello 2 volutamente ampie (tecnologia, innovazione, AI, startup). Le esecuzioni
  successive troveranno solo le variazioni reali giorno per giorno, ma la primissima
  email/dashboard dopo il deploy conterrà un numero elevato di voci "Da verificare" da
  scremare manualmente — previsto, non un errore.

## Comandi disponibili aggiuntivi

- `npx tsx src/dev/dry-run-<fonte>.ts` — esegue un singolo scraper contro il sito/API
  reale e stampa i risultati (es. `dry-run-eit.ts`, `dry-run-eu-portal.ts`,
  `dry-run-incentivi-gov.ts`, `dry-run-invitalia.ts`, `dry-run-regione-lombardia.ts`,
  `dry-run-europa-creativa-media.ts`, `dry-run-fondazione-cariplo.ts`).

## Stato Fase 3a

Adattatore Supabase e invio email via Resend scritti e testati con dati finti
(nessuna credenziale reale usata nei test automatici). `scraper/src/index.ts`
seleziona automaticamente l'implementazione reale quando le variabili
d'ambiente `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` e
`RESEND_API_KEY`/`NOTIFICATION_EMAIL` sono presenti, altrimenti continua a
usare il DbPort console (nessun salvataggio reale, nessuna email) — verificato
che questo comportamento di fallback funziona esattamente come nelle fasi
precedenti (esecuzione reale completa: 847 bandi rilevanti trovati su 7/7
fonti, nessuna email inviata per assenza delle credenziali).

Il repository è ora ospitato su GitHub
(`https://github.com/DarthKazuya/qyros-bandi-monitor`) e i quattro segreti
del job (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
`NOTIFICATION_EMAIL`) sono già configurati nelle GitHub Secrets del
repository. Resta da fare, prima che il job giornaliero funzioni per davvero:

1. Eseguire una volta `supabase/schema.sql` nell'SQL Editor del progetto
   Supabase reale (crea le tabelle `bandi` e `job_run_log`).
2. Avviare manualmente il workflow `.github/workflows/daily-job.yml` da
   GitHub (tab "Actions" → "Job giornaliero bandi" → "Run workflow") e
   verificare che vada a buon fine: righe scritte su Supabase, email
   effettivamente ricevuta.

Localmente, senza le variabili d'ambiente reali impostate, `npx tsx
src/index.ts --force` continua a funzionare esattamente come nelle fasi
precedenti — utile per continuare a testare in locale senza toccare i dati
reali.
