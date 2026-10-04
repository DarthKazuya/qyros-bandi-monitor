# Piano

Ordine e priorità proposti da Claude: DA VERIFICARE con Luca.

## Obiettivo

Tenere Fund Radar affidabile e allineato allo stato reale, prima di aggiungere nuove funzioni.

## Prossimi passi

- [ ] Riattivare il workflow `daily-job.yml` (disattivato da GitHub il 18 settembre 2026) e impedire che si ridisattivi dopo 60 giorni senza commit
- [ ] Far sì che il job non perda il giorno quando GitHub salta l'esecuzione dell'ora configurata (oggi: 25 giorni utili su 64)
- [ ] Sistemare `incentivi-gov` e `europa-creativa-media`: da GitHub Actions vanno sempre in timeout
- [ ] Portare in `supabase/schema.sql` il trigger `notifica-nuova-richiesta` e revocare TRUNCATE, REFERENCES e TRIGGER ad `anon` e `authenticated`
- [ ] Allineare i README di `scraper/` e `dashboard/` allo stato reale
- [ ] Correggere i 9 avvisi RLS `auth_rls_initplan` (usare `(select auth.jwt())`)
- [ ] Decidere il destino di `supabase-audit.md` e aggiungere `supabase/.temp/` a `.gitignore`
- [ ] Attivare l'ottava fonte (`slot-personalizzato`) — DA VERIFICARE se è ancora voluta
- [ ] Paginazione della lista bandi, solo se il volume cresce
- [ ] Limiti noti degli scraper (Regione Lombardia solo prime 15 pagine, EU Portal solo la prima scadenza dei bandi multi-cutoff) — DA VERIFICARE se vanno affrontati
