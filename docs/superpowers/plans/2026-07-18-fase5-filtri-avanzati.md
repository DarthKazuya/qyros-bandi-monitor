# Fase 5 — Filtri avanzati dashboard e persistenza Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add to `dashboard/`: a keyword tag filter (AND semantics, collapsible), always-visible sources, an explicit sort direction toggle, a deadline countdown badge, per-priority result counts, and filter persistence across visits — no scraper/schema changes, no new external dependencies.

**Architecture:** Pure extensions of the existing `dashboard/` React app. Two new config-reading modules import `config/keywords.json` and `config/sources.json` directly from the repository root (verified working through Vite's real production build, not just typecheck — confirmed empirically before writing this plan). `FiltriStato` and `applicaFiltri` in `filtriBandi.ts` grow two new fields; UI components consume them.

**Tech Stack:** Same as Fase 4 — Vite, React 18, TypeScript, MUI 6, Vitest + Testing Library.

## Global Constraints

- No changes to `scraper/`, `supabase/schema.sql`, or any GitHub Actions workflow. Everything lives in `dashboard/`.
- No new npm dependencies, no new external services.
- Keyword filter: multi-select, **AND** semantics — a bando must contain every selected keyword (not just one) in its normalized titolo+descrizione text. Empty selection = filter inactive (same convention as the existing `fonti` filter).
- Keyword text matching reuses the exact normalization already used by the scraper: lowercase, strip accents, collapse hyphens/spaces (`scraper/src/lib/matching.ts`'s `normalizzaTesto`) — ported into the dashboard, not imported cross-package (the two packages don't share code, per established project convention).
- Sources list in the "Fonte" filter always shows every `attivo: true` entry from `config/sources.json`, regardless of whether it currently has matching bandi.
- Sort direction (`crescente`/`decrescente`) is a single shared piece of state across both sort fields — switching from "Data pubblicazione" to "Scadenza" (or back) does **not** reset it. Defaults on first load: `data_pubblicazione` decrescente (most recent first), `scadenza` crescente (soonest first) — matching today's fixed behavior.
- Deadline badge: shows exact days remaining (e.g. "12 giorni alla scadenza"), or "Scaduto" if the deadline has passed. Warning color when remaining days `< 30` (or already passed). No badge when `scadenza` is null (unchanged from today).
- Result counts on the three priority toggle buttons reflect the bandi that would match if that priority were selected, with every *other* active filter (fonte, parole chiave, ricerca) already applied — not a count of the full unfiltered list.
- Filter state (priorita, fonti, paroleChiave, ricerca, ordinamento, direzioneOrdinamento) persists to `localStorage` under key `qyros-dashboard-filtri` on every change, and hydrates on mount. Missing, corrupt, or unexpected-shape stored data is ignored silently, falling back to defaults — never shown as an error to the user.
- Zero real Supabase/network calls in the automated test suite (standing project-wide rule).
- No `.js` extensions on relative TS/TSX imports (standing dashboard convention).

---

### Task 1: Moduli di configurazione condivisa (parole chiave, fonti, normalizzazione)

**Files:**
- Create: `dashboard/src/lib/keywords.ts`
- Test: `dashboard/src/lib/keywords.test.ts`
- Create: `dashboard/src/lib/sources.ts`
- Test: `dashboard/src/lib/sources.test.ts`
- Create: `dashboard/src/lib/normalizzaTesto.ts`
- Test: `dashboard/src/lib/normalizzaTesto.test.ts`

**Interfaces:**
- Produces: `PAROLE_CHIAVE: string[]` (flat, deduplicated, livello1+livello2 combined, exported from `keywords.ts`). `FONTI_ATTIVE: string[]` (the `id` of every `attivo: true` entry, exported from `sources.ts`). `normalizzaTesto(testo: string): string`. All three consumed by Task 2 (`filtriBandi.ts`) and Task 4/6 (UI components).

- [ ] **Step 1: Write the failing test — `dashboard/src/lib/normalizzaTesto.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { normalizzaTesto } from './normalizzaTesto';

describe('normalizzaTesto', () => {
  it('converte in minuscolo', () => {
    expect(normalizzaTesto('GAMING')).toBe('gaming');
  });

  it('rimuove gli accenti', () => {
    expect(normalizzaTesto('perché')).toBe('perche');
  });

  it('rimuove trattini e spazi, unendo le parole', () => {
    expect(normalizzaTesto('start-up')).toBe('startup');
    expect(normalizzaTesto('start up')).toBe('startup');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run normalizzaTesto`
Expected: FAIL — `./normalizzaTesto` does not exist.

- [ ] **Step 3: Create `dashboard/src/lib/normalizzaTesto.ts`**

```ts
export function normalizzaTesto(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-\s]+/g, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run normalizzaTesto`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test — `dashboard/src/lib/keywords.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { PAROLE_CHIAVE } from './keywords';

describe('PAROLE_CHIAVE', () => {
  it('è un array non vuoto di stringhe', () => {
    expect(Array.isArray(PAROLE_CHIAVE)).toBe(true);
    expect(PAROLE_CHIAVE.length).toBeGreaterThan(0);
    expect(PAROLE_CHIAVE.every((k) => typeof k === 'string')).toBe(true);
  });

  it('include parole sia di livello1 che di livello2', () => {
    expect(PAROLE_CHIAVE).toContain('gaming');
    expect(PAROLE_CHIAVE).toContain('startup');
  });

  it('non contiene duplicati', () => {
    expect(new Set(PAROLE_CHIAVE).size).toBe(PAROLE_CHIAVE.length);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd dashboard && npx vitest run keywords`
Expected: FAIL — `./keywords` does not exist.

- [ ] **Step 7: Create `dashboard/src/lib/keywords.ts`**

```ts
import keywordsJson from '../../../config/keywords.json';

interface KeywordsConfig {
  livello1: string[];
  livello2: string[];
}

const { livello1, livello2 } = keywordsJson as KeywordsConfig;

export const PAROLE_CHIAVE: string[] = [...new Set([...livello1, ...livello2])];
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd dashboard && npx vitest run keywords`
Expected: PASS (3 tests)

- [ ] **Step 9: Write the failing test — `dashboard/src/lib/sources.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { FONTI_ATTIVE } from './sources';

describe('FONTI_ATTIVE', () => {
  it('è un array non vuoto di stringhe', () => {
    expect(Array.isArray(FONTI_ATTIVE)).toBe(true);
    expect(FONTI_ATTIVE.length).toBeGreaterThan(0);
  });

  it('include le fonti attive note', () => {
    expect(FONTI_ATTIVE).toContain('eit');
    expect(FONTI_ATTIVE).toContain('regione-lombardia');
  });

  it('esclude le fonti non attive', () => {
    expect(FONTI_ATTIVE).not.toContain('slot-personalizzato');
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd dashboard && npx vitest run sources`
Expected: FAIL — `./sources` does not exist.

- [ ] **Step 11: Create `dashboard/src/lib/sources.ts`**

```ts
import sourcesJson from '../../../config/sources.json';

interface FonteConfig {
  id: string;
  attivo: boolean;
}

interface SourcesConfig {
  fonti: FonteConfig[];
}

const { fonti } = sourcesJson as SourcesConfig;

export const FONTI_ATTIVE: string[] = fonti.filter((f) => f.attivo).map((f) => f.id);
```

- [ ] **Step 12: Run test to verify it passes**

Run: `cd dashboard && npx vitest run sources`
Expected: PASS (3 tests)

- [ ] **Step 13: Run typecheck and build to confirm the cross-directory JSON imports resolve in production**

Run: `cd dashboard && npx tsc --noEmit && npm run build`
Expected: both succeed with no errors (this exact technique — importing `config/*.json` from `dashboard/src/lib/` via `../../../` — was empirically verified against the real Vite production build before this plan was written; if it unexpectedly fails here, STOP and report BLOCKED rather than working around it, since it means something changed).

- [ ] **Step 14: Commit**

```bash
git add dashboard/src/lib/normalizzaTesto.ts dashboard/src/lib/normalizzaTesto.test.ts dashboard/src/lib/keywords.ts dashboard/src/lib/keywords.test.ts dashboard/src/lib/sources.ts dashboard/src/lib/sources.test.ts
git commit -m "feat(dashboard): add keyword/source config readers and text normalization"
```

---

### Task 2: Estendere FiltriStato e applicaFiltri (parole chiave, direzione ordinamento)

**Files:**
- Modify: `dashboard/src/lib/filtriBandi.ts`
- Modify: `dashboard/src/lib/filtriBandi.test.ts`

**Interfaces:**
- Consumes: `normalizzaTesto` from `./normalizzaTesto` (Task 1).
- Produces: `FiltriStato` grows two fields: `paroleChiave: string[]` and `direzioneOrdinamento: 'crescente' | 'decrescente'`. `applicaFiltri(bandi, filtri)` keeps its exact same signature and return type. Consumed by Task 3 (persistence), Task 4 (FiltriBar), Task 6 (ListaBandi).

- [ ] **Step 1: Write the failing tests — extend `dashboard/src/lib/filtriBandi.test.ts`**

Replace the file's `filtriBase` constant and add these new test cases (keep every existing test in the file as-is — only the `filtriBase` shape needs updating everywhere it's used, and the new tests are additive):

