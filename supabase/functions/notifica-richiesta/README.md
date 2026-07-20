# Edge Function `notifica-richiesta`

Manda un'email all'amministratore (`panto75@gmail.com`) ogni volta che nasce
una riga nuova in `richieste_accesso`. Non viene mai chiamata direttamente
dal sito: parte da un **Database Webhook** di Supabase (Database → Webhooks),
che avvisa questa funzione a ogni INSERT sulla tabella, autenticato con la
chiave di servizio — nessun endpoint pubblico da proteggere.

## Segreto necessario

`RESEND_API_KEY` — un'API key di Resend con permesso "Sending access",
configurata come segreto di questa funzione (Edge Functions → Secrets su
Supabase), separata da quella usata per l'SMTP di Supabase Auth.

## Pubblicazione

```bash
npx supabase functions deploy notifica-richiesta --project-ref atcdtnmwbllvdeikswfk --use-api
```

Non richiede Docker (grazie al flag `--use-api`).

## Configurazione del Database Webhook (manuale, una tantum)

1. Supabase Dashboard → Database → Webhooks → Create a new webhook.
2. Tabella: `richieste_accesso`. Evento: `INSERT`.
3. Tipo: HTTP Request, verso l'URL di questa funzione
   (`https://atcdtnmwbllvdeikswfk.supabase.co/functions/v1/notifica-richiesta`).
4. Autenticazione: includere l'header `Authorization: Bearer <service_role key>`
   (l'interfaccia di Supabase offre un'opzione dedicata per farlo senza
   scrivere la chiave a mano).
