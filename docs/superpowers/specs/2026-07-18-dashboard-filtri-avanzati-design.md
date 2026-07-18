# Dashboard — Filtri avanzati e persistenza (Fase 5)

## Contesto

La dashboard (Fase 4) è live in produzione con login, card bando, filtri base
(priorità, fonte multi-selezione, ricerca libera, ordinamento) e segna-come-visto.
Dall'uso reale sono emerse richieste di miglioramento, discusse e concordate con
l'utente. Questo documento le fissa come riferimento prima di scriverne il piano di
implementazione.

Vincolo guida invariato: nessun costo aggiuntivo, nessuna nuova dipendenza esterna,
nessuna modifica allo scraper o allo schema del database. Tutto il lavoro di questa
fase è contenuto in `dashboard/`.

## Fuori scope (deciso esplicitamente in questa sessione)

- **Traduzione automatica dei bandi (italiano → inglese)**: proposta dall'utente,
  poi scartata di comune accordo. Nessuna opzione di traduzione trovata è
  contemporaneamente gratuita e abbastanza affidabile da non rischiare la stabilità
  del job giornaliero ("il motore dell'app è la cosa più importante" — priorità
  esplicita dell'utente). Non implementare senza una futura richiesta esplicita e
  una soluzione realmente gratuita.
- **Filtro per importo economico (range €)**: proposta dall'utente, poi scartata.
  Lo scraper non estrae oggi un importo strutturato — solo testo libero, con
  formati molto eterogenei tra le 7 fonti (range, tetti massimi, cifre non
  direttamente legate al finanziamento). Costruire un'estrazione affidabile
  richiederebbe un'analisi per fonte e comporta un rischio concreto di mostrare
  cifre fuorvianti. Da valutare come eventuale fase futura separata, non ora.

## Funzionalità di questa fase

### 1. Filtro per parole chiave (nuovo)

- Le parole chiave da filtrare sono **le stesse di `config/keywords.json`**
  (livello1 + livello2 uniti in un solo elenco, senza distinzione visiva tra i due
  livelli in questa fase — sono già rappresentati dal filtro priorità esistente).
  La dashboard legge questo file direttamente (stessa fonte di verità dello
  scraper): se l'utente modifica `config/keywords.json`, l'elenco delle parole
  chiave filtrabili nella dashboard si aggiorna automaticamente al prossimo
  deploy, senza bisogno di toccare altro codice.
- UI pensata per mobile: una sezione **richiudibile** ("Parole chiave ▾" /
  "Parole chiave ▴") sotto la barra filtri esistente, chiusa di default. Espansa,
  mostra tutte le parole chiave come chip selezionabili (tocco ≥44px), disposte a
  capo automaticamente su più righe.
- **Logica di selezione multipla: intersezione (AND)**. Se l'utente seleziona più
  di una parola chiave, un bando compare nei risultati solo se il suo titolo o la
  sua descrizione contengono *tutte* le parole selezionate (non basta una sola) —
  narrowing progressivo, come richiesto esplicitamente dall'utente. Nessuna parola
  selezionata = filtro non applicato (comportamento equivalente a oggi).
- Il confronto testo↔parola chiave usa la stessa normalizzazione già presente nello
  scraper (minuscolo, rimozione accenti, normalizzazione trattino/spazio) — la
  logica va replicata nella dashboard (i due pacchetti `scraper/` e `dashboard/`
  non condividono codice, per scelta architetturale già stabilita nelle fasi
  precedenti).
- Questo filtro si combina con tutti gli altri (priorità, fonte, ricerca) con
  logica AND, coerente col resto del sistema di filtri esistente.

### 2. Fonti sempre visibili (modifica)

- Oggi il menu "Fonte" mostra solo le fonti che hanno almeno un bando già salvato
  (dedotto dai dati caricati). Da modificare per mostrare **sempre tutte le fonti
  attive**, lette da `config/sources.json` (solo le voci con `attivo: true`),
  indipendentemente dal fatto che abbiano già prodotto un bando visibile o meno.

### 3. Ordinamento — direzione crescente/decrescente (nuovo controllo)

- Verificato (codice + test automatici esistenti, Fase 4a): l'ordinamento attuale
  funziona correttamente — "Data pubblicazione" mostra prima i più recenti
  (decrescente), "Scadenza" mostra prima quelli più vicini (crescente). Queste
  direzioni oggi sono fisse per ciascun campo.
- Aggiungere un controllo (es. pulsante/icona) accanto al menu "Ordina per" che
  permetta di invertire la direzione per il campo di ordinamento attualmente
  selezionato. Le direzioni di default restano quelle attuali (pubblicazione
  decrescente, scadenza crescente) finché l'utente non le inverte.
- **Cambio di campo di ordinamento**: quando l'utente passa da "Data
  pubblicazione" a "Scadenza" (o viceversa), la direzione scelta **resta quella
  attuale** — non torna al default del nuovo campo. Un solo stato di direzione,
  condiviso tra i due campi.

### 4. Badge countdown scadenza (nuovo, su ogni card)

- Ogni card con una `scadenza` non nulla mostra un testo calcolato tipo "12 giorni
  alla scadenza" (calcolo lato browser: differenza in giorni tra oggi e la data di
  scadenza). Se la scadenza è già passata, mostrare "Scaduto" invece di un numero
  negativo di giorni.
