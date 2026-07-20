# Dettagli pannello admin: orario richieste, nomi utenti, amministratore in cima (Fase 6d)

## Contesto

Dopo aver messo in produzione il flusso di accesso con link+codice (Fase 6c),
l'amministratore, usando il pannello riservato per la prima volta con dati
reali, ha notato tre lacune: la data delle richieste non mostra l'orario
esatto, la lista "Utenti autorizzati" mostra solo l'email (nessun modo di
sapere chi sia una persona), e l'amministratore stesso non si distingue dagli
altri utenti nella lista.

## Fuori scope (deciso esplicitamente durante il brainstorming)

- **Amministratori multipli / sistema di ruoli**: valutato e scartato — resta
  un solo amministratore (`panto75@gmail.com`, hardcoded), come nelle fasi
  precedenti. "(ADMIN)" è testo semplice, non un sistema di permessi.
- **Sessione che scade da sola per gli utenti non amministratori**: valutato
  e scartato. Il comportamento attuale (`persistSession` di default nel
  client Supabase, che usa `localStorage`) già tiene collegato *chiunque*
  fino al logout manuale — l'amministratore incluso. Nessuna modifica: non
  esiste oggi un problema da correggere qui.
- **Recupero nome/cognome per utenti già approvati prima di questa fase**
  (nel momento in cui è stato scritto questo documento, l'unico caso reale è
  un utente di test che l'amministratore eliminerà comunque): scartato,
  mostreranno solo l'email finché non vengono ri-approvati o gestiti a mano.
  Eccezione: l'amministratore stesso, per cui nome/cognome sono stati
  aggiunti una tantum via SQL diretto (vedi "Migrazione dati" più sotto) dato
  che è un solo record e non richiede un meccanismo riutilizzabile.

## Orario nelle richieste

`RichiesteInAttesa.tsx`, funzione `formattaData`: il formato passa da solo
data (`20/07/2026`) a data e ora completa di secondi (`20/07/2026, 09:16:03`).
Nessuna modifica allo schema: `richiesto_il` è già un `timestamptz` completo,
solo la formattazione in interfaccia cambiava.

## Nome e cognome per gli utenti autorizzati

**Dove vivono i dati**: oggi nome/cognome esistono solo nella riga di
`richieste_accesso` che ha originato l'approvazione — una volta creato
l'utente Supabase Auth, quel collegamento si perde (l'account non porta con
sé quell'informazione). La soluzione è salvarli **sull'account stesso**, nel
momento dell'approvazione, usando `user_metadata` di Supabase Auth (un campo
libero già supportato nativamente, pensato esattamente per questo tipo di
dato).

**Modifiche**:
- `RichiesteInAttesa.tsx`, funzione `approva`: la chiamata a
  `chiamaAdminActions('approva_richiesta', ...)` include ora anche `nome` e
  `cognome` (già disponibili sull'oggetto richiesta), non solo `id` ed
  `email`.
- Edge Function `admin-actions`, azione `approva_richiesta`: legge `nome` e
  `cognome` dal corpo della richiesta e li passa a
  `inviteUserByEmail(email, { redirectTo, data: { nome, cognome } })` — il
  parametro `data` è quello che Supabase scrive in `user_metadata`.
- Edge Function `admin-actions`, azione `elenco_utenti`: oltre a `id` ed
  `email`, restituisce anche `nome` e `cognome` letti da
  `user.user_metadata` (assenti/`undefined` per un utente senza questi dati,
  gestito lato interfaccia — vedi sotto).

## Lista "Utenti autorizzati"

- Ogni riga mostra "Nome Cognome" come testo principale ed email come
  sottotitolo più piccolo (stesso stile già usato in "Richieste in attesa");
  se nome/cognome non sono disponibili, resta visibile la sola email (come
  oggi), senza riga vuota.
- L'amministratore compare **sempre per primo** nella lista, indipendentemente
  dall'ordine restituito da Supabase; gli altri utenti mantengono l'ordine
  attuale.
- Il testo **" (ADMIN)"** viene aggiunto subito dopo il testo principale
  della riga dell'amministratore (dopo "Luca Panto", visto che ora ha
  nome/cognome salvati — vedi "Migrazione dati").

## Migrazione dati (già eseguita)

L'amministratore precede questa fase, quindi il suo account non ha
nome/cognome in `user_metadata` come li avranno i futuri utenti approvati.
Essendo un solo record, corretto direttamente con una query SQL una tantum
(non con un meccanismo di approvazione riutilizzabile) — eseguita e
verificata il 2026-07-20, tracciata in `supabase/schema.sql`:

```sql
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"nome":"Luca","cognome":"Panto"}'::jsonb
where email = 'panto75@gmail.com';
```

Merge additivo (`||`) apposta per non toccare le altre chiavi già presenti su
quel record (`sub`, `email_verified`, ecc.).

## Cosa non cambia

- Schema e RLS di `richieste_accesso`: invariati.
- `revoca_utente`: invariata (continua a operare per `id`).
- Persistenza della sessione lato client (`dashboard/src/lib/supabase.ts`):
  invariata, nessuna modifica necessaria.

## Test e verifica

Stessa disciplina delle fasi precedenti: test automatici per la nuova
formattazione data/ora e per l'ordinamento/etichetta dell'amministratore in
`UtentiAutorizzati.tsx` (mockando una lista che include e non include
l'email amministratore, in posizioni diverse). La modifica alla Edge
Function, non testabile nella suite automatica della dashboard, viene
verificata con un'approvazione reale dopo il deploy (stesso tipo di verifica
live già fatta nelle fasi precedenti).