```ts
const filtriBase: FiltriStato = {
  priorita: 'tutti',
  fonti: [],
  paroleChiave: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
  direzioneOrdinamento: 'decrescente',
};
```

Add these new `describe` blocks at the end of the file:

```ts
describe('applicaFiltri — parole chiave', () => {
  it('non filtra nulla se nessuna parola chiave è selezionata', () => {
    const bandi = [creaBando({ id: '1', titolo: 'Bando gaming' }), creaBando({ id: '2', titolo: 'Altro bando' })];
    expect(applicaFiltri(bandi, filtriBase).map((b) => b.id)).toEqual(['1', '2']);
  });

  it('filtra per una singola parola chiave (case/accenti/trattini insensibili)', () => {
    const bandi = [
      creaBando({ id: '1', titolo: 'Bando START-UP innovative' }),
      creaBando({ id: '2', titolo: 'Bando qualsiasi' }),
    ];
    const risultato = applicaFiltri(bandi, { ...filtriBase, paroleChiave: ['startup'] });
    expect(risultato.map((b) => b.id)).toEqual(['1']);
  });

  it('con più parole chiave selezionate richiede che siano tutte presenti (AND)', () => {
    const bandi = [
      creaBando({ id: '1', titolo: 'Bando gaming e startup insieme' }),
      creaBando({ id: '2', titolo: 'Bando solo gaming' }),
      creaBando({ id: '3', titolo: 'Bando solo startup' }),
    ];
    const risultato = applicaFiltri(bandi, { ...filtriBase, paroleChiave: ['gaming', 'startup'] });
    expect(risultato.map((b) => b.id)).toEqual(['1']);
  });

  it('cerca anche nella descrizione, non solo nel titolo', () => {
    const bandi = [creaBando({ id: '1', titolo: 'Bando X', descrizione: 'per il settore gaming' })];
    const risultato = applicaFiltri(bandi, { ...filtriBase, paroleChiave: ['gaming'] });
    expect(risultato.map((b) => b.id)).toEqual(['1']);
  });
});

describe('applicaFiltri — direzione ordinamento', () => {
  it('data_pubblicazione crescente mostra prima i più vecchi', () => {
    const bandi = [
      creaBando({ id: '1', data_pubblicazione: '2026-01-01' }),
      creaBando({ id: '2', data_pubblicazione: '2026-03-01' }),
    ];
    const risultato = applicaFiltri(bandi, { ...filtriBase, direzioneOrdinamento: 'crescente' });
    expect(risultato.map((b) => b.id)).toEqual(['1', '2']);
  });

  it('scadenza decrescente mostra prima le più lontane', () => {
    const bandi = [
      creaBando({ id: '1', scadenza: '2026-06-01' }),
      creaBando({ id: '2', scadenza: '2026-03-01' }),
    ];
    const risultato = applicaFiltri(bandi, {
      ...filtriBase,
      ordinamento: 'scadenza',
      direzioneOrdinamento: 'decrescente',
    });
    expect(risultato.map((b) => b.id)).toEqual(['1', '2']);
  });
});
```

