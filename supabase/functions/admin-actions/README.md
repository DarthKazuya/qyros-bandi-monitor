# Edge Function `admin-actions`

Gestisce le azioni riservate all'amministratore del pannello di controllo (Fase 6):
creare un accesso approvato, revocarlo, elencare gli utenti autorizzati. Non
richiama mai queste azioni dal browser con la chiave `service_role` — la chiave
resta sempre lato server, dentro questa funzione.

## Azioni supportate

Richiesta `POST` con intestazione `Authorization: Bearer <token della sessione>` e
corpo JSON `{ "azione": "...", ... }`:

- `elenco_utenti` — nessun parametro aggiuntivo. Restituisce `{ utenti: [...] }`.
- `approva_richiesta` — richiede `id` (id della riga in `richieste_accesso`) ed
  `email`. Crea l'utente Supabase Auth e marca la richiesta come approvata.
- `revoca_utente` — richiede `id` (id dell'utente Supabase Auth). Elimina l'utente.

Ogni richiesta viene rifiutata con `403` se il token non corrisponde all'email
`panto75@gmail.com`.

## Pubblicazione (da fare dopo il merge, non automatizzata in questo piano)

```bash
npx supabase functions deploy admin-actions --project-ref atcdtnmwbllvdeikswfk --use-api
```

Non richiede Docker (grazie al flag `--use-api`). Le variabili
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` sono già disponibili automaticamente a
ogni Edge Function del progetto, non vanno configurate a parte.
