# Pannello di controllo riservato (Fase 6)

## Contesto

Fund Radar è oggi un sito statico (dashboard) più un job giornaliero (scraper), con
un solo utente autorizzato (`panto75@gmail.com`), registrazione pubblica disattivata.
L'utente vuole poter autorizzare altre persone in modo controllato, e avere un
pannello riservato, visibile solo a lui, per gestire questo e altri aspetti operativi
del progetto senza dover intervenire su GitHub o Supabase direttamente.

Vincolo guida invariato: costo zero/quasi-zero, nessun server da mantenere in prima
persona.

## Fuori scope (deciso esplicitamente in questa sessione)

- **Aggiungere/rimuovere fonti dal pannello**: scartato dall'utente. Una fonte nuova
  richiede comunque codice di scraping scritto ad hoc per quel sito; il pannello non
  automatizza questo. Restano gestite solo via `config/sources.json` su GitHub, come
  oggi.

## Architettura

Le operazioni di questa fase si dividono in due categorie:

1. **Operazioni "delicate"** (creare un accesso, revocarlo, elencare gli utenti
   autorizzati) — richiedono la chiave `service_role` di Supabase, che non può mai
   raggiungere il browser. Gestite da una nuova **Supabase Edge Function** (una
   funzione ospitata gratuitamente da Supabase stesso, nessun server da gestire),
   chiamata dalla dashboard solo quando l'utente collegato è l'amministratore.
   Alternative scartate: trigger via GitHub Actions (latenza di decine di secondi,
   comunque richiede di esporre un'altra chiave delicata), server dedicato
   (reintroduce un costo/manutenzione che il progetto ha sempre evitato).
2. **Operazioni "normali"** (leggere lo storico esecuzioni, leggere/modificare
   parole chiave e orario) — restano lettura/scrittura dirette dal browser con la
   chiave pubblica `anon`, protette da Row Level Security (RLS) a livello di
   database, con policy ristrette specificamente all'email dell'amministratore (non
   semplicemente "utente autenticato qualsiasi", per impedire che un futuro utente
   autorizzato per i bandi possa vedere o toccare queste tabelle).

**Identità dell'amministratore**: l'unico amministratore è l'email
`panto75@gmail.com`, fissata nel codice (sia lato Edge Function sia nelle policy RLS
sia nel controllo che mostra/nasconde il link "Pannello" nella dashboard). Non è
previsto un sistema di ruoli più generale in questa fase — un solo amministratore,
per disegno.

## Schema database (nuove tabelle)

**`richieste_accesso`**

| campo | tipo | note |
|---|---|---|
| id | uuid, PK | |
| email | text | |
| nome | text | |
| cognome | text | |
| richiesto_il | timestamptz | default `now()` |
| stato | text | `'in_attesa'` \| `'approvata'` \| `'rifiutata'`, default `'in_attesa'` |

RLS: inserimento consentito a chiunque (anche non autenticato — è così che arriva una
richiesta da chi non ha ancora accesso), lettura e modifica riservate
all'amministratore.

**`parole_chiave`**

| campo | tipo | note |
|---|---|---|
| id | uuid, PK | |
| parola | text | |
| livello | text | `'livello1'` \| `'livello2'` |

Sostituisce `config/keywords.json` come fonte di verità per lo scraper. Una riga per
parola chiave, per poter aggiungere/rimuovere singolarmente dal pannello.

RLS: lettura e modifica riservate all'amministratore (lo scraper legge con
`service_role`, che bypassa sempre RLS, come già oggi per le altre tabelle).

**`impostazioni_job`**

| campo | tipo | note |
|---|---|---|
| id | int, PK | sempre `1` — riga singola |
| ora | int | 0-23 |
| fuso_orario | text | fisso a `'Europe/Rome'`, non modificabile dal pannello in questa fase |

Sostituisce `config/schedule.json`. Riga singola perché esiste un solo orario di
esecuzione.

RLS: lettura e modifica riservate all'amministratore.

**`job_run_log`** (tabella esistente dalla Fase 3, nessuna modifica di struttura)

Aggiunta necessaria: oggi questa tabella ha solo la grant per `service_role` (scritta
dal job). Serve aggiungere una policy RLS di sola lettura per l'amministratore, più
la grant `select` corrispondente per il ruolo `authenticated` — lo stesso tipo di
correzione già incontrata due volte in questo progetto (RLS da sola non basta senza
una grant esplicita sulla tabella).

`config/keywords.json` e `config/schedule.json` restano nel repository come ripiego
per i test in locale senza credenziali Supabase reali (dettagli nella sezione
"Modifiche allo scraper" più sotto) — Supabase diventa la fonte di verità in
produzione, i file restano la fonte di verità quando le credenziali reali non ci
sono.

## Flusso di richiesta accesso

La schermata di login esistente guadagna due campi facoltativi diventati obbligatori
in questo flusso: **Nome** e **Cognome**, oltre all'email già presente.

Al invio del modulo:

1. Si prova `signInWithOtp` come oggi.
2. Se l'email corrisponde a un utente già autorizzato (compreso l'amministratore),
   comportamento invariato: arriva il link di accesso via email.
3. Se l'email non è autorizzata, invece di mostrare l'errore grezzo di Supabase, si
   salva una riga in `richieste_accesso` (email, nome, cognome) e si mostra un
   messaggio di conferma tipo "Richiesta inviata, verrà valutata a breve" — nessuna
   email viene inviata in questo caso (l'invio avviene solo quando l'amministratore
   approva, vedi sotto).