Also update the two pre-existing sort tests (`'ordina per data_pubblicazione dal più recente...'` and `'ordina per scadenza dalla più vicina...'`) to pass `direzioneOrdinamento: 'decrescente'` and `direzioneOrdinamento: 'crescente'` respectively via `filtriBase` spread — since `filtriBase` already carries `direzioneOrdinamento: 'decrescente'` and the scadenza test already overrides `ordinamento: 'scadenza'`, add `direzioneOrdinamento: 'crescente'` to that one test's override object.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd dashboard && npx vitest run filtriBandi`
Expected: FAIL — `paroleChiave`/`direzioneOrdinamento` don't exist on `FiltriStato`, TypeScript errors.

- [ ] **Step 3: Update `dashboard/src/lib/filtriBandi.ts`**

```ts
import type { Bando, Priorita } from './types';
import { normalizzaTesto } from './normalizzaTesto';

export interface FiltriStato {
  priorita: Priorita | 'tutti';
  fonti: string[];
  paroleChiave: string[];
  ricerca: string;
  ordinamento: 'data_pubblicazione' | 'scadenza';
  direzioneOrdinamento: 'crescente' | 'decrescente';
}

function confrontaConNullInFondo(valoreA: string | null, valoreB: string | null, ascendente: boolean): number {
  if (!valoreA && !valoreB) return 0;
  if (!valoreA) return 1;
  if (!valoreB) return -1;
  return ascendente ? valoreA.localeCompare(valoreB) : valoreB.localeCompare(valoreA);
}

export function applicaFiltri(bandi: Bando[], filtri: FiltriStato): Bando[] {
  let risultato = bandi;

  if (filtri.priorita !== 'tutti') {
    risultato = risultato.filter((b) => b.priorita === filtri.priorita);
  }

  if (filtri.fonti.length > 0) {
    risultato = risultato.filter((b) => filtri.fonti.includes(b.fonte));
  }

  if (filtri.paroleChiave.length > 0) {
    risultato = risultato.filter((b) => {
      const testoNormalizzato = normalizzaTesto(`${b.titolo} ${b.descrizione}`);
      return filtri.paroleChiave.every((parola) => testoNormalizzato.includes(normalizzaTesto(parola)));
    });
  }

  const query = filtri.ricerca.trim().toLowerCase();
  if (query !== '') {
    risultato = risultato.filter(
      (b) => b.titolo.toLowerCase().includes(query) || b.descrizione.toLowerCase().includes(query)
    );
  }

  const ascendente = filtri.direzioneOrdinamento === 'crescente';
  return [...risultato].sort((a, b) =>
    filtri.ordinamento === 'scadenza'
      ? confrontaConNullInFondo(a.scadenza, b.scadenza, ascendente)
      : confrontaConNullInFondo(a.data_pubblicazione, b.data_pubblicazione, ascendente)
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run filtriBandi`
Expected: PASS (all tests, including the pre-existing ones and the new ones — 13 total)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/filtriBandi.ts dashboard/src/lib/filtriBandi.test.ts
git commit -m "feat(dashboard): add keyword AND-filter and explicit sort direction to applicaFiltri"
```

---

### Task 3: Persistenza filtri in localStorage

**Files:**
- Create: `dashboard/src/lib/persistenzaFiltri.ts`
- Test: `dashboard/src/lib/persistenzaFiltri.test.ts`

**Interfaces:**
- Consumes: `FiltriStato` from `./filtriBandi` (Task 2).
- Produces: `CHIAVE_LOCALSTORAGE = 'qyros-dashboard-filtri'`, `salvaFiltri(filtri: FiltriStato): void`, `caricaFiltriSalvati(): FiltriStato | null`. Consumed by Task 6 (`ListaBandi.tsx`).

- [ ] **Step 1: Write the failing test — `dashboard/src/lib/persistenzaFiltri.test.ts`**

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { CHIAVE_LOCALSTORAGE, caricaFiltriSalvati, salvaFiltri } from './persistenzaFiltri';
import type { FiltriStato } from './filtriBandi';

const filtriEsempio: FiltriStato = {
  priorita: 'alta',
  fonti: ['eit'],
  paroleChiave: ['gaming'],
  ricerca: 'test',
  ordinamento: 'scadenza',
  direzioneOrdinamento: 'crescente',
};

describe('persistenzaFiltri', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('salvaFiltri seguito da caricaFiltriSalvati restituisce lo stesso oggetto', () => {
    salvaFiltri(filtriEsempio);
    expect(caricaFiltriSalvati()).toEqual(filtriEsempio);
  });

  it('caricaFiltriSalvati restituisce null se non c\'è nulla di salvato', () => {
    expect(caricaFiltriSalvati()).toBeNull();
  });

  it('caricaFiltriSalvati restituisce null se il dato salvato non è JSON valido', () => {
    localStorage.setItem(CHIAVE_LOCALSTORAGE, 'non è json{{{');
    expect(caricaFiltriSalvati()).toBeNull();
  });

  it('caricaFiltriSalvati restituisce null se il dato salvato ha una forma inaspettata', () => {
    localStorage.setItem(CHIAVE_LOCALSTORAGE, JSON.stringify({ qualcosa: 'altro' }));
    expect(caricaFiltriSalvati()).toBeNull();
  });

  it('caricaFiltriSalvati restituisce null se manca un campo obbligatorio', () => {
    const incompleto = { ...filtriEsempio } as Partial<FiltriStato>;
    delete incompleto.direzioneOrdinamento;
    localStorage.setItem(CHIAVE_LOCALSTORAGE, JSON.stringify(incompleto));
    expect(caricaFiltriSalvati()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run persistenzaFiltri`