- **Soglia di allarme: 1 mese (30 giorni)**. Se mancano meno di 30 giorni (o è già
  scaduto), il badge usa un colore di avviso (es. arancione/rosso) invece del
  colore neutro standard. Interpretazione confermata con l'utente: "1 mese" è la
  soglia per il colore di allarme, non il formato del testo (il testo resta sempre
  in giorni esatti, per essere più immediatamente utile).
- Card senza `scadenza` (null) non mostrano questo badge, come già oggi.

### 5. Contatore risultati sulle schede di priorità (nuovo)

- Le tre schede del filtro priorità ("Tutti", "Match diretto", "Da verificare")
  mostrano tra parentesi quanti risultati corrisponderebbero a quella priorità,
  **con tutti gli altri filtri correnti già applicati** (fonte, parole chiave,
  ricerca) — cioè "se scegliessi questa priorità, quanti risultati vedresti",
  calcolato sui dati filtrati per tutte le altre dimensioni tranne la priorità
  stessa. Esempio: "Da verificare (7)".

### 6. Filtri ricordati tra le visite (nuovo)

- Ogni volta che l'utente cambia un filtro (priorità, fonti, parole chiave,
  ricerca, ordinamento, direzione), la scelta viene salvata nel browser
  (`localStorage`) sotto una chiave dedicata.
- All'apertura della dashboard, se esiste uno stato filtri salvato e valido
  (stessa forma dei dati attesi), viene usato come stato iniziale al posto dei
  valori di default. Se il dato salvato è mancante, corrotto, o di forma
  inaspettata (es. da una versione precedente incompatibile dell'app), si
  ignora silenziosamente e si usano i valori di default — nessun errore mostrato
  all'utente per questo caso.

## Struttura tecnica (indicativa, dettagliata nel piano di implementazione)

- `dashboard/src/lib/keywords.ts` — importa `config/keywords.json` (percorso
  relativo attraverso la struttura del repository) ed espone l'elenco piatto
  delle parole chiave.
- `dashboard/src/lib/sources.ts` — importa `config/sources.json` ed espone
  l'elenco delle fonti attive.
- `dashboard/src/lib/normalizzaTesto.ts` — porta della funzione di normalizzazione
  già presente in `scraper/src/lib/matching.ts` (accenti, minuscolo, trattini).
- `dashboard/src/lib/filtriBandi.ts` — esteso: `FiltriStato` guadagna
  `paroleChiave: string[]` e `direzioneOrdinamento: 'crescente' | 'decrescente'`;
  `applicaFiltri` applica il nuovo filtro AND sulle parole chiave e la direzione
  esplicita invece che fissa.
- `dashboard/src/lib/persistenzaFiltri.ts` — funzioni di lettura/scrittura da
  `localStorage`, con validazione difensiva del dato letto.
- `dashboard/src/components/FiltriBar.tsx` — esteso con la sezione richiudibile
  parole chiave e il controllo di direzione ordinamento.
- `dashboard/src/components/BandoCard.tsx` — esteso con il badge countdown.
- `dashboard/src/components/ListaBandi.tsx` — fonti statiche da
  `config/sources.json`, calcolo dei contatori per priorità, integrazione con
  `persistenzaFiltri` (lettura all'avvio, scrittura ad ogni cambiamento filtri).

Nota tecnica da verificare presto in fase di implementazione: l'importazione di
file JSON esterni alla cartella `dashboard/` (in `config/`, alla radice del
repository) deve funzionare sia in sviluppo locale sia nella build di produzione
usata da GitHub Actions. Se Vite dovesse sollevare problemi con questo percorso
d'importazione, il piano di ripiego è copiare i due file JSON dentro
`dashboard/src/` come parte della build (non a mano), mantenendo comunque
`config/` come unica fonte modificabile dall'utente.

## Test e verifica

Stessa disciplina delle fasi precedenti: test automatici dedicati per ogni nuova
funzione di libreria (in particolare i casi limite del filtro parole chiave:
nessuna selezionata, una selezionata, più selezionate con intersezione vuota o
non vuota; i casi limite della persistenza: nessun dato salvato, dato valido, dato
corrotto), revisione a due stadi per singolo task, e una doppia verifica finale
sull'insieme del lavoro prima di considerarlo concluso, come richiesto
esplicitamente dall'utente per questa fase.
