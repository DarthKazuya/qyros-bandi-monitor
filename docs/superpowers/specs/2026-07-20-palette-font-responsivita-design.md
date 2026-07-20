# Aggiornamento palette, font e responsività (Fase 7)

## Contesto

Il progetto ha un tema centralizzato (`dashboard/src/theme.ts`, MUI v6) con dark
mode già funzionante, ma tre aspetti restano da sistemare, richiesti
esplicitamente dall'utente durante la Fase 6e e volutamente rimandati a un
proprio ciclo di lavoro separato: la palette colori (quella attuale —
arancione/blu petrolio/blu scuro — va sostituita del tutto), il font (Roboto è
dichiarato nel tema ma non è mai stato effettivamente caricato) e la
responsività mobile (oggi sistematica solo nella griglia dei bandi).

Vincolo guida: nessuna riscrittura. Si modifica il tema esistente e i punti di
codice dove la responsività è debole, mantenendo intatta l'architettura
attuale (MUI, struttura dei componenti, meccanismo del dark mode).

## Fuori scope

- **Pannello/drawer separato per i filtri mobile**: valutato, scartato in
  favore dell'impilamento a piena larghezza dei menu "Fonte"/"Ordina per" su
  schermi stretti — i filtri per parola chiave sono già dietro un menu a
  scomparsa, non serve un contenitore aggiuntivo.
- **Libreria di generazione automatica delle tonalità Material 3** (a
  partire da un colore sorgente): non necessaria — l'utente ha fornito
  manualmente ogni tonalità richiesta (base, sfondo/testo chiaro e scuro per
  ogni ruolo).
- **Google Sans**: non ha una licenza aperta per uso libero sul web (font
  proprietario di Google, non distribuito su Google Fonts). Si resta su
  Roboto, lo standard Material open source.

## 1. Palette colori

Sostituzione completa di `PALETTE_QYROS` in `theme.ts`, mappata sui ruoli
semantici di MUI (non su chiavi custom), così ogni componente MUI esistente
(`Button`, `Chip`, `Alert`, ecc.) eredita i colori automaticamente:

| Ruolo MUI | Uso | Chiaro | Scuro |
|---|---|---|---|
| `primary` | Colore principale del brand — intestazione, pulsanti, link | main `#5B6EE8` | main `#7A8AF0` |
| `secondary` | Accento riservato ai badge "alta priorità"/match diretto | main `#0F6E56`, sfondo chip `#D2EFF0`, testo su sfondo chip `#0F6E56` | main `#9FE1CB`, sfondo chip `#085041`, testo su sfondo chip `#9FE1CB` |
| `info` (riusato, oggi inutilizzato nel sito) | Neutro per badge "da verificare" | main `#78909C`, sfondo chip `#ECEFF1`, testo su sfondo chip `#37474F` | main `#78909C`, sfondo chip `#37474F`, testo su sfondo chip `#CFD8DC` |
| `error` | **Solo** errori tecnici dello scraper (Alert di validazione, righe fonte fallite in Storico esecuzioni) — mai stati dei bandi | main `#D32F2F`, sfondo `#FCEBEB`, testo su sfondo `#501313` | main `#D32F2F`, sfondo `#791F1F`, testo su sfondo `#F7C1C1` |
| `warning` | Badge "in scadenza" (bando con meno di 30 giorni alla scadenza) | valori predefiniti di MUI (ambra Material standard, non personalizzati) | valori predefiniti di MUI |
| `background.default` | Sfondo pagina | `#f5f6f8` (invariato) | `#111318` (mai nero puro) |
| `background.paper` | Sfondo card/superfici | `#ffffff` (invariato) | `#1a1d24` (leggermente più chiaro del canvas, per restare distinguibile) |
| `text.primary` / `text.secondary` | Testo | `#040a1b` / `#52627a` (valori numerici invariati rispetto a oggi, ora scritti come letterali — non più derivati da `PALETTE_QYROS`, che viene rimossa) | `#f5f5f0` / `#93a4bd` (valori numerici invariati — già ad alto contrasto sul nuovo sfondo `#111318`, nessun adattamento necessario) |

Regola d'inversione per `secondary`, `info` ed `error`: sfondo chiaro + testo
scuro della stessa famiglia in tema chiaro; sfondo scuro + testo chiaro della
stessa famiglia in tema scuro. Non si introduce alcuna chiave palette custom
nuova (niente `palette.neutral`): il ruolo neutro riusa `info`, che oggi non
è referenziato da nessun componente del sito.

## 2. Font

`Roboto` è dichiarato in `typography.fontFamily` ma non è mai stato caricato
come file reale — il browser ripiega silenziosamente su un font di sistema.
Si aggiunge `@fontsource/roboto` come dipendenza npm del pacchetto
`dashboard` (pesi 400 e 500, i pesi standard Material per testo e titoli),
importato una sola volta in `main.tsx`. Preferito a un link Google Fonts in
`index.html` perché non dipende da una richiesta di rete esterna (più
solido, funziona anche offline in anteprima locale).