Expected: FAIL — `./persistenzaFiltri` does not exist.

- [ ] **Step 3: Create `dashboard/src/lib/persistenzaFiltri.ts`**

```ts
import type { FiltriStato } from './filtriBandi';

export const CHIAVE_LOCALSTORAGE = 'qyros-dashboard-filtri';

const PRIORITA_VALIDE = ['tutti', 'alta', 'da_verificare'];
const ORDINAMENTI_VALIDI = ['data_pubblicazione', 'scadenza'];
const DIREZIONI_VALIDE = ['crescente', 'decrescente'];

function eFiltriStatoValido(valore: unknown): valore is FiltriStato {
  if (typeof valore !== 'object' || valore === null) return false;
  const v = valore as Record<string, unknown>;

  return (
    typeof v.priorita === 'string' &&
    PRIORITA_VALIDE.includes(v.priorita) &&
    Array.isArray(v.fonti) &&
    v.fonti.every((f) => typeof f === 'string') &&
    Array.isArray(v.paroleChiave) &&
    v.paroleChiave.every((p) => typeof p === 'string') &&
    typeof v.ricerca === 'string' &&
    typeof v.ordinamento === 'string' &&
    ORDINAMENTI_VALIDI.includes(v.ordinamento) &&
    typeof v.direzioneOrdinamento === 'string' &&
    DIREZIONI_VALIDE.includes(v.direzioneOrdinamento)
  );
}

export function salvaFiltri(filtri: FiltriStato): void {
  localStorage.setItem(CHIAVE_LOCALSTORAGE, JSON.stringify(filtri));
}

export function caricaFiltriSalvati(): FiltriStato | null {
  const grezzo = localStorage.getItem(CHIAVE_LOCALSTORAGE);
  if (!grezzo) return null;

  try {
    const parsato: unknown = JSON.parse(grezzo);
    return eFiltriStatoValido(parsato) ? parsato : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run persistenzaFiltri`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/persistenzaFiltri.ts dashboard/src/lib/persistenzaFiltri.test.ts
git commit -m "feat(dashboard): add filter state persistence to localStorage"
```

---

### Task 4: FiltriBar — parole chiave richiudibili e direzione ordinamento

**Files:**
- Modify: `dashboard/src/components/FiltriBar.tsx`
- Modify: `dashboard/src/components/FiltriBar.test.tsx`

**Interfaces:**
- Consumes: `PAROLE_CHIAVE` from `../lib/keywords` (Task 1), updated `FiltriStato` from `../lib/filtriBandi` (Task 2).
- Produces: `FiltriBar` keeps the same props signature (`FiltriBarProps` unchanged — `filtri`, `fontiDisponibili`, `onCambiaFiltri`); internal rendering changes only.

- [ ] **Step 1: Write the failing tests — extend `dashboard/src/components/FiltriBar.test.tsx`**

Update the file's `filtriBase` constant to match Task 2's new shape:

```tsx
const filtriBase: FiltriStato = {
  priorita: 'tutti',
  fonti: [],
  paroleChiave: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
  direzioneOrdinamento: 'decrescente',
};
```

Note: this task's `FiltriBar` still takes only its current three props (`filtri`, `fontiDisponibili`, `onCambiaFiltri`) — Task 6 adds a fourth (`conteggiPriorita`) and will replace this whole test file's content wholesale at that point, updating every `render()` call in one pass. Don't add `conteggiPriorita` here.

Add these new tests at the end of the file:

```tsx
it('la sezione parole chiave è chiusa di default e si apre al tap', async () => {
  const utente = userEvent.setup();
  render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit']} onCambiaFiltri={vi.fn()} />);

  expect(screen.queryByRole('button', { name: 'gaming' })).not.toBeInTheDocument();
  await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
  expect(screen.getByRole('button', { name: 'gaming' })).toBeInTheDocument();
});

it('chiama onCambiaFiltri con la parola chiave selezionata', async () => {
  const utente = userEvent.setup();
  const onCambiaFiltri = vi.fn();
  render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit']} onCambiaFiltri={onCambiaFiltri} />);

  await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
  await utente.click(screen.getByRole('button', { name: 'gaming' }));
  expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, paroleChiave: ['gaming'] });
});

it('deseleziona una parola chiave già selezionata', async () => {
  const utente = userEvent.setup();
  const onCambiaFiltri = vi.fn();
  const filtriConParola = { ...filtriBase, paroleChiave: ['gaming'] };
  render(<FiltriBar filtri={filtriConParola} fontiDisponibili={['eit']} onCambiaFiltri={onCambiaFiltri} />);

  await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
  await utente.click(screen.getByRole('button', { name: 'gaming' }));
  expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, paroleChiave: [] });
});

