# Accesso con link+codice e richiesta a due passi (Fase 6c)

## Contesto

La Fase 6 (vedi [2026-07-19-pannello-controllo-design.md](2026-07-19-pannello-controllo-design.md))
ha introdotto il flusso di richiesta/approvazione accesso. Nell'uso reale, appena
dopo il deploy, sono emersi due problemi concreti:

1. **Nessuna email all'approvazione.** La Edge Function `admin-actions`, azione
   `approva_richiesta`, creava l'utente Supabase Auth con `admin.createUser()` —
   che crea l'account ma non invia nulla. Il pannello prometteva però "riceverai
   un'email quando sarà approvata". **Già corretto e pubblicato** (fuori dello
   scope di questo documento): la Edge Function ora usa `admin.inviteUserByEmail()`,
   che invia davvero l'email di invito.
2. **Il link di accesso, cliccato, non fa entrare.** Riprodotto e confermato nei
   log di Supabase Auth (progetto `atcdtnmwbllvdeikswfk`, servizio `auth`): due
   chiamate a `/verify` con lo stesso token, a 11 secondi di distanza — la prima
   riuscita (sessione creata), la seconda fallita con `"One-time token not found"`
   → `"403: Email link is invalid or has expired"`. Il link è quindi stato
   "consumato" due volte prima che l'utente reale se ne accorgesse: il sospetto
   principale è la scansione automatica dei link in arrivo che fanno alcuni client
   di posta (Gmail in testa) per verificarne la sicurezza, ma la causa esatta del
   doppio consumo non è verificabile con certezza dai soli log. In ogni caso la
   soluzione (vedi sotto) copre entrambi gli scenari.

Questo documento disegna la correzione strutturale: un secondo modo di completare
l'accesso (un codice a 6 cifre da digitare, oltre al link da cliccare) e una
revisione del modulo di accesso per chiedere nome/cognome solo quando serve
davvero.

## Fuori scope (deciso esplicitamente in questa sessione)

- **Sistema di codici "nostro"**, generato e inviato via Resend invece che tramite
  Supabase Auth: scartato. Richiederebbe una tabella nuova, gestione di scadenze e
  sicurezza scritta da zero, per ottenere lo stesso risultato che Supabase offre
  già. Più superficie da mantenere per nessun beneficio reale.
- **Restare solo col link**, limitandosi ad avvisare l'utente di cliccarlo una
  volta sola: scartato — non risolve il problema riprodotto nei log, che può
  ripresentarsi indipendentemente da quante volte l'utente clicca.
- **Percorso separato per l'amministratore** (link senza codice): valutato e
  scartato durante il brainstorming — vedi sezione "Amministratore" più sotto.
  L'amministratore riceve la stessa email con link+codice di chiunque altro.
- Nessuna modifica alla logica della Edge Function `admin-actions`, allo schema di
  `richieste_accesso`, alle policy RLS esistenti, o al meccanismo di
  revoca/elenco utenti: tutto già a posto dalla Fase 6.

## Architettura

Supabase genera già, per ogni richiesta di accesso via email (`signInWithOtp` per
un utente esistente, `inviteUserByEmail` per un nuovo utente appena approvato), sia
un link di conferma (`{{ .ConfirmationURL }}`) sia un codice numerico a 6 cifre
collegato allo stesso "biglietto" (`{{ .Token }}`) — variabili disponibili in
entrambi i template email coinvolti (confermato nella documentazione ufficiale:
`docs/reference/javascript/auth-signinwithotp`, guida "Customizing email
templates"). Oggi i template mostrano solo il link. Tutta l'implementazione si
riduce quindi a:

1. Modificare, sul pannello di Supabase (Authentication → Email Templates), i
   template **Magic Link** e **Invite** per includere anche `{{ .Token }}` nel
   testo, accanto al link esistente. Passaggio manuale via browser (nessuno
   strumento automatico lo copre), da fare guidando l'utente passo passo, come già
   fatto per il deploy della Edge Function.
2. Aggiungere lato dashboard un campo per digitare il codice e completare
   l'accesso con `supabase.auth.verifyOtp({ email, token, type: 'email' })` (per
   utenti già autorizzati/rientri) o `type: 'invite'` (per un primo accesso appena
   approvato) — il valore esatto di `type` per il caso invito va confermato contro
   i tipi della versione installata di `@supabase/supabase-js` (`^2.47.10`) in
   fase di implementazione.

**Nessuna nuova tabella, nessuna nuova Edge Function, nessun nuovo segreto.**

