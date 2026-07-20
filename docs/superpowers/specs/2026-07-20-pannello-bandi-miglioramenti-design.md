# Pannello e bandi: notifica richieste, etichette trasparenti, suggerimenti, rifiniture (Fase 6e)

## Contesto

Con il pannello riservato in uso reale (Fase 6d), sono emerse cinque
richieste distinte, tutte a bassa/media complessità e concentrate sulle
stesse due aree del sito (pannello admin, elenco bandi): notifica email
all'amministratore per ogni nuova richiesta di accesso; etichette dei bandi
più trasparenti (mostrare la parola chiave che ha causato la
classificazione, invece di un'etichetta astratta); un modo per chi usa il
sito di proporre nuove parole chiave; un contatore per capire quali parole
chiave restano davvero utili; e alcune rifiniture di interfaccia (tooltip,
pulsante di segnalazione bug).

Vincolo guida invariato dalle fasi precedenti: nessun nuovo server da
mantenere, costo pressoché zero.

## Fuori scope (deciso esplicitamente durante il brainstorming)

- **Parole chiave personali per utente** (ognuno con i propri interessi
  invece di un'unica lista condivisa): idea valida, discussa, ma rimandata
  a un'eventuale fase futura — è un cambiamento architetturale più grande,
  non necessario per risolvere la confusione delle etichette attuali.
- **Aggiornamento palette, font, Material Design 3, responsività
  sistematica**: richiesta separata dello stesso utente, deliberatamente
  tenuta fuori da questo documento — merita un proprio ciclo
  disegno→piano→implementazione (Fase 7), perché tocca l'aspetto visivo di
  tutto il sito insieme, va verificata a video su più dimensioni di
  schermo, e ha domande aperte (Google Sans vs Roboto, necessità di una
  libreria per i toni Material 3) da chiarire a parte.

## A — Notifica email per ogni nuova richiesta di accesso

**Perché non lato client**: se il "segnale" partisse dal sito nel momento
in cui una persona invia il modulo, la funzione che manda l'email dovrebbe
restare raggiungibile pubblicamente da chiunque su internet (chi compila
il modulo non è ancora autenticato), rischiando abusi (chiamate ripetute
per intasare la posta). Usando invece un **Database Webhook** di Supabase —
il database stesso avvisa una funzione ogni volta che nasce una riga nuova
in `richieste_accesso` — non serve nessun endpoint pubblico: il segnale
parte da dentro Supabase, autenticato con la chiave di servizio che
Supabase gestisce da sé.

**Nuova Edge Function `notifica-richiesta`**: riceve il payload del webhook
(`{ type: 'INSERT', table: 'richieste_accesso', record: { email, nome,
cognome, richiesto_il, ... } }`), e manda un'email a `panto75@gmail.com`
via Resend (stesso indirizzo mittente `notifiche@qyros.net` già verificato
per le email di accesso), oggetto "Nuova richiesta di accesso — Fund
Radar", corpo con nome, email, e link alla dashboard.

**Configurazione (guidata, manuale, come le fasi precedenti)**:
1. Nuova API key su Resend, permesso "Sending access".
2. Incollata come segreto (`RESEND_API_KEY`) delle Edge Function su
   Supabase.
3. Un nuovo Database Webhook su Supabase (Database → Webhooks): tabella
   `richieste_accesso`, evento INSERT, destinazione la nuova funzione,
   autenticato con la chiave di servizio (opzione nativa di quella
   schermata).

## B — Etichette dei bandi: la parola chiave invece dell'etichetta astratta

**Problema individuato**: lo scraper oggi decide SE un bando corrisponde
(`classifica()` in `scraper/src/lib/matching.ts`, ritorna solo
`{ priorita, scartato }`), ma non salva MAI quale parola specifica lo ha
fatto scattare. La card mostra quindi un'etichetta generica
("Match diretto" / "Da verificare") che, per chi non conosce lo schema di
priorità pensato per QYROS, non comunica nulla.

**Decisione presa durante il brainstorming**: salvare la parola al momento
della raccolta (fonte stabile, nessun ricalcolo nel sito), **e** sistemare
una volta sola i bandi già raccolti finora, riusando la stessa identica
funzione di corrispondenza (non una copia scritta a mano altrove — evita
che le due logiche possano divergere in futuro).

**Modifiche**:
- Nuova colonna `bandi.parole_corrispondenti text[]` (default `'{}'`).
- `scraper/src/lib/matching.ts`, `classifica()`: ritorna anche quali parole
  di `keywords.livello1`/`livello2` hanno effettivamente causato il match
  (non solo un booleano).
- `scraper/src/lib/types.ts`, `MatchResult`: guadagna `paroleTrovate:
  string[]`.
- Percorso di scrittura del job (`db-port-supabase.ts`): salva
  `parole_corrispondenti` insieme a `priorita`.
- **Backfill una tantum**: uno script eseguito una sola volta (riusa
  `classifica()`/`normalizzaTesto()` importandole direttamente dalla
  libreria dello scraper, non riscritte), che rilegge ogni bando già
  salvato, ricalcola quali parole chiave attuali corrispondono, e aggiorna
  `parole_corrispondenti`. Tracciato nel repository per cronologia, anche
  se eseguito una volta sola (stesso principio delle migrazioni una tantum
  già in `supabase/schema.sql`).
- `BandoCard.tsx`: il `Chip` "Match diretto"/"Da verificare" diventa
  "Corrisponde a: {parole_corrispondenti.join(', ')}".

## C — Suggerimenti di nuove parole chiave

**Nuova tabella `suggerimenti_parole_chiave`**: `id`, `parola`,
`proposto_da` (email di chi lo propone, letta dalla sessione), `proposto_il`
(default `now()`), `stato` (`in_attesa` | `accettato` | `rifiutato`,
default `in_attesa`). RLS: inserimento per qualunque utente autenticato
(chiunque abbia accesso al sito, non solo l'amministratore); lettura e
modifica riservate all'amministratore — stesso schema già usato per
`richieste_accesso`.

**Interfaccia**: un piccolo modulo "Suggerisci una parola chiave" visibile
a chiunque sia loggato (vicino ai filtri, nella vista principale dei
bandi). Nel pannello, dentro la tab "Configurazione" — insieme alla
gestione delle parole chiave esistenti, non in una tab separata — una
nuova sezione "Suggerimenti in attesa" con pulsanti Accetta/Rifiuta:
*Accetta* inserisce la parola in `parole_chiave` (livello2, "da
verificare" — il livello più prudente, l'amministratore può comunque
spostarla dopo) e marca il suggerimento accettato; *Rifiuta* marca solo lo
stato, la riga resta per memoria storica (stesso principio già usato per
le richieste di accesso rifiutate).

## D — Contatore di utilizzo per i filtri parola chiave

**Correzione di base necessaria**: oggi i "chip" dei filtri in
`FiltriBar.tsx` non leggono affatto dalla tabella `parole_chiave` — vengono
da un file statico (`config/keywords.json`, pensato come ripiego per lo
scraper quando gira senza credenziali reali, non per la dashboard).
Significa che una parola chiave aggiunta o rimossa dall'amministratore
oggi non cambia i filtri visibili finché qualcuno non pubblica di nuovo il
sito a mano. Contare i click in modo affidabile richiede comunque
collegare ogni filtro alla riga reale nel database — quindi **come parte
di questo stesso lavoro**, `FiltriBar.tsx` viene aggiornato per leggere le
parole chiave da Supabase (stessa query già usata in `Configurazione.tsx`),
sostituendo l'importazione statica. Bonus collaterale: da qui in poi le
parole chiave approvate (sia dall'amministratore sia dai suggerimenti del
punto C) compaiono nei filtri subito, senza dover ripubblicare il sito.

**Contatore**: nuova colonna `parole_chiave.contatore_click integer not
null default 0`. Una piccola funzione Postgres
(`increment_click_parola(id_parola uuid)`) esegue l'incremento in un solo
passaggio atomico lato database (evita il problema dei due click
quasi contemporanei che si "perdono" a vicenda se calcolati nel browser).
Ogni click su un filtro chiama questa funzione. Il conteggio è visibile
all'amministratore nella tab "Configurazione", accanto a ciascuna parola
chiave.

## E — Rifiniture di interfaccia

- Il pulsante tema chiaro/scuro e il pulsante "Esci" mostrano un testo al
  passaggio del mouse: "Tema chiaro" quando sei in modalità scura (indica
  cosa succede cliccando), "Tema scuro" quando sei in modalità chiara;
  "Esci" per il logout.
- Nuova icona "Segnala" nell'intestazione, visibile a chiunque sia
  collegato (non solo l'amministratore): apre un'email precompilata verso
  `panto75@gmail.com` per bug o suggerimenti (un link `mailto:`, nessun
  modulo o funzione nuova sul sito).

## Cosa non cambia

- Il flusso di richiesta/approvazione accesso (Fase 6, 6c, 6d): invariato,
  la notifica del punto A si aggiunge senza toccarne la logica.
- Il filtraggio testuale dei bandi (`filtriBandi.ts`, che ricalcola dal
  vivo se un bando contiene una parola quando la usi come filtro): resta
  così, è corretto che una ricerca interattiva sia dinamica — la
  distinzione con "quale parola ha causato la classificazione originale"
  (punto B, che invece deve restare stabile nel tempo) è intenzionale, non
  un'incoerenza.
- Schema e RLS delle tabelle esistenti (`richieste_accesso`,
  `impostazioni_job`, `job_run_log`): invariati.

## Test e verifica

Stessa disciplina delle fasi precedenti: test automatici per ogni nuova
funzione/componente della dashboard e dello scraper (incluso il nuovo
`classifica()` con parole trovate, mockato senza rete reale). La Edge
Function e il Database Webhook, non testabili nella suite automatica,
vengono verificati con una richiesta reale dopo il deploy. Il backfill,
essendo uno script una tantum su dati reali, viene eseguito una volta e
verificato leggendo un campione di righe aggiornate prima di considerarlo
concluso.