it('chiama onCambiaFiltri con la direzione invertita quando si clicca il pulsante di direzione', async () => {
  const utente = userEvent.setup();
  const onCambiaFiltri = vi.fn();
  render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit']} onCambiaFiltri={onCambiaFiltri} />);

  await utente.click(screen.getByLabelText(/inverti direzione ordinamento/i));
  expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, direzioneOrdinamento: 'crescente' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run FiltriBar`
Expected: FAIL — new controls don't exist yet, `filtriBase` type errors on missing fields.

- [ ] **Step 3: Update `dashboard/src/components/FiltriBar.tsx`**

```tsx
import { useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Checkbox,
  type SelectChangeEvent,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { FiltriStato } from '../lib/filtriBandi';
import { PAROLE_CHIAVE } from '../lib/keywords';

export interface FiltriBarProps {
  filtri: FiltriStato;
  fontiDisponibili: string[];
  onCambiaFiltri: (filtri: FiltriStato) => void;
}

export function FiltriBar({ filtri, fontiDisponibili, onCambiaFiltri }: FiltriBarProps) {
  const [paroleChiaveAperte, setParoleChiaveAperte] = useState(false);

  function gestisciCambioFonti(evento: SelectChangeEvent<string[]>) {
    const valore = evento.target.value;
    onCambiaFiltri({ ...filtri, fonti: typeof valore === 'string' ? valore.split(',') : valore });
  }

  function gestisciToggleParolaChiave(parola: string) {
    const attiva = filtri.paroleChiave.includes(parola);
    const nuoveParole = attiva
      ? filtri.paroleChiave.filter((p) => p !== parola)
      : [...filtri.paroleChiave, parola];
    onCambiaFiltri({ ...filtri, paroleChiave: nuoveParole });
  }

  function gestisciInversioneDirezione() {
    onCambiaFiltri({
      ...filtri,
      direzioneOrdinamento: filtri.direzioneOrdinamento === 'crescente' ? 'decrescente' : 'crescente',
    });
  }

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: 'background.default',
        py: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <TextField
        placeholder="Cerca per titolo o descrizione..."
        value={filtri.ricerca}
        onChange={(e) => onCambiaFiltri({ ...filtri, ricerca: e.target.value })}
        fullWidth
        size="small"
      />

      <ToggleButtonGroup
        value={filtri.priorita}
        exclusive
        onChange={(_e, valore) => valore && onCambiaFiltri({ ...filtri, priorita: valore })}
        size="small"
        sx={{ flexWrap: 'wrap' }}
      >
        <ToggleButton value="tutti" sx={{ minHeight: 44 }}>
          Tutti
        </ToggleButton>
        <ToggleButton value="alta" sx={{ minHeight: 44 }}>
          Match diretto
        </ToggleButton>
        <ToggleButton value="da_verificare" sx={{ minHeight: 44 }}>
          Da verificare
        </ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
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

        <FormControl size="small" sx={{ minWidth: 180, flex: 1 }}>
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
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          {filtri.direzioneOrdinamento === 'crescente' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
        </IconButton>
      </Box>

      <Box>
        <Box
          component="button"
          type="button"
          onClick={() => setParoleChiaveAperte((aperto) => !aperto)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: 'transparent',
            border: 'none',
            color: 'text.secondary',
            cursor: 'pointer',
            p: 1,
            minHeight: 44,
          }}
        >
          <Typography variant="body2">
            Parole chiave{filtri.paroleChiave.length > 0 ? ` (${filtri.paroleChiave.length})` : ''}
          </Typography>
          <ExpandMoreIcon
            fontSize="small"
            sx={{ transform: paroleChiaveAperte ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
          />
        </Box>
        <Collapse in={paroleChiaveAperte}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, pt: 1 }}>
            {PAROLE_CHIAVE.map((parola) => (
              <Chip
                key={parola}
                label={parola}
                clickable
                onClick={() => gestisciToggleParolaChiave(parola)}
                color={filtri.paroleChiave.includes(parola) ? 'primary' : 'default'}
                sx={{ minHeight: 44 }}
              />
            ))}
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run FiltriBar`
Expected: PASS (all tests — 8 total)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/FiltriBar.tsx dashboard/src/components/FiltriBar.test.tsx
git commit -m "feat(dashboard): add collapsible keyword chip filter and sort direction toggle to FiltriBar"
```

---

### Task 5: BandoCard — badge countdown scadenza

**Files:**
- Modify: `dashboard/src/components/BandoCard.tsx`
- Modify: `dashboard/src/components/BandoCard.test.tsx`

**Interfaces:**
- Produces: `BandoCard` keeps its exact same props (`BandoCardProps` unchanged). New internal helper `calcolaGiorniAllaScadenza(scadenza: string, oggi: Date): number` is not exported — kept local to the component file since nothing else needs it.

- [ ] **Step 1: Write the failing tests — add to `dashboard/src/components/BandoCard.test.tsx`**

Add this local-date helper at the top of the test file (below the imports) — building the ISO string from local date components, not `toISOString()`, which converts to UTC and can land on the wrong calendar day near midnight in non-UTC timezones (the countdown logic itself compares local calendar dates, so the test must construct dates the same way):

```tsx
function dataLocaleISO(data: Date): string {
  const anno = data.getFullYear();
  const mese = String(data.getMonth() + 1).padStart(2, '0');
  const giorno = String(data.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}
```

Then add these tests:

```tsx
it('mostra il conto alla rovescia per una scadenza futura', () => {
  const tra20Giorni = new Date();
  tra20Giorni.setDate(tra20Giorni.getDate() + 20);
  const scadenza = dataLocaleISO(tra20Giorni);

  render(<BandoCard bando={creaBando({ scadenza })} onCambiaStato={vi.fn()} />);
  expect(screen.getByText('20 giorni alla scadenza')).toBeInTheDocument();
});

it('mostra "Scaduto" per una scadenza passata', () => {
  const ieri = new Date();
  ieri.setDate(ieri.getDate() - 1);
  const scadenza = dataLocaleISO(ieri);

  render(<BandoCard bando={creaBando({ scadenza })} onCambiaStato={vi.fn()} />);
  expect(screen.getByText('Scaduto')).toBeInTheDocument();
});

it('non mostra alcun badge di conto alla rovescia quando la scadenza è null', () => {
  render(<BandoCard bando={creaBando({ scadenza: null })} onCambiaStato={vi.fn()} />);
  expect(screen.queryByText(/alla scadenza/i)).not.toBeInTheDocument();
  expect(screen.queryByText('Scaduto')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run BandoCard`
Expected: FAIL — countdown text not present.

- [ ] **Step 3: Update `dashboard/src/components/BandoCard.tsx`**

```tsx
import { Box, Button, Card, CardContent, Chip, Link, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import type { Bando } from '../lib/types';

export interface BandoCardProps {
  bando: Bando;
  onCambiaStato: (id: string, nuovoStato: 'visto' | 'nuovo') => void;
}

const MILLISECONDI_AL_GIORNO = 1000 * 60 * 60 * 24;
const SOGLIA_GIORNI_ALLARME = 30;

function formattaData(data: string): string {
  const [anno, mese, giorno] = data.split('-');
  return `${giorno}/${mese}/${anno}`;
}

function calcolaGiorniAllaScadenza(scadenza: string, oggi: Date): number {
  const [anno, mese, giorno] = scadenza.split('-').map(Number);
  const dataScadenza = new Date(anno, mese - 1, giorno);
  const inizioOggi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  return Math.round((dataScadenza.getTime() - inizioOggi.getTime()) / MILLISECONDI_AL_GIORNO);
}

export function BandoCard({ bando, onCambiaStato }: BandoCardProps) {
  const eVisto = bando.stato === 'visto';
  const eAlta = bando.priorita === 'alta';
  const giorniAllaScadenza = bando.scadenza ? calcolaGiorniAllaScadenza(bando.scadenza, new Date()) : null;
  const eInAllarme = giorniAllaScadenza !== null && giorniAllaScadenza < SOGLIA_GIORNI_ALLARME;

  return (
    <Card sx={{ opacity: eVisto ? 0.6 : 1, transition: 'opacity 0.2s ease', height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Chip
            label={eAlta ? 'Match diretto' : 'Da verificare'}
            size="small"
            sx={{
              bgcolor: eAlta ? 'primary.main' : 'secondary.main',
              color: '#ffffff',
              fontWeight: 600,
            }}
          />
          <Button
            size="small"
            startIcon={eVisto ? <VisibilityOffIcon /> : <VisibilityIcon />}
            onClick={() => onCambiaStato(bando.id, eVisto ? 'nuovo' : 'visto')}
            sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
          >
            {eVisto ? 'Segna come nuovo' : 'Segna come visto'}
          </Button>
        </Box>

        <Typography variant="h6" component="h3" sx={{ mt: 1.5 }}>
          {bando.titolo}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {bando.fonte}
          {bando.scadenza && ` · scadenza ${formattaData(bando.scadenza)}`}
        </Typography>

        {giorniAllaScadenza !== null && (
          <Chip
            label={giorniAllaScadenza < 0 ? 'Scaduto' : `${giorniAllaScadenza} giorni alla scadenza`}
            size="small"
            sx={{
              mt: 1,
              bgcolor: eInAllarme ? 'error.main' : 'action.selected',
              color: eInAllarme ? '#ffffff' : 'text.primary',
            }}
          />
        )}

        <Box>
          <Link
            href={bando.url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1.5, minHeight: 44 }}
          >
            Vai al bando <OpenInNewIcon fontSize="small" />
          </Link>
        </Box>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run BandoCard`
Expected: PASS (all tests — 10 total)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/BandoCard.tsx dashboard/src/components/BandoCard.test.tsx
git commit -m "feat(dashboard): add deadline countdown badge to BandoCard"
```

---

### Task 6: ListaBandi — fonti statiche, contatori priorità, persistenza filtri

**Files:**
- Modify: `dashboard/src/components/ListaBandi.tsx`
- Modify: `dashboard/src/components/ListaBandi.test.tsx`
- Modify: `dashboard/src/components/FiltriBar.tsx`

**Interfaces:**
- Consumes: `FONTI_ATTIVE` from `../lib/sources` (Task 1), `salvaFiltri`/`caricaFiltriSalvati` from `../lib/persistenzaFiltri` (Task 3).
- Produces: `FiltriBarProps` grows one new optional-in-spirit-but-always-passed field: `conteggiPriorita: { tutti: number; alta: number; da_verificare: number }`. `ListaBandi` keeps no props (still a zero-prop component).

- [ ] **Step 1: Write the failing tests — replace the entire content of `dashboard/src/components/FiltriBar.test.tsx`**

This replaces the whole file (built on Task 4's version, with `conteggiPriorita` added to every `render()` call plus one new test for the counters themselves):

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiltriBar } from './FiltriBar';
import type { FiltriStato } from '../lib/filtriBandi';

const filtriBase: FiltriStato = {
  priorita: 'tutti',
  fonti: [],
  paroleChiave: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
  direzioneOrdinamento: 'decrescente',
};

const conteggiEsempio = { tutti: 5, alta: 2, da_verificare: 3 };

describe('FiltriBar', () => {
  it('chiama onCambiaFiltri con il testo di ricerca aggiornato', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(
      <FiltriBar
        filtri={filtriBase}
        fontiDisponibili={['eit']}
        conteggiPriorita={conteggiEsempio}
        onCambiaFiltri={onCambiaFiltri}
      />
    );

    await utente.type(screen.getByPlaceholderText(/cerca per titolo/i), 'g');
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, ricerca: 'g' });
  });

  it('chiama onCambiaFiltri quando si seleziona "Match diretto"', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(
      <FiltriBar
        filtri={filtriBase}
        fontiDisponibili={['eit']}
        conteggiPriorita={conteggiEsempio}
        onCambiaFiltri={onCambiaFiltri}
      />
    );

    await utente.click(screen.getByRole('button', { name: /match diretto/i }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, priorita: 'alta' });
  });

  it('permette di selezionare più fonti (multi-select)', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(
      <FiltriBar
        filtri={filtriBase}
        fontiDisponibili={['eit', 'invitalia']}
        conteggiPriorita={conteggiEsempio}
        onCambiaFiltri={onCambiaFiltri}
      />
    );

    await utente.click(screen.getByLabelText('Fonte'));
    await utente.click(await screen.findByRole('option', { name: 'eit' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, fonti: ['eit'] });
  });

  it('chiama onCambiaFiltri quando si cambia ordinamento a scadenza', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(
      <FiltriBar
        filtri={filtriBase}
        fontiDisponibili={['eit']}
        conteggiPriorita={conteggiEsempio}
        onCambiaFiltri={onCambiaFiltri}
      />
    );

    await utente.click(screen.getByLabelText('Ordina per'));
    await utente.click(await screen.findByRole('option', { name: 'Scadenza' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, ordinamento: 'scadenza' });
  });

  it('la sezione parole chiave è chiusa di default e si apre al tap', async () => {
    const utente = userEvent.setup();
    render(
      <FiltriBar
        filtri={filtriBase}
        fontiDisponibili={['eit']}
        conteggiPriorita={conteggiEsempio}
        onCambiaFiltri={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'gaming' })).not.toBeInTheDocument();
    await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
    expect(screen.getByRole('button', { name: 'gaming' })).toBeInTheDocument();
  });

  it('chiama onCambiaFiltri con la parola chiave selezionata', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(
      <FiltriBar
        filtri={filtriBase}
        fontiDisponibili={['eit']}
        conteggiPriorita={conteggiEsempio}
        onCambiaFiltri={onCambiaFiltri}
      />
    );

    await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
    await utente.click(screen.getByRole('button', { name: 'gaming' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, paroleChiave: ['gaming'] });
  });

  it('deseleziona una parola chiave già selezionata', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    const filtriConParola = { ...filtriBase, paroleChiave: ['gaming'] };
    render(
      <FiltriBar
        filtri={filtriConParola}
        fontiDisponibili={['eit']}
        conteggiPriorita={conteggiEsempio}
        onCambiaFiltri={onCambiaFiltri}
      />
    );

    await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
    await utente.click(screen.getByRole('button', { name: 'gaming' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, paroleChiave: [] });
  });

  it('chiama onCambiaFiltri con la direzione invertita quando si clicca il pulsante di direzione', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(
      <FiltriBar
        filtri={filtriBase}
        fontiDisponibili={['eit']}
        conteggiPriorita={conteggiEsempio}
        onCambiaFiltri={onCambiaFiltri}
      />
    );

    await utente.click(screen.getByLabelText(/inverti direzione ordinamento/i));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, direzioneOrdinamento: 'crescente' });
  });

  it('mostra i contatori sulle schede di priorità', () => {
    render(
      <FiltriBar
        filtri={filtriBase}
        fontiDisponibili={['eit']}
        conteggiPriorita={conteggiEsempio}
        onCambiaFiltri={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /tutti \(5\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /match diretto \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /da verificare \(3\)/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run FiltriBar`
Expected: FAIL — `conteggiPriorita` prop missing/unused, new test's text not found.

- [ ] **Step 3: Update `FiltriBarProps` and the three `ToggleButton` labels in `dashboard/src/components/FiltriBar.tsx`**

Add to the `FiltriBarProps` interface:

```tsx
export interface FiltriBarProps {
  filtri: FiltriStato;
  fontiDisponibili: string[];
  conteggiPriorita: { tutti: number; alta: number; da_verificare: number };
  onCambiaFiltri: (filtri: FiltriStato) => void;
}
```

Add `conteggiPriorita` to the destructured props: `export function FiltriBar({ filtri, fontiDisponibili, conteggiPriorita, onCambiaFiltri }: FiltriBarProps) {`.

Replace the three `ToggleButton` children:

```tsx
        <ToggleButton value="tutti" sx={{ minHeight: 44 }}>
          Tutti ({conteggiPriorita.tutti})
        </ToggleButton>
        <ToggleButton value="alta" sx={{ minHeight: 44 }}>
          Match diretto ({conteggiPriorita.alta})
        </ToggleButton>
        <ToggleButton value="da_verificare" sx={{ minHeight: 44 }}>
          Da verificare ({conteggiPriorita.da_verificare})
        </ToggleButton>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run FiltriBar`
Expected: PASS (all tests)

- [ ] **Step 5: Write the failing tests — extend `dashboard/src/components/ListaBandi.test.tsx`**

The existing tests in this file don't assert on the `fontiDisponibili` list directly, so nothing there needs changing. Add this new `describe` block at the end of the file (the existing mock Supabase setup and `creaBando` helper stay as-is; `localStorage` is real in jsdom, no mock needed — just clear it):

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
// ...(keep existing imports)

describe('ListaBandi — fonti e persistenza', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mostra tutte le fonti attive configurate, non solo quelle con bandi già trovati', async () => {
    datiFinti = [creaBando({ id: '1', fonte: 'eit' })];
    render(<ListaBandi />);
    await waitFor(() => expect(screen.getByText('Bando A')).toBeInTheDocument());

    const utente = userEvent.setup();
    await utente.click(screen.getByLabelText('Fonte'));
    expect(await screen.findByRole('option', { name: 'regione-lombardia' })).toBeInTheDocument();
  });

  it('ripristina i filtri salvati da una visita precedente', async () => {
    localStorage.setItem(
      'qyros-dashboard-filtri',
      JSON.stringify({
        priorita: 'alta',
        fonti: [],
        paroleChiave: [],
        ricerca: '',
        ordinamento: 'data_pubblicazione',
        direzioneOrdinamento: 'decrescente',
      })
    );
    datiFinti = [creaBando({ id: '1', titolo: 'Bando A', priorita: 'alta' }), creaBando({ id: '2', titolo: 'Bando B', priorita: 'da_verificare' })];

    render(<ListaBandi />);
    await waitFor(() => expect(screen.getByText('Bando A')).toBeInTheDocument());
    expect(screen.queryByText('Bando B')).not.toBeInTheDocument();
  });

  it('salva i filtri quando l\'utente li cambia', async () => {
    datiFinti = [creaBando({ id: '1', titolo: 'Bando A' })];
    render(<ListaBandi />);
    await waitFor(() => expect(screen.getByText('Bando A')).toBeInTheDocument());

    const utente = userEvent.setup();
    await utente.click(screen.getByRole('button', { name: /match diretto/i }));

    const salvato = JSON.parse(localStorage.getItem('qyros-dashboard-filtri') ?? '{}');
    expect(salvato.priorita).toBe('alta');
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run ListaBandi`
Expected: FAIL — fonti still derived dynamically, no persistence yet.

- [ ] **Step 7: Update `dashboard/src/components/ListaBandi.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { supabase } from '../lib/supabase';
import type { Bando } from '../lib/types';
import { BandoCard } from './BandoCard';
import { FiltriBar, type FiltriBarProps } from './FiltriBar';
import { applicaFiltri, type FiltriStato } from '../lib/filtriBandi';
import { FONTI_ATTIVE } from '../lib/sources';
import { caricaFiltriSalvati, salvaFiltri } from '../lib/persistenzaFiltri';

const FILTRI_DEFAULT: FiltriStato = {
  priorita: 'tutti',
  fonti: [],
  paroleChiave: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
  direzioneOrdinamento: 'decrescente',
};

export function ListaBandi() {
  const [bandi, setBandi] = useState<Bando[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<FiltriStato>(() => caricaFiltriSalvati() ?? FILTRI_DEFAULT);

  useEffect(() => {
    caricaBandi();
  }, []);

  async function caricaBandi() {
    setCaricamento(true);
    const { data, error } = await supabase
      .from('bandi')
      .select('id, fonte, titolo, descrizione, url, scadenza, data_pubblicazione, priorita, stato')
      .eq('scartato', false)
      .order('data_pubblicazione', { ascending: false });

    if (error) {
      setErrore(error.message);
    } else {
      setBandi((data ?? []) as Bando[]);
    }
    setCaricamento(false);
  }

  async function cambiaStato(id: string, nuovoStato: 'visto' | 'nuovo') {
    setBandi((precedenti) => precedenti.map((b) => (b.id === id ? { ...b, stato: nuovoStato } : b)));
    const { error } = await supabase.from('bandi').update({ stato: nuovoStato }).eq('id', id);
    if (error) {
      setErrore(error.message);
      caricaBandi();
    }
  }

  const bandiFiltrati = useMemo(() => applicaFiltri(bandi, filtri), [bandi, filtri]);

  const conteggiPriorita = useMemo(() => {
    const senzaPriorita = applicaFiltri(bandi, { ...filtri, priorita: 'tutti' });
    return {
      tutti: senzaPriorita.length,
      alta: senzaPriorita.filter((b) => b.priorita === 'alta').length,
      da_verificare: senzaPriorita.filter((b) => b.priorita === 'da_verificare').length,
    };
  }, [bandi, filtri]);

  const onCambiaFiltri: FiltriBarProps['onCambiaFiltri'] = (nuoviFiltri) => {
    setFiltri(nuoviFiltri);
    salvaFiltri(nuoviFiltri);
  };

  if (caricamento) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pb: 4 }}>
      <FiltriBar
        filtri={filtri}
        fontiDisponibili={FONTI_ATTIVE}
        conteggiPriorita={conteggiPriorita}
        onCambiaFiltri={onCambiaFiltri}
      />

      {errore && (
        <Typography color="error" sx={{ mt: 2 }}>
          {errore}
        </Typography>
      )}

      {bandiFiltrati.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          Nessun bando trovato con questi filtri.
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
            mt: 2,
          }}
        >
          {bandiFiltrati.map((bando) => (
            <BandoCard key={bando.id} bando={bando} onCambiaStato={cambiaStato} />
          ))}
        </Box>
      )}
    </Box>
  );
}
```

Note: `fontiDisponibili` is no longer derived from `bandi` — `FONTI_ATTIVE` is a static import, so the old `useMemo` for it is removed entirely (not left dead in the file).

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run ListaBandi`
Expected: PASS (all tests)

