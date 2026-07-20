# Palette, font e responsività (Fase 7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the QYROS dashboard's color palette, load Roboto as a real
web font, apply Material 3 shape/elevation tokens, and make the whole UI
responsive on narrow (mobile) screens — without rewriting any architecture.

**Architecture:** All color/font/shape changes are centralized in
`dashboard/src/theme.ts` (one function, `creaTemaQyros(modalita)`, already
consumed by `App.tsx` exactly as today). Two components
(`BandoCard.tsx`, `App.tsx`) need small, targeted fixes because they
currently bind visual behavior to the *old* palette's role assignments.
Five components get responsive (`sx` breakpoint) adjustments only — no
logic changes.

**Tech Stack:** MUI v6 (`@mui/material/styles`), `@fontsource/roboto` (new
dependency), Vitest + Testing Library (existing).

## Global Constraints

- Every hex value below is copied verbatim from
  `docs/superpowers/specs/2026-07-20-palette-font-responsivita-design.md` —
  do not approximate or "round" any color.
- `error` (red, `#D32F2F`) is reserved **exclusively** for scraper technical
  errors (form/API `Alert`s, `StoricoEsecuzioni`'s failed-source `Chip`).
  Never use `error` for a bando/keyword state.
- No new top-level palette role is introduced. The only palette extension is
  `container`/`onContainer` added to the existing `secondary` and `info`
  roles (not a new `neutral` role).
- Roboto loads at weights **400 and 500 only**, via `@fontsource/roboto`
  (npm dependency), not a Google Fonts `<link>`.
- Every clickable element keeps a minimum touch target of 44×44px — this is
  already true everywhere in the codebase; no task in this plan may shrink
  it.
- No architectural rewrite: `creaTemaQyros(modalita)`'s signature, and every
  component's props/exports, stay exactly as they are today. Only the
  bodies listed per task change.

---

### Task 1: Nuova palette colori

**Files:**
- Modify: `dashboard/src/theme.ts`
- Modify: `dashboard/src/theme.test.ts`

**Interfaces:**
- Consumes: nothing new (still `createTheme` from `@mui/material/styles`).
- Produces: `creaTemaQyros(modalita).palette` now exposes
  `primary.main`, `secondary.main/contrastText/container/onContainer`,
  `info.main/contrastText/container/onContainer`, `error.main/contrastText`,
  `background.default/paper`, `text.primary/secondary` — all with the exact
  values below. `secondary.container`/`onContainer` and
  `info.container`/`onContainer` are new fields later tasks rely on (Task 4
  reads them from `BandoCard.tsx`). `shape`/`components.MuiCard` are **not**
  touched by this task (Task 3 owns them) — leave them exactly as they are
  today.

- [ ] **Step 1: Update the failing tests first**

Replace the entire contents of `dashboard/src/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { creaTemaQyros } from './theme';

describe('creaTemaQyros', () => {
  it('usa la nuova palette primaria indaco in entrambe le modalità', () => {
    expect(creaTemaQyros('light').palette.primary.main).toBe('#5B6EE8');
    expect(creaTemaQyros('dark').palette.primary.main).toBe('#7A8AF0');
  });

  it('usa il teal come colore secondario, con i toni container per i badge', () => {
    const chiaro = creaTemaQyros('light').palette.secondary;
    expect(chiaro.main).toBe('#0F6E56');
    expect(chiaro.container).toBe('#D2EFF0');
    expect(chiaro.onContainer).toBe('#0F6E56');

    const scuro = creaTemaQyros('dark').palette.secondary;
    expect(scuro.main).toBe('#9FE1CB');
    expect(scuro.container).toBe('#085041');
    expect(scuro.onContainer).toBe('#9FE1CB');
  });

  it('usa il grigio-blu come colore neutro (ruolo info) per i badge "da verificare"', () => {
    const chiaro = creaTemaQyros('light').palette.info;
    expect(chiaro.main).toBe('#78909C');
    expect(chiaro.container).toBe('#ECEFF1');
    expect(chiaro.onContainer).toBe('#37474F');

    const scuro = creaTemaQyros('dark').palette.info;
    expect(scuro.main).toBe('#78909C');
    expect(scuro.container).toBe('#37474F');
    expect(scuro.onContainer).toBe('#CFD8DC');
  });

  it('riserva il rosso esclusivamente al ruolo errore, in entrambe le modalità', () => {
    expect(creaTemaQyros('light').palette.error.main).toBe('#D32F2F');
    expect(creaTemaQyros('dark').palette.error.main).toBe('#D32F2F');
  });

  it('applica i colori personalizzati agli avvisi di errore (Alert standard)', () => {
    const chiaro = creaTemaQyros('light').components?.MuiAlert?.styleOverrides
      ?.standardError as Record<string, string>;
    expect(chiaro).toMatchObject({ backgroundColor: '#FCEBEB', color: '#501313' });

    const scuro = creaTemaQyros('dark').components?.MuiAlert?.styleOverrides
      ?.standardError as Record<string, string>;
    expect(scuro).toMatchObject({ backgroundColor: '#791F1F', color: '#F7C1C1' });
  });

  it('non usa mai il nero puro come sfondo pagina in dark mode', () => {
    expect(creaTemaQyros('dark').palette.background.default).toBe('#111318');
  });

  it('usa uno sfondo card leggermente più chiaro dello sfondo pagina in dark mode', () => {
    expect(creaTemaQyros('dark').palette.background.paper).toBe('#1a1d24');
  });

  it('imposta la modalità richiesta', () => {
    expect(creaTemaQyros('dark').palette.mode).toBe('dark');
    expect(creaTemaQyros('light').palette.mode).toBe('light');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/theme.test.ts`
Expected: multiple FAIL — the old file still returns `#ff6500`/`#3c6a8b`/etc.,
and `palette.info`/`.secondary.container` are `undefined`.

- [ ] **Step 3: Replace the palette in `theme.ts`**

Replace the entire contents of `dashboard/src/theme.ts` with:

```ts
import { createTheme, type Theme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface PaletteColor {
    container?: string;
    onContainer?: string;
  }
  interface SimplePaletteColorOptions {
    container?: string;
    onContainer?: string;
  }
}

export function creaTemaQyros(modalita: 'light' | 'dark'): Theme {
  const scuro = modalita === 'dark';

  return createTheme({
    palette: {
      mode: modalita,
      primary: {
        main: scuro ? '#7A8AF0' : '#5B6EE8',
        contrastText: '#ffffff',
      },
      secondary: {
        main: scuro ? '#9FE1CB' : '#0F6E56',
        contrastText: scuro ? '#085041' : '#ffffff',
        container: scuro ? '#085041' : '#D2EFF0',
        onContainer: scuro ? '#9FE1CB' : '#0F6E56',
      },
      info: {
        main: '#78909C',
        contrastText: scuro ? '#0b0f12' : '#ffffff',
        container: scuro ? '#37474F' : '#ECEFF1',
        onContainer: scuro ? '#CFD8DC' : '#37474F',
      },
      error: {
        main: '#D32F2F',
        contrastText: '#ffffff',
      },
      background: {
        default: scuro ? '#111318' : '#f5f6f8',
        paper: scuro ? '#1a1d24' : '#ffffff',
      },
      text: {
        primary: scuro ? '#f5f5f0' : '#040a1b',
        secondary: scuro ? '#93a4bd' : '#52627a',
      },
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: '"Roboto", "Segoe UI", -apple-system, sans-serif',
      h5: { fontWeight: 800 },
      h6: { fontWeight: 700 },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 16 },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', borderRadius: 12 },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiAlert: {
        styleOverrides: {
          standardError: {
            backgroundColor: scuro ? '#791F1F' : '#FCEBEB',
            color: scuro ? '#F7C1C1' : '#501313',
          },
        },
      },
    },
  });
}
```

Note: `shape.borderRadius` stays `16` and the `MuiCard` override stays
exactly as it was — Task 3 changes both. Do not touch them in this task.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/theme.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Typecheck and run the full suite**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: typecheck clean; full suite passes (the old palette isn't
asserted anywhere else — confirmed by searching the codebase for
`PALETTE_QYROS`/the old hex values before writing this plan).

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/theme.ts dashboard/src/theme.test.ts
git commit -m "feat(dashboard): nuova palette colori (indaco/teal/grigio-blu/rosso)"
```

---

### Task 2: Font Roboto caricato correttamente

**Files:**
- Modify: `dashboard/package.json`
- Modify: `dashboard/src/main.tsx`

**Interfaces:**
- Consumes: none.
- Produces: nothing other components rely on — `theme.ts`'s
  `typography.fontFamily` already lists `"Roboto"` first (unchanged), it
  simply becomes true once the font files are actually loaded.

- [ ] **Step 1: Install the dependency**

Run: `cd dashboard && npm install @fontsource/roboto@^5.3.0`
Expected: `dashboard/package.json`'s `dependencies` gains
`"@fontsource/roboto": "^5.3.0"`, and `dashboard/package-lock.json` updates.

- [ ] **Step 2: Import the two weights in `main.tsx`**

Modify `dashboard/src/main.tsx` — add two lines at the very top, before the
existing imports:

```tsx
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
```

- [ ] **Step 3: Run the full suite (regression check)**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: typecheck clean; full suite passes unchanged (font loading has no
unit-testable behavior in jsdom — this is a regression check, not a new
test, matching this plan's own testing note below).

- [ ] **Step 4: Commit**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/src/main.tsx
git commit -m "feat(dashboard): carica Roboto 400/500 come dipendenza reale"
```

---

### Task 3: Token Material 3 — forma ed elevazione

**Files:**
- Modify: `dashboard/src/theme.ts`
- Modify: `dashboard/src/theme.test.ts`

**Interfaces:**
- Consumes: the `theme.ts` produced by Task 1 (palette section untouched
  here).
- Produces: `creaTemaQyros(modalita).shape.borderRadius === 12`;
  `creaTemaQyros(modalita).shadows` is a 25-entry array of soft, diffuse
  shadow strings (M3-style) instead of MUI's classic triple-layer default.

- [ ] **Step 1: Add the failing tests first**

Append to `dashboard/src/theme.test.ts` (inside the existing `describe`
block, after the last `it(...)`):

```ts
  it('usa un raggio degli angoli di 12px (token di forma Material 3)', () => {
    expect(creaTemaQyros('light').shape.borderRadius).toBe(12);
  });

  it('genera 25 livelli di ombra, più tenui del default MUI', () => {
    const ombre = creaTemaQyros('light').shadows;
    expect(ombre).toHaveLength(25);
    expect(ombre[0]).toBe('none');
    expect(ombre[1]).toBe('0px 2px 6px rgba(15,20,30,0.16)');
    expect(ombre[24]).toBe('0px 16px 48px rgba(15,20,30,0.08)');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/theme.test.ts`
Expected: FAIL — `shape.borderRadius` is still `16`; `shadows` is `undefined`
(MUI's own default 25-entry array is a different, longer triple-shadow
string, so `shadows[1]` won't match either).

- [ ] **Step 3: Add the shadow helper and wire up `shape`/`shadows`**

In `dashboard/src/theme.ts`:

1. Change the import line to also bring in the `Shadows` type:

```ts
import { createTheme, type Theme, type Shadows } from '@mui/material/styles';
```

2. Add this function above `creaTemaQyros` (below the `declare module`
   block):

```ts
function creaOmbreM3(): Shadows {
  const ombre: string[] = ['none'];
  for (let livello = 1; livello <= 24; livello++) {
    const offsetY = Math.min(1 + livello, 16);
    const blur = Math.min(4 + livello * 2, 48);
    const opacita = Math.max(0.16 - livello * 0.004, 0.08).toFixed(2);
    ombre.push(`0px ${offsetY}px ${blur}px rgba(15,20,30,${opacita})`);
  }
  // MUI richiede una tupla di esattamente 25 stringhe (Shadows); costruirla
  // via loop è più leggibile di 25 righe letterali, ma non è verificabile
  // otticamente da TypeScript come tupla a lunghezza fissa.
  return ombre as unknown as Shadows;
}
```

3. Inside `createTheme({...})`, change `shape: { borderRadius: 16 }` to
   `shape: { borderRadius: 12 }`, add `shadows: creaOmbreM3(),` right after
   the `shape` line, and **remove** the `MuiCard` entry entirely from
   `components` (so cards inherit `shape.borderRadius` instead of
   duplicating the same number):

```ts
    shape: { borderRadius: 12 },
    shadows: creaOmbreM3(),
    typography: {
      fontFamily: '"Roboto", "Segoe UI", -apple-system, sans-serif',
      h5: { fontWeight: 800 },
      h6: { fontWeight: 700 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', borderRadius: 12 },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiAlert: {
        styleOverrides: {
          standardError: {
            backgroundColor: scuro ? '#791F1F' : '#FCEBEB',
            color: scuro ? '#F7C1C1' : '#501313',
          },
        },
      },
    },
```

(`MuiButton`, `MuiAppBar`, `MuiAlert` stay exactly as Task 1 left them —
only `MuiCard` is removed and `shape`/`shadows` change.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/theme.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Typecheck and run the full suite**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: typecheck clean (the `as unknown as Shadows` cast is intentional
and must not be "fixed" into a type error); full suite passes.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/theme.ts dashboard/src/theme.test.ts
git commit -m "feat(dashboard): token Material 3 — forma 12px ed elevazioni diffuse"
```

---

### Task 4: `BandoCard.tsx` — badge sui ruoli colore corretti

**Files:**
- Modify: `dashboard/src/components/BandoCard.tsx:36-47,67-77`
- Modify: `dashboard/src/components/BandoCard.test.tsx`

**Interfaces:**
- Consumes: `theme.palette.secondary.container/onContainer`,
  `theme.palette.info.container/onContainer`, `theme.palette.warning.main`
  (MUI's own default — not overridden by any earlier task) from Task 1/3's
  `theme.ts`.
- Produces: no change to `BandoCardProps` or exports.

- [ ] **Step 1: Add the failing tests first**

Add these imports to the top of `dashboard/src/components/BandoCard.test.tsx`
(alongside the existing ones):

```tsx
import { ThemeProvider } from '@mui/material/styles';
import { creaTemaQyros } from '../theme';
```

Add these tests inside the existing `describe('BandoCard', ...)` block:

```tsx
  it('usa il tono container teal per i bandi ad alta priorità', () => {
    render(
      <ThemeProvider theme={creaTemaQyros('light')}>
        <BandoCard bando={creaBando({ priorita: 'alta', parole_corrispondenti: ['fintech'] })} onCambiaStato={vi.fn()} />
      </ThemeProvider>
    );
    const chip = screen.getByText('Corrisponde a: fintech').closest('.MuiChip-root');
    expect(chip).toHaveStyle({ backgroundColor: 'rgb(210, 239, 240)' });
  });

  it('usa il tono container grigio-blu per i bandi da verificare', () => {
    render(
      <ThemeProvider theme={creaTemaQyros('light')}>
        <BandoCard bando={creaBando({ priorita: 'da_verificare', parole_corrispondenti: ['tech'] })} onCambiaStato={vi.fn()} />
      </ThemeProvider>
    );
    const chip = screen.getByText('Corrisponde a: tech').closest('.MuiChip-root');
    expect(chip).toHaveStyle({ backgroundColor: 'rgb(236, 239, 241)' });
  });

  it('usa il colore di avviso, non di errore, per un bando in scadenza', () => {
    const tra20Giorni = new Date();
    tra20Giorni.setDate(tra20Giorni.getDate() + 20);
    render(
      <ThemeProvider theme={creaTemaQyros('light')}>
        <BandoCard bando={creaBando({ scadenza: dataLocaleISO(tra20Giorni) })} onCambiaStato={vi.fn()} />
      </ThemeProvider>
    );
    const chip = screen.getByText('20 giorni alla scadenza').closest('.MuiChip-root');
    expect(chip).toHaveStyle({ backgroundColor: 'rgb(237, 108, 2)' });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/BandoCard.test.tsx`
Expected: FAIL — the badge still resolves `primary.main`/`secondary.main`
(indaco/teal-main, not the light container tones) and the deadline chip
still resolves `error.main` (`rgb(211, 47, 47)`), not `warning.main`.

- [ ] **Step 3: Fix the two color bindings**

In `dashboard/src/components/BandoCard.tsx`, change the keyword-match `Chip`
(around line 38-46):

```tsx
            <Chip
              label={`Corrisponde a: ${bando.parole_corrispondenti.join(', ')}`}
              size="small"
              sx={{
                bgcolor: eAlta ? 'secondary.container' : 'info.container',
                color: eAlta ? 'secondary.onContainer' : 'info.onContainer',
                fontWeight: 600,
              }}
            />
```

And the deadline `Chip` (around line 68-76):

```tsx
          <Chip
            label={giorniAllaScadenza < 0 ? 'Scaduto' : `${giorniAllaScadenza} giorni alla scadenza`}
            size="small"
            sx={{
              mt: 1,
              bgcolor: eInAllarme ? 'warning.main' : 'action.selected',
              color: eInAllarme ? '#ffffff' : 'text.primary',
            }}
          />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/BandoCard.test.tsx`
Expected: PASS (all tests, old + 3 new).

- [ ] **Step 5: Typecheck and run the full suite**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/BandoCard.tsx dashboard/src/components/BandoCard.test.tsx
git commit -m "fix(dashboard): badge bandi sui toni teal/grigio-blu/avviso corretti"
```

---

### Task 5: `App.tsx` — intestazione indaco e adattamento mobile

**Files:**
- Modify: `dashboard/src/App.tsx:37-83`
- Modify: `dashboard/src/App.test.tsx`

**Interfaces:**
- Consumes: `theme.palette.primary.main` from Task 1.
- Produces: no change to `App`'s export or behavior — only `AppBar` color
  and layout `sx` change.

- [ ] **Step 1: Add the failing test first**

Add this test inside the existing `describe('App', ...)` block in
`dashboard/src/App.test.tsx`:

```tsx
  it('usa il colore primario (indaco) per l\'intestazione', () => {
    vi.mocked(useAuth).mockReturnValue({ sessione: null, caricamento: false });
    render(<App />);
    const appBar = document.querySelector('.MuiAppBar-root');
    expect(appBar).toHaveStyle({ backgroundColor: 'rgb(122, 138, 240)' });
  });
```

(`rgb(122, 138, 240)` is `#7A8AF0`, the dark-mode indaco — `App` defaults to
dark mode via `useState<'light' | 'dark'>('dark')`, unchanged by this task.)

- [ ] **Step 2: Run tests to verify it fails**

Run: `cd dashboard && npx vitest run src/App.test.tsx`
Expected: FAIL — the `AppBar` still resolves the old teal/blu-petrolio
`secondary.main`.

- [ ] **Step 3: Update `App.tsx`**

Change the `AppBar` and `Toolbar` opening tags (around line 37-41):

```tsx
      <AppBar position="sticky" color="primary" elevation={0}>
        <Toolbar sx={{ gap: { xs: 0.5, sm: 1 } }}>
          <Typography variant="h6" component="div" noWrap sx={{ flexGrow: 1 }}>
            Fund Radar
          </Typography>
```

Remove the now-redundant `mr: 1` from the admin toggle `Button`'s `sx` (the
`Toolbar`'s `gap` now provides spacing between every child):

```tsx
          {utenteEAmministratore && (
            <Button color="inherit" onClick={() => setVistaAdmin((v) => !v)} sx={{ minHeight: 44 }}>
              {vistaAdmin ? 'Bandi' : 'Pannello'}
            </Button>
          )}
```

Leave the three `Tooltip`/`IconButton` blocks (tema, segnala, esci)
untouched — they already have `minWidth: 44, minHeight: 44` and now inherit
spacing from the `Toolbar`'s `gap` instead of needing individual margins.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/App.test.tsx`
Expected: PASS (all tests, old + 1 new).

- [ ] **Step 5: Typecheck and run the full suite**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/App.tsx dashboard/src/App.test.tsx
git commit -m "fix(dashboard): intestazione in indaco, titolo troncato e spaziatura icone su mobile"
```

---

### Task 6: `FiltriBar.tsx` — menu impilati su mobile

**Files:**
- Modify: `dashboard/src/components/FiltriBar.tsx:103-145`

**Interfaces:**
- Consumes: nothing new.
- Produces: no change to `FiltriBarProps` or behavior — layout only.

- [ ] **Step 1: Update the layout**

Replace the `Box` wrapping "Fonte", "Ordina per" and the direction
`IconButton` (currently lines 103-145) with:

```tsx
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 }, flex: 1 }}>
          <InputLabel id="filtro-fonte-label">Fonte</InputLabel>
          <Select
            labelId="filtro-fonte-label"
            label="Fonte"
            multiple
            value={filtri.fonti}
            onChange={gestisciCambioFonti}
            renderValue={(selezionate) => (selezionate.length === 0 ? 'Tutte le fonti' : selezionate.join(', '))}
          >
            {fontiDisponibili.map((fonte) => (
              <MenuItem key={fonte} value={fonte}>
                <Checkbox checked={filtri.fonti.includes(fonte)} />
                <ListItemText primary={fonte} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 180 }, flex: 1 }}>
          <InputLabel id="ordinamento-label">Ordina per</InputLabel>
          <Select
            labelId="ordinamento-label"
            label="Ordina per"
            value={filtri.ordinamento}
            onChange={(e) =>
              onCambiaFiltri({ ...filtri, ordinamento: e.target.value as FiltriStato['ordinamento'] })
            }
          >
            <MenuItem value="data_pubblicazione">Data pubblicazione</MenuItem>
            <MenuItem value="scadenza">Scadenza</MenuItem>
          </Select>
        </FormControl>

        <IconButton
          onClick={gestisciInversioneDirezione}
          aria-label="Inverti direzione ordinamento"
          sx={{ minWidth: 44, minHeight: 44, alignSelf: { xs: 'flex-end', sm: 'center' } }}
        >
          {filtri.direzioneOrdinamento === 'crescente' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
        </IconButton>
      </Box>
```

(Only `flexDirection` on the wrapping `Box`, `minWidth` on both
`FormControl`s, and `alignSelf` on the `IconButton` change — every prop,
handler and child is otherwise identical to today.)

- [ ] **Step 2: Run the full suite (regression check)**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: clean — confirmed before writing this plan that
`FiltriBar.test.tsx` has no style-based assertions, so behavior-only tests
(selection, callbacks) are unaffected by this layout-only change.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/FiltriBar.tsx
git commit -m "fix(dashboard): impila Fonte/Ordina per a piena larghezza su mobile"
```

---

### Task 7: `ListaBandi.tsx` — padding del contenitore su mobile

**Files:**
- Modify: `dashboard/src/components/ListaBandi.tsx:97`

**Interfaces:**
- Consumes: nothing new. Produces: nothing new.

- [ ] **Step 1: Update the padding**

Change line 97 from:

```tsx
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pb: 4 }}>
```

to:

```tsx
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 1.5, sm: 2 }, pb: 4 }}>
```

- [ ] **Step 2: Run the full suite (regression check)**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: clean — confirmed before writing this plan that
`ListaBandi.test.tsx` has no style-based assertions.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/ListaBandi.tsx
git commit -m "fix(dashboard): riduce il padding orizzontale della lista bandi su mobile"
```

---

### Task 8: Righe admin impilate su mobile

**Files:**
- Modify: `dashboard/src/components/admin/UtentiAutorizzati.tsx:73-84`
- Modify: `dashboard/src/components/admin/Configurazione.tsx:168-171`

**Interfaces:**
- Consumes: nothing new. Produces: nothing new — layout only, both files'
  existing behavior (revoke/accept/reject handlers) is untouched.

- [ ] **Step 1: Update `UtentiAutorizzati.tsx`**

Change the row `Box` (currently lines 73-84) from:

```tsx
              <Box
                key={utente.id}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
```

to:

```tsx
              <Box
                key={utente.id}
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 0 },
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
```

- [ ] **Step 2: Update `Configurazione.tsx`**

Change the suggestion row `Box` (currently lines 168-171) from:

```tsx
            <Box
              key={suggerimento.id}
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            >
```

to:

```tsx
            <Box
              key={suggerimento.id}
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: { xs: 1, sm: 0 },
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
```

- [ ] **Step 3: Run the full suite (regression check)**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: clean — confirmed before writing this plan that neither
`UtentiAutorizzati.test.tsx` nor `Configurazione.test.tsx` has style-based
assertions.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/admin/UtentiAutorizzati.tsx dashboard/src/components/admin/Configurazione.tsx
git commit -m "fix(dashboard): impila le righe di utenti/suggerimenti su mobile"
```

---

## Verifica finale (dopo tutti i task, prima del merge)

`RichiesteInAttesa.tsx` e `PannelloAdmin.tsx` non hanno bisogno di modifiche
di codice (verificato leggendo entrambi i file durante la scrittura di
questo piano: il primo impila già il proprio contenuto verticalmente, il
secondo ha già `Tabs` scorrevoli) — restano solo da controllare a video,
insieme a tutto il resto, nel passaggio seguente.

Dopo l'ultimo task, prima di considerare la Fase 7 conclusa: avviare il
server di sviluppo (`npm run dev`), aprire la dashboard nel browser e
verificare a video, in chiaro e scuro, ai tre breakpoint di riferimento
(~360-400px, ~768px, ~1200px+): intestazione, barra filtri, griglia bandi,
e le tre schede del pannello admin più usate (Richieste, Utenti,
Configurazione). Questo passaggio non produce commit di codice — è una
verifica visiva, coerente con quanto già indicato nello spec
(`docs/superpowers/specs/2026-07-20-palette-font-responsivita-design.md`,
sezione "Test e verifica").