Nessun controllo di duplicati: se la stessa email invia più richieste (anche dopo un
rifiuto), ognuna crea una nuova riga in `richieste_accesso` — l'amministratore le
vede tutte nel pannello e decide caso per caso. Scelta deliberata per restare
semplice: con un solo amministratore che valuta manualmente, non serve una logica di
deduplica automatica in questa fase.

## Pannello riservato

Nuovo link "Pannello" nell'intestazione dell'app, visibile solo quando l'utente
collegato ha l'email dell'amministratore (controllo sia in interfaccia sia — per le
tabelle coinvolte — a livello di RLS, quindi nessun altro utente autorizzato potrebbe
vederne i dati anche aggirando l'interfaccia).

Quattro sezioni:

- **Richieste in attesa**: elenco (nome, cognome, email, data richiesta) con
  pulsanti Approva/Rifiuta per ciascuna.
  - *Approva* chiama la Edge Function, che crea davvero l'utente Supabase Auth per
    quell'email (l'utente riceverà un link di accesso reale al primo login
    successivo) e aggiorna `stato` a `'approvata'`.
  - *Rifiuta* aggiorna `stato` a `'rifiutata'` (la riga resta, non viene
    cancellata, per tua memoria storica) — questa singola azione non tocca dati
    delicati, può restare una scrittura diretta con RLS (l'amministratore ha già
    permesso di modifica su questa tabella).
- **Utenti autorizzati**: elenco email (ottenuto dalla Edge Function, che sola può
  interrogare l'elenco reale degli utenti Supabase Auth) con un pulsante "Revoca"
  per ciascuno — la Edge Function elimina l'utente Supabase Auth corrispondente,
  che perde immediatamente l'accesso.
- **Storico esecuzioni**: tabella di sola lettura da `job_run_log` — data/ora,
  fonti riuscite, fonti fallite, numero di nuovi bandi trovati, ordinata dalla più
  recente.
- **Configurazione**: due sotto-sezioni, entrambe lettura/scrittura dirette (nessuna
  Edge Function necessaria, dato pubblico/non sensibile):
  - *Parole chiave*: le parole di `livello1` e `livello2`, ciascuna con un pulsante
    per rimuoverla, più un modulo per aggiungerne una nuova al livello scelto.
  - *Orario*: un campo numerico per l'ora di esecuzione (0-23), con un pulsante
    salva.

## Logout

Un pulsante "Esci" nell'intestazione dell'app (visibile per ogni utente collegato,
non solo l'amministratore), che chiama `supabase.auth.signOut()` e riporta alla
schermata di login.

## Edge Function

Una singola funzione, `admin-actions`, che riceve richieste POST autenticate (il
client Supabase allega automaticamente il token della sessione corrente). Prima
istruzione della funzione: verifica che l'email nel token corrisponda esattamente
all'amministratore — altrimenti risponde `403` senza eseguire nulla. Usa la chiave
`service_role` (configurata come segreto della funzione stessa in Supabase, mai nel
codice del sito) per le operazioni sull'Admin API di Supabase Auth.

Azioni supportate (un parametro `azione` nel corpo della richiesta):

- `approva_richiesta` — crea l'utente Auth per l'email indicata, aggiorna la
  richiesta a `'approvata'`.
- `elenco_utenti` — restituisce l'elenco degli utenti Auth esistenti.
- `revoca_utente` — elimina l'utente Auth indicato.

## Modifiche allo scraper

`scraper/src/lib/config.ts` — `caricaKeywords()` e `caricaSchedule()` interrogano
Supabase (client già creato con `creaClienteSupabaseReale()`, già usato altrove nello
scraper con la stessa chiave `service_role`), leggendo rispettivamente da
`parole_chiave` e da `impostazioni_job`, quando le credenziali Supabase sono
disponibili — lo stesso identico requisito già esistente oggi per il salvataggio dei
bandi.

**Comportamento di ripiego invariato**: quando `SUPABASE_URL`/
`SUPABASE_SERVICE_ROLE_KEY` non sono impostate (test locali senza credenziali reali,
comportamento esplicitamente documentato e già in uso da questo progetto sin dalla
Fase 3), `caricaKeywords()` e `caricaSchedule()` continuano a leggere
`config/keywords.json` e `config/schedule.json` esattamente come oggi — nessuna
regressione sulla possibilità di testare l'intera pipeline in locale senza toccare
dati reali. I due file restano quindi nel repository con un ruolo reale (fallback di
sviluppo), non solo come traccia storica.

`caricaSources()` resta invariata (legge ancora `config/sources.json` sempre, in
ogni caso — fuori scope in questa fase).

## Migrazione dei dati esistenti

Le parole chiave e l'orario attualmente in `config/keywords.json` e
`config/schedule.json` vanno copiati una sola volta nelle nuove tabelle, come parte
del task che crea lo schema — non è un passaggio manuale lasciato all'utente.

## Test e verifica

Stessa disciplina delle fasi precedenti: test automatici per ogni nuova funzione di
libreria e componente (incluse le nuove tabelle mockate, nessuna chiamata di rete
reale nella suite automatica), revisione a due stadi per singolo task, doppia
verifica finale sull'insieme del lavoro. La Edge Function, essendo codice che gira
sui server di Supabase e non nel browser, verrà verificata con una chiamata reale
dopo il deploy (non è testabile nella suite automatica della dashboard) — passaggio
equivalente alle verifiche live già fatte per lo scraper e per la dashboard nelle
fasi precedenti.
