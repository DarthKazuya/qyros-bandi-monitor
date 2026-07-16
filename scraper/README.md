# QYROS Bandi Monitor — scraper

## Comandi disponibili

- `npm install` — installa le dipendenze
- `npm test` — esegue tutti i test automatici (nessuna chiamata di rete reale)
- `npm run typecheck` — verifica i tipi TypeScript
- `npx tsx src/index.ts` — esegue la pipeline reale (solo se e l'ora configurata in `config/schedule.json`)
- `npx tsx src/index.ts --force` — esegue la pipeline reale ignorando l'orario configurato (utile per test manuali)
- `npx tsx src/dev/dry-run-eit.ts` — esegue solo lo scraper EIT contro il sito reale e stampa i risultati

## Stato Fase 1

Fondamenta complete: tipi condivisi, motore di matching a due livelli, hash contenuto,
gestione orario Europe/Rome, deduplica, orchestratore con isolamento errori per fonte,
primo scraper reale (EIT) verificato contro il sito live.

Il salvataggio su database e l'invio email non sono ancora collegati a servizi reali
(Fase 1 usa una implementazione "console" del DbPort a scopo dimostrativo). Il vero
adattatore Supabase e l'invio email via Resend arrivano in Fase 3, quando gli account
saranno stati creati.

Le restanti 7 fonti (EU Portal, Europa Creativa MEDIA, incentivi.gov.it, Invitalia,
Regione Lombardia, Fondazione Cariplo, e l'ottavo slot personalizzabile) vengono
implementate una alla volta in Fase 2, seguendo lo stesso pattern di `src/sources/eit.ts`.