## 3. Token Material 3 (forma ed elevazione)

- **Forma**: `shape.borderRadius` passa da `16` a `12` in `theme.ts`;
  l'override `MuiCard.styleOverrides.root.borderRadius` (oggi ridondante,
  stesso valore duplicato) viene rimosso per ereditare `shape.borderRadius`
  invece di ripetere il numero.
- **Elevazione**: l'array `shadows` di MUI (25 livelli, usati da card, menu,
  popup ovunque nel sito) viene sostituito con una versione più tenue e
  diffusa in stile M3, definita una sola volta nel tema — nessun componente
  necessita di override individuali per ereditare l'ombra più leggera.

## 4. Correzioni nei componenti esistenti

La palette da sola non basta: due punti del codice legano oggi un
comportamento visivo ai vecchi ruoli `primary`/`secondary`/`error` in modo
che, con la nuova palette, produrrebbe il risultato sbagliato.

- **`BandoCard.tsx`**: il badge "Corrisponde a: ..." passa da
  `eAlta ? 'primary.main' : 'secondary.main'` a
  `eAlta ? 'secondary.main' : 'info.main'` (alta priorità → teal, da
  verificare → grigio-blu neutro). Il badge dei giorni alla scadenza passa
  da `eInAllarme ? 'error.main' : 'action.selected'` a
  `eInAllarme ? 'warning.main' : 'action.selected'`.
- **`App.tsx`**: l'`AppBar` passa da `color="secondary"` a `color="primary"`,
  così il teal resta un accento raro riservato ai badge invece di occupare
  l'intera intestazione.

Nessun altro file referenzia i colori attuali direttamente (verificato via
ricerca nel codice: solo `theme.ts` definiva `PALETTE_QYROS`), quindi il
resto del sito eredita la nuova palette senza altri interventi manuali.

## 5. Responsività mobile

Regola generale: padding e spaziatura più compatti su `xs`, dimensioni testo
verificate leggibili senza zoom, aree cliccabili sempre ≥44px (già rispettato
ovunque nel sito, da mantenere).

- **`FiltriBar.tsx`**: i `FormControl` di "Fonte" e "Ordina per" (oggi
  `minWidth: 200`/`180` affiancati con `flex: 1`) diventano a piena
  larghezza e impilati verticalmente su `xs`
  (`sx={{ flexDirection: { xs: 'column', sm: 'row' } }}` sul contenitore,
  `minWidth: { xs: '100%', sm: 200 }` sui singoli controlli). Campo di
  ricerca e menu a scomparsa delle parole chiave restano invariati, già
  corretti.
- **`App.tsx`**: il `Typography` del titolo "Fund Radar" guadagna
  `noWrap` e `textOverflow: 'ellipsis'` così non spinge fuori schermo i
  pulsanti quando lo spazio è insufficiente; il `gap` fra le icone
  dell'intestazione si riduce su `xs` mantenendo `minWidth`/`minHeight: 44`
  su ogni pulsante.
- **`ListaBandi.tsx`**: la griglia bandi è già corretta (1/2/3 colonne per
  `xs`/`sm`/`md`); il padding orizzontale del contenitore (`px: 2`) si
  riduce leggermente su `xs`.
- **`RichiesteInAttesa.tsx`, `UtentiAutorizzati.tsx`, `Configurazione.tsx`**:
  le righe che affiancano testo (nome/email) e pulsanti di azione su una
  singola riga `flex` passano a `flexDirection: { xs: 'column', sm: 'row' }`
  con allineamento adattato, per impilarsi su schermi stretti invece di
  comprimersi o uscire dal contenitore.
- **`PannelloAdmin.tsx`**: le schede (`Tabs`) sono già `variant="scrollable"`
  con frecce automatiche, nessun intervento necessario.
- **`LoginScreen.tsx`**: verifica generale di padding/dimensione testo sui
  tre breakpoint di riferimento, nessuna criticità strutturale attesa (già
  un form centrato a colonna singola).

## Cosa non cambia

- Architettura del tema: resta un'unica funzione `creaTemaQyros(modalita)`
  che restituisce un `Theme` di MUI, chiamata da `App.tsx` con lo stesso
  meccanismo di toggle chiaro/scuro già in uso.
- Struttura dei componenti: nessun file viene spostato, rinominato o
  riscritto da zero — solo modifiche mirate ai punti elencati sopra.
- Nessuna nuova dipendenza oltre a `@fontsource/roboto`.

## Test e verifica

Stessa disciplina delle fasi precedenti: test automatici per ogni modifica
di comportamento (in particolare i due branch di colore corretti in
`BandoCard.tsx`, se già coperti da test esistenti — da verificare e
aggiornare, non duplicare). Le modifiche di sola palette/font/forma non
hanno un test automatico significativo (sono valori visivi) — verificate a
video ai tre breakpoint di riferimento (~360-400px, ~768px, ~1200px+) in
chiaro e scuro, prima di considerare il lavoro concluso.
