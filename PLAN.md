# Piano

Ordine e priorità proposti da Claude: DA VERIFICARE con Luca.

## Obiettivo

Tenere Fund Radar affidabile e allineato allo stato reale, prima di aggiungere nuove funzioni.

## Prossimi passi

- [ ] Verificare che il job giornaliero giri ancora regolarmente (DA VERIFICARE)
- [ ] Allineare i README di `scraper/` e `dashboard/` allo stato reale
- [ ] Correggere i 9 avvisi RLS `auth_rls_initplan` (usare `(select auth.jwt())`)
- [ ] Decidere il destino di `supabase-audit.md` e aggiungere `supabase/.temp/` a `.gitignore`
- [ ] Attivare l'ottava fonte (`slot-personalizzato`) — DA VERIFICARE se è ancora voluta
- [ ] Paginazione della lista bandi, solo se il volume cresce
- [ ] Limiti noti degli scraper (Regione Lombardia solo prime 15 pagine, EU Portal solo la prima scadenza dei bandi multi-cutoff) — DA VERIFICARE se vanno affrontati