- [ ] **Step 9: Run the full suite, typecheck, and build**

Run: `cd dashboard && npm test && npx tsc --noEmit && npm run build`
Expected: all tests pass, typecheck clean, build succeeds.

- [ ] **Step 10: Commit**

```bash
git add dashboard/src/components/ListaBandi.tsx dashboard/src/components/ListaBandi.test.tsx dashboard/src/components/FiltriBar.tsx dashboard/src/components/FiltriBar.test.tsx
git commit -m "feat(dashboard): show all active sources, per-priority counts, and persist filters"
```

---

### Task 7: Verifica manuale nel browser e wrap-up

**Files:**
- Modify: `dashboard/README.md`

**Interfaces:**
- None — this is a verification and documentation task.

- [ ] **Step 1: Start the local dev server and manually verify every new behavior**

Run (from `dashboard/`): `npm run dev`, open the printed local URL.

Since the app requires a login, this task's manual check covers only what's visible/testable without a real Supabase session — the actual filtering behavior against real data gets its full live verification directly on the deployed site in Task 8's controller-led check (see below), same split as Fase 4a's Task 9. At minimum here, confirm: the app builds and starts without console errors, and the login screen still renders correctly (regression check — nothing in this phase should have touched auth).

- [ ] **Step 2: Update `dashboard/README.md`'s "Stato" section**