**Vincolo tecnico da comunicare in interfaccia**: link e codice condividono lo
stesso token una tantum — usarne uno invalida l'altro, esattamente come un
biglietto che si può obliterare al tornello oppure comunicare a voce il suo
numero, ma non entrambi. Non è un bug, è la ragione stessa per cui il codice
risolve il problema: un numero scritto in un'email non può essere "cliccato in
anticipo" da una scansione automatica, mentre un link sì.

## Modulo di accesso (sostituisce la sezione "Flusso di richiesta accesso" del
documento Fase 6)

Il modulo diventa **a due passi** invece dei tre campi sempre visibili insieme:

**Passo 1 — solo email.** Campo "Email" + pulsante "Accedi". Al invio, si prova
`signInWithOtp({ email })` come oggi.

- Se **non** ritorna l'errore `signup_disabled` → l'email è già autorizzata
  (utente ordinario già approvato, o l'amministratore): l'email con link+codice è
  partita, si passa direttamente al riquadro "Inserisci il codice" (vedi sotto).
  **Nessun campo nome/cognome viene mai richiesto in questo caso.**
- Se ritorna `signup_disabled` → email non ancora autorizzata: il modulo si
  espande mostrando **Nome** e **Cognome** (Passo 2), il pulsante diventa
  "Richiedi accesso". Al invio si salva la riga in `richieste_accesso` come già
  oggi — nessuna email parte finché l'amministratore non approva dal pannello.

Questo sostituisce l'impostazione precedente (nome/cognome/email sempre tutti
visibili e obbligatori insieme), riducendo l'attrito per chi accede una seconda o
terza volta.

## Riquadro "Inserisci il codice"

Compare ogni volta che un'email di accesso è stata inviata con successo (sia per
un utente di ritorno, sia subito dopo l'approvazione di una richiesta nuova).
Contiene:

- il messaggio di conferma già esistente ("Ti abbiamo inviato un link di accesso
  a ..."), con l'aggiunta "...oppure inserisci qui sotto il codice a 6 cifre che
  trovi nella stessa email";
- un campo numerico, pensato per il cellulare: tastierino numerico automatico
  (`inputMode="numeric"`, `pattern="[0-9]*"`), dimensione del testo e altezza
  minima allineate agli standard già in uso nel resto della dashboard (44px di
  altezza minima, stesso valore già usato su tutti i pulsanti esistenti);
- un pulsante "Verifica codice".

Se il codice è sbagliato o scaduto, un messaggio d'errore chiaro invita a
richiederne uno nuovo tornando al Passo 1 (nessun conteggio tentativi lato
interfaccia in questa fase — i limiti di frequenza/scadenza restano quelli
configurati lato Supabase).

## Utente di ritorno (login → logout → nuovo login)

Comportamento invariato rispetto a oggi, solo esteso col codice: un utente già
approvato che esegue il logout e poi torna, ripete solo il Passo 1 (email), non
serve nessuna nuova approvazione dell'amministratore — è lo stesso identico
percorso "email già autorizzata" descritto sopra.

## Amministratore

Nessuna corsia preferenziale o campo nascosto: l'amministratore
(`panto75@gmail.com`) è, ai fini di questo modulo, un utente già approvato come
un altro, e riceve la stessa email con link+codice di chiunque altro. Può
continuare a usare il link con un click come ha sempre fatto; il codice resta lì
come alternativa pronta all'uso se il link dovesse fallire di nuovo (è esattamente
il problema riprodotto nei log che ha dato origine a questo documento). Scartare
il codice per l'amministratore avrebbe lasciato proprio lui esposto al problema
che questa fase vuole risolvere.

## Cosa non cambia

- La Edge Function `admin-actions` (azioni `approva_richiesta`, `elenco_utenti`,
  `revoca_utente`) resta esattamente come corretta nella sessione precedente.
- Lo schema e le policy RLS di `richieste_accesso` restano quelle della Fase 6.
- Il pannello riservato (Richieste, Utenti autorizzati, Storico, Configurazione)
  non è toccato da questo lavoro.

## Test e verifica

Stessa disciplina delle fasi precedenti: test automatici per il modulo a due
passi (email-only → login diretto vs. espansione nome/cognome) e per la verifica
del codice (mockando `supabase.auth.verifyOtp`), nessuna chiamata di rete reale
nella suite automatica. La modifica ai template email, essendo configurazione
lato Supabase e non codice della dashboard, viene verificata con un accesso reale
dopo la pubblicazione (stesso tipo di verifica live già fatta per la Edge
Function `admin-actions`).