Replace the current "Stato Fase 4a" section's closing paragraph (the "Resta da fare (Fase 4b)..." paragraph, which is now stale since Fase 4b is complete) with:

```markdown
## Stato Fase 5

Aggiunti: filtro per parole chiave (selezione multipla, intersezione — un bando
deve contenere tutte le parole selezionate), elenco fonti sempre completo nel
filtro (letto da `config/sources.json`), direzione di ordinamento invertibile,
badge di conto alla rovescia sulla scadenza (con colore di allarme sotto i 30
giorni), contatori sulle schede di priorità, e filtri ricordati tra una visita e
l'altra tramite il browser. Nessuna nuova dipendenza esterna, nessuna modifica
allo scraper o al database.
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/README.md
git commit -m "docs(dashboard): update README for Fase 5"
```

---

## Fine Fase 5 — piano

Dopo l'esecuzione di tutti i task, la doppia verifica richiesta esplicitamente
dall'utente corrisponde a: la revisione a due stadi per ciascun task (già parte
del processo standard di questo progetto) più una revisione finale sull'intero
insieme delle modifiche prima del merge — esattamente come per la Fase 4a. La
verifica in un browser reale con dati reali (Task 8, fuori da questo piano,
eseguita interattivamente dopo il merge e il deploy) è la seconda, indipendente
passata di controllo: build, deploy, login reale, e collaudo di ciascuna delle
6 funzionalità nuove sui dati reali.
