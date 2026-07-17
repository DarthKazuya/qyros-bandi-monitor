# Fase 4a — Dashboard web (React + MUI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `dashboard/` React app — magic-link login, card list of bandi with priority badges, filters (priority/multi-source/free text), sort, and mark-as-seen — as a statically buildable, fully unit-tested app, ready for a GitHub Pages deploy workflow. No real Supabase network calls in the automated test suite.

**Architecture:** Vite + React 18 + TypeScript, MUI v6 (Material 3-styled via a custom QYROS theme), `@supabase/supabase-js` client-side using only the public anon key (protected by the RLS policies already created in `supabase/schema.sql`). Single-page app: an auth hook gates between `LoginScreen` (magic link) and `ListaBandi` (the authenticated view). No router — only two mutually-exclusive views.

**Tech Stack:** Vite 6, React 18, TypeScript 5, MUI 6 (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`), `@supabase/supabase-js`, Vitest + `@testing-library/react` + `@testing-library/user-event` + jsdom.

## Global Constraints

- Package lives in a new top-level `dashboard/` directory, sibling to `scraper/`, with its own `package.json` (not an npm workspace) — same convention as `scraper/`.
- Node version 22 (matches `scraper/`'s `.github/workflows/daily-job.yml` and `package.json` engine expectations).
- **No `.js` extensions on relative TS/TSX imports** in `dashboard/` — this project is bundled by Vite (not run via `tsx`/raw Node ESM like `scraper/`), so imports must be extensionless (e.g. `from './App'`, not `from './App.js'`). This deliberately differs from `scraper/`'s convention.
- **Zero real Supabase/network calls in the automated test suite** — every test that touches `../lib/supabase` must mock that module. This mirrors the "no real network calls" policy already enforced in `scraper/`.
- Theme: dark mode by default, background `#040a1b`; accent `#ff6500` (CTAs, "Match diretto" badge); secondary `#3c6a8b` (header, links, "Da verificare" badge). Light mode toggle available.
- Layout mobile-first: cards stacked on narrow screens, responsive grid on desktop; interactive touch targets ≥44px; no horizontal scroll.
- Bando card shows: titolo, fonte, priority badge, scadenza (if present), external link, "Segna come visto" / "Segna come nuovo" button (seen cards stay visible with dimmed style, not hidden).
- Filter bar: priorità (tutti / Match diretto / Da verificare, single-select), fonte (**multi-select**), free-text search, sort (data_pubblicazione by default, or scadenza).
- Auth: Supabase Auth magic link only, no public signup. RLS already restricts `select`/`update(stato)` on `bandi` to authenticated users (see `supabase/schema.sql`); the dashboard must never use the `service_role` key, only `VITE_SUPABASE_ANON_KEY`.
- `bandi` table columns available (from `supabase/schema.sql`): `id, fonte, titolo, descrizione, url, scadenza, data_pubblicazione, hash_contenuto, priorita, scartato, stato, primo_rilevamento, aggiornato_il`. The dashboard only ever queries rows where `scartato = false`.

---

### Task 1: Scaffold del progetto dashboard

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/vite.config.ts`
- Create: `dashboard/index.html`
- Create: `dashboard/.gitignore`
- Create: `dashboard/.env.example`
- Create: `dashboard/README.md`
- Create: `dashboard/src/main.tsx`
- Create: `dashboard/src/App.tsx`
- Create: `dashboard/src/test-setup.ts`
- Test: `dashboard/src/App.test.tsx`

**Interfaces:**
- Produces: a buildable, testable empty React app shell. `App` default-exports a component (placeholder content for this task; replaced in Task 8).

- [ ] **Step 1: Create `dashboard/package.json`**

```json
{
  "name": "qyros-bandi-monitor-dashboard",
  "private": true,
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@emotion/react": "^11.13.5",
    "@emotion/styled": "^11.13.5",
    "@mui/icons-material": "^6.1.9",
    "@mui/material": "^6.1.9",
    "@supabase/supabase-js": "^2.47.10",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.17",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `dashboard/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `dashboard/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/qyros-bandi-monitor/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
```

- [ ] **Step 4: Create `dashboard/index.html`**

```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>QYROS Bandi Monitor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `dashboard/.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 6: Create `dashboard/.env.example`**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

- [ ] **Step 7: Create `dashboard/README.md`**

```markdown
# QYROS Bandi Monitor — dashboard

## Comandi disponibili

- `npm install` — installa le dipendenze
- `cp .env.example .env` poi modifica `.env` con l'URL e la chiave `anon` reali del
  progetto Supabase (Project Settings → API) — necessario per `npm run dev`
- `npm run dev` — avvia il server di sviluppo locale
- `npm test` — esegue tutti i test automatici (nessuna chiamata di rete reale)
- `npm run typecheck` — verifica i tipi TypeScript
- `npm run build` — crea la build statica di produzione in `dist/`

## Stato Fase 4a

App scaffolded e componenti principali (login, lista bandi, filtri, card) implementati
e testati. Il deploy reale su GitHub Pages e la configurazione dell'autenticazione
Supabase arrivano in Fase 4b.
```

- [ ] **Step 8: Create `dashboard/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 9: Write the failing test — `dashboard/src/App.test.tsx`**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renderizza senza errori', () => {
    render(<App />);
    expect(screen.getByText(/QYROS Bandi Monitor/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run (from `dashboard/`): `npm install && npm test`
Expected: FAIL — `./App` has no default export / file does not exist.

- [ ] **Step 11: Create `dashboard/src/App.tsx` (placeholder, replaced in Task 8)**

```tsx
function App() {
  return <div>QYROS Bandi Monitor — dashboard in costruzione</div>;
}

export default App;
```

- [ ] **Step 12: Create `dashboard/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const elemento = document.getElementById('root');
if (!elemento) {
  throw new Error('Elemento #root non trovato in index.html');
}

createRoot(elemento).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 13: Run test to verify it passes**

Run: `npm test`
Expected: PASS (1 test)

- [ ] **Step 14: Verify the production build works**

Run: `npm run build`
Expected: completes with no errors, produces `dashboard/dist/index.html` and bundled assets.

- [ ] **Step 15: Commit**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/tsconfig.json dashboard/vite.config.ts dashboard/index.html dashboard/.gitignore dashboard/.env.example dashboard/README.md dashboard/src/test-setup.ts dashboard/src/App.tsx dashboard/src/App.test.tsx dashboard/src/main.tsx
git commit -m "feat(dashboard): scaffold Vite + React + MUI project"
```

---

### Task 2: Tema QYROS, tipi condivisi e client Supabase

**Files:**
- Create: `dashboard/src/theme.ts`
- Test: `dashboard/src/theme.test.ts`
- Create: `dashboard/src/lib/types.ts`
- Create: `dashboard/src/lib/supabase.ts`
- Test: `dashboard/src/lib/supabase.test.ts`

**Interfaces:**
- Produces: `creaTemaQyros(modalita: 'light' | 'dark'): Theme` (MUI theme). `Bando` type: `{ id: string; fonte: string; titolo: string; descrizione: string; url: string; scadenza: string | null; data_pubblicazione: string | null; priorita: 'alta' | 'da_verificare' | null; stato: 'nuovo' | 'visto' | 'scaduto' }`. `Priorita = 'alta' | 'da_verificare'`. `supabase` — a configured `SupabaseClient` singleton exported from `lib/supabase.ts`.

- [ ] **Step 1: Write the failing test — `dashboard/src/theme.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { creaTemaQyros } from './theme';

describe('creaTemaQyros', () => {
  it('usa il colore arancione QYROS come primario in entrambe le modalità', () => {
    expect(creaTemaQyros('dark').palette.primary.main).toBe('#ff6500');
    expect(creaTemaQyros('light').palette.primary.main).toBe('#ff6500');
  });

  it('usa il blu petrolio QYROS come secondario', () => {
    expect(creaTemaQyros('dark').palette.secondary.main).toBe('#3c6a8b');
  });

  it('usa lo sfondo scuro QYROS in dark mode', () => {
    expect(creaTemaQyros('dark').palette.background.default).toBe('#040a1b');
  });

  it('imposta la modalità richiesta', () => {
    expect(creaTemaQyros('dark').palette.mode).toBe('dark');
    expect(creaTemaQyros('light').palette.mode).toBe('light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- theme`
Expected: FAIL — `./theme` does not exist.

- [ ] **Step 3: Create `dashboard/src/theme.ts`**

```ts
import { createTheme, type Theme } from '@mui/material/styles';

const PALETTE_QYROS = {
  arancio: '#ff6500',
  bluPetrolio: '#3c6a8b',
  bluScuro: '#040a1b',
} as const;

export function creaTemaQyros(modalita: 'light' | 'dark'): Theme {
  const scuro = modalita === 'dark';

  return createTheme({
    palette: {
      mode: modalita,
      primary: { main: PALETTE_QYROS.arancio, contrastText: '#ffffff' },
      secondary: { main: PALETTE_QYROS.bluPetrolio, contrastText: '#ffffff' },
      background: {
        default: scuro ? PALETTE_QYROS.bluScuro : '#f5f6f8',
        paper: scuro ? '#0d1a38' : '#ffffff',
      },
      text: {
        primary: scuro ? '#f5f5f0' : PALETTE_QYROS.bluScuro,
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
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- theme`
Expected: PASS (4 tests)

- [ ] **Step 5: Create `dashboard/src/lib/types.ts`**

```ts
export type Priorita = 'alta' | 'da_verificare';
export type Stato = 'nuovo' | 'visto' | 'scaduto';

export interface Bando {
  id: string;
  fonte: string;
  titolo: string;
  descrizione: string;
  url: string;
  scadenza: string | null;
  data_pubblicazione: string | null;
  priorita: Priorita | null;
  stato: Stato;
}
```

- [ ] **Step 6: Write the failing test — `dashboard/src/lib/supabase.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('supabase client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('lancia un errore se VITE_SUPABASE_URL manca', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chiave-finta');
    await expect(import('./supabase')).rejects.toThrow(/VITE_SUPABASE_URL/);
  });

  it('lancia un errore se VITE_SUPABASE_ANON_KEY manca', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://esempio.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    await expect(import('./supabase')).rejects.toThrow(/VITE_SUPABASE_ANON_KEY/);
  });

  it('crea il client quando entrambe le variabili sono presenti', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://esempio.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chiave-finta');
    const modulo = await import('./supabase');
    expect(modulo.supabase).toBeTruthy();
    expect(modulo.supabase.auth).toBeDefined();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- supabase`
Expected: FAIL — `./supabase` does not exist.

- [ ] **Step 8: Create `dashboard/src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url) {
  throw new Error('VITE_SUPABASE_URL non è impostata (vedi .env.example)');
}
if (!anonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY non è impostata (vedi .env.example)');
}

export const supabase = createClient(url, anonKey);
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- supabase`
Expected: PASS (3 tests)

- [ ] **Step 10: Commit**

```bash
git add dashboard/src/theme.ts dashboard/src/theme.test.ts dashboard/src/lib/types.ts dashboard/src/lib/supabase.ts dashboard/src/lib/supabase.test.ts
git commit -m "feat(dashboard): add QYROS theme, shared types and Supabase client"
```

---

### Task 3: Hook di autenticazione

**Files:**
- Create: `dashboard/src/hooks/useAuth.ts`
- Test: `dashboard/src/hooks/useAuth.test.ts`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase` (`supabase.auth.getSession()`, `supabase.auth.onAuthStateChange()`).
- Produces: `useAuth(): { sessione: Session | null; caricamento: boolean }`, used by `App.tsx` (Task 8).

- [ ] **Step 1: Write the failing test — `dashboard/src/hooks/useAuth.test.ts`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

import { useAuth } from './useAuth';

describe('useAuth', () => {
  it('inizia con caricamento true e passa a false con sessione null se non c\'è nessuno collegato', async () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.caricamento).toBe(true);
    await waitFor(() => expect(result.current.caricamento).toBe(false));
    expect(result.current.sessione).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useAuth`
Expected: FAIL — `./useAuth` does not exist.

- [ ] **Step 3: Create `dashboard/src/hooks/useAuth.ts`**

```ts
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface StatoAutenticazione {
  sessione: Session | null;
  caricamento: boolean;
}

export function useAuth(): StatoAutenticazione {
  const [sessione, setSessione] = useState<Session | null>(null);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessione(data.session);
      setCaricamento(false);
    });

    const { data: sottoscrizione } = supabase.auth.onAuthStateChange((_evento, nuovaSessione) => {
      setSessione(nuovaSessione);
    });

    return () => sottoscrizione.subscription.unsubscribe();
  }, []);

  return { sessione, caricamento };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useAuth`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/hooks/useAuth.ts dashboard/src/hooks/useAuth.test.ts
git commit -m "feat(dashboard): add useAuth hook wrapping Supabase auth session"
```

---

### Task 4: Schermata di login

**Files:**
- Create: `dashboard/src/components/LoginScreen.tsx`
- Test: `dashboard/src/components/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: `supabase.auth.signInWithOtp({ email })` from `../lib/supabase`.
- Produces: `LoginScreen(): JSX.Element`, a component with no props, used by `App.tsx` (Task 8).

- [ ] **Step 1: Write the failing test — `dashboard/src/components/LoginScreen.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signInWithOtpFinto = vi.fn(async () => ({ error: null as { message: string } | null }));

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: (args: { email: string }) => signInWithOtpFinto(args) } },
}));

import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  it('mostra un messaggio di conferma dopo aver inviato il link', async () => {
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await utente.type(screen.getByLabelText('Email'), 'test@esempio.it');
    await utente.click(screen.getByRole('button', { name: /invia link di accesso/i }));

    await waitFor(() => expect(screen.getByText(/ti abbiamo inviato un link/i)).toBeInTheDocument());
    expect(signInWithOtpFinto).toHaveBeenCalledWith({ email: 'test@esempio.it' });
  });

  it('mostra un messaggio di errore se signInWithOtp fallisce', async () => {
    signInWithOtpFinto.mockResolvedValueOnce({ error: { message: 'Troppe richieste, riprova più tardi' } });
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await utente.type(screen.getByLabelText('Email'), 'test@esempio.it');
    await utente.click(screen.getByRole('button', { name: /invia link di accesso/i }));

    await waitFor(() => expect(screen.getByText('Troppe richieste, riprova più tardi')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- LoginScreen`
Expected: FAIL — `./LoginScreen` does not exist.

- [ ] **Step 3: Create `dashboard/src/components/LoginScreen.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { supabase } from '../lib/supabase';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [inviato, setInviato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [invioInCorso, setInvioInCorso] = useState(false);

  async function gestisciInvio(evento: FormEvent) {
    evento.preventDefault();
    setErrore(null);
    setInvioInCorso(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setInvioInCorso(false);
    if (error) {
      setErrore(error.message);
      return;
    }
    setInviato(true);
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            QYROS Bandi Monitor
          </Typography>
          {inviato ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              Ti abbiamo inviato un link di accesso a {email}. Apri l'email e clicca il
              link per entrare.
            </Alert>
          ) : (
            <Box component="form" onSubmit={gestisciInvio} sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Inserisci la tua email per ricevere un link di accesso.
              </Typography>
              <TextField
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                autoFocus
                sx={{ mb: 2 }}
              />
              {errore && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errore}
                </Alert>
              )}
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                disabled={invioInCorso}
                sx={{ minHeight: 44 }}
              >
                {invioInCorso ? 'Invio in corso...' : 'Invia link di accesso'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- LoginScreen`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/LoginScreen.tsx dashboard/src/components/LoginScreen.test.tsx
git commit -m "feat(dashboard): add magic-link login screen"
```

---

### Task 5: Card bando

**Files:**
- Create: `dashboard/src/components/BandoCard.tsx`
- Test: `dashboard/src/components/BandoCard.test.tsx`

**Interfaces:**
- Consumes: `Bando` type from `../lib/types`.
- Produces: `BandoCard({ bando: Bando; onCambiaStato: (id: string, nuovoStato: 'visto' | 'nuovo') => void }): JSX.Element`, used by `ListaBandi.tsx` (Task 7).

- [ ] **Step 1: Write the failing test — `dashboard/src/components/BandoCard.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BandoCard } from './BandoCard';
import type { Bando } from '../lib/types';

function creaBando(overrides: Partial<Bando> = {}): Bando {
  return {
    id: '1',
    fonte: 'eit',
    titolo: 'Bando di test',
    descrizione: 'Descrizione',
    url: 'https://esempio.it/bando-test',
    scadenza: '2026-12-31',
    data_pubblicazione: null,
    priorita: 'alta',
    stato: 'nuovo',
    ...overrides,
  };
}

describe('BandoCard', () => {
  it('mostra il badge "Match diretto" per priorita alta', () => {
    render(<BandoCard bando={creaBando({ priorita: 'alta' })} onCambiaStato={vi.fn()} />);
    expect(screen.getByText('Match diretto')).toBeInTheDocument();
  });

  it('mostra il badge "Da verificare" per priorita da_verificare', () => {
    render(<BandoCard bando={creaBando({ priorita: 'da_verificare' })} onCambiaStato={vi.fn()} />);
    expect(screen.getByText('Da verificare')).toBeInTheDocument();
  });

  it('mostra titolo, fonte e scadenza formattata in italiano', () => {
    render(<BandoCard bando={creaBando({ titolo: 'Bando gaming 2026', fonte: 'eit', scadenza: '2026-12-31' })} onCambiaStato={vi.fn()} />);
    expect(screen.getByText('Bando gaming 2026')).toBeInTheDocument();
    expect(screen.getByText(/eit/)).toBeInTheDocument();
    expect(screen.getByText(/31\/12\/2026/)).toBeInTheDocument();
  });

  it('non mostra la scadenza quando è null', () => {
    render(<BandoCard bando={creaBando({ scadenza: null })} onCambiaStato={vi.fn()} />);
    expect(screen.queryByText(/scadenza/i)).not.toBeInTheDocument();
  });

  it('mostra un link al bando che apre in una nuova scheda', () => {
    render(<BandoCard bando={creaBando({ url: 'https://esempio.it/bando-test' })} onCambiaStato={vi.fn()} />);
    const link = screen.getByRole('link', { name: /vai al bando/i });
    expect(link).toHaveAttribute('href', 'https://esempio.it/bando-test');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('chiama onCambiaStato con "visto" quando si clicca su un bando nuovo', async () => {
    const utente = userEvent.setup();
    const onCambiaStato = vi.fn();
    render(<BandoCard bando={creaBando({ id: '1', stato: 'nuovo' })} onCambiaStato={onCambiaStato} />);

    await utente.click(screen.getByRole('button', { name: /segna come visto/i }));
    expect(onCambiaStato).toHaveBeenCalledWith('1', 'visto');
  });

  it('chiama onCambiaStato con "nuovo" quando si clicca su un bando già visto', async () => {
    const utente = userEvent.setup();
    const onCambiaStato = vi.fn();
    render(<BandoCard bando={creaBando({ id: '1', stato: 'visto' })} onCambiaStato={onCambiaStato} />);

    await utente.click(screen.getByRole('button', { name: /segna come nuovo/i }));
    expect(onCambiaStato).toHaveBeenCalledWith('1', 'nuovo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- BandoCard`
Expected: FAIL — `./BandoCard` does not exist.

- [ ] **Step 3: Create `dashboard/src/components/BandoCard.tsx`**

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

function formattaData(data: string): string {
  const [anno, mese, giorno] = data.split('-');
  return `${giorno}/${mese}/${anno}`;
}

export function BandoCard({ bando, onCambiaStato }: BandoCardProps) {
  const eVisto = bando.stato === 'visto';
  const eAlta = bando.priorita === 'alta';

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

        <Link
          href={bando.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1.5, minHeight: 44 }}
        >
          Vai al bando <OpenInNewIcon fontSize="small" />
        </Link>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- BandoCard`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/BandoCard.tsx dashboard/src/components/BandoCard.test.tsx
git commit -m "feat(dashboard): add BandoCard component"
```

---

### Task 6: Logica filtri e barra filtri

**Files:**
- Create: `dashboard/src/lib/filtriBandi.ts`
- Test: `dashboard/src/lib/filtriBandi.test.ts`
- Create: `dashboard/src/components/FiltriBar.tsx`
- Test: `dashboard/src/components/FiltriBar.test.tsx`

**Interfaces:**
- Consumes: `Bando`, `Priorita` from `../lib/types`.
- Produces: `FiltriStato = { priorita: Priorita | 'tutti'; fonti: string[]; ricerca: string; ordinamento: 'data_pubblicazione' | 'scadenza' }` (empty `fonti` array means "all sources"). `applicaFiltri(bandi: Bando[], filtri: FiltriStato): Bando[]`. `FiltriBar({ filtri: FiltriStato; fontiDisponibili: string[]; onCambiaFiltri: (filtri: FiltriStato) => void }): JSX.Element`. Both consumed by `ListaBandi.tsx` (Task 7).

- [ ] **Step 1: Write the failing test — `dashboard/src/lib/filtriBandi.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { applicaFiltri, type FiltriStato } from './filtriBandi';
import type { Bando } from './types';

function creaBando(overrides: Partial<Bando> = {}): Bando {
  return {
    id: '1',
    fonte: 'eit',
    titolo: 'Bando gaming',
    descrizione: 'desc',
    url: 'https://esempio.it/1',
    scadenza: null,
    data_pubblicazione: null,
    priorita: 'alta',
    stato: 'nuovo',
    ...overrides,
  };
}

const filtriBase: FiltriStato = {
  priorita: 'tutti',
  fonti: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
};

describe('applicaFiltri', () => {
  it('non filtra nulla con i filtri di default', () => {
    const bandi = [creaBando({ id: '1' }), creaBando({ id: '2' })];
    expect(applicaFiltri(bandi, filtriBase).map((b) => b.id)).toEqual(['1', '2']);
  });

  it('filtra per priorita alta', () => {
    const bandi = [creaBando({ id: '1', priorita: 'alta' }), creaBando({ id: '2', priorita: 'da_verificare' })];
    const risultato = applicaFiltri(bandi, { ...filtriBase, priorita: 'alta' });
    expect(risultato.map((b) => b.id)).toEqual(['1']);
  });

  it('filtra per una o più fonti selezionate (multi-select)', () => {
    const bandi = [
      creaBando({ id: '1', fonte: 'eit' }),
      creaBando({ id: '2', fonte: 'invitalia' }),
      creaBando({ id: '3', fonte: 'europa-creativa-media' }),
    ];
    const risultato = applicaFiltri(bandi, { ...filtriBase, fonti: ['eit', 'invitalia'] });
    expect(risultato.map((b) => b.id).sort()).toEqual(['1', '2']);
  });

  it('filtra per testo libero su titolo e descrizione, case-insensitive', () => {
    const bandi = [
      creaBando({ id: '1', titolo: 'Bando Gaming 2026' }),
      creaBando({ id: '2', titolo: 'Altro bando', descrizione: 'per il settore GAMING' }),
      creaBando({ id: '3', titolo: 'Non correlato', descrizione: 'niente' }),
    ];
    const risultato = applicaFiltri(bandi, { ...filtriBase, ricerca: 'gaming' });
    expect(risultato.map((b) => b.id).sort()).toEqual(['1', '2']);
  });

  it('ordina per data_pubblicazione dal più recente, con i null in fondo', () => {
    const bandi = [
      creaBando({ id: '1', data_pubblicazione: '2026-01-01' }),
      creaBando({ id: '2', data_pubblicazione: '2026-03-01' }),
      creaBando({ id: '3', data_pubblicazione: null }),
    ];
    const risultato = applicaFiltri(bandi, filtriBase);
    expect(risultato.map((b) => b.id)).toEqual(['2', '1', '3']);
  });

  it('ordina per scadenza dalla più vicina, con i null in fondo', () => {
    const bandi = [
      creaBando({ id: '1', scadenza: '2026-06-01' }),
      creaBando({ id: '2', scadenza: '2026-03-01' }),
      creaBando({ id: '3', scadenza: null }),
    ];
    const risultato = applicaFiltri(bandi, { ...filtriBase, ordinamento: 'scadenza' });
    expect(risultato.map((b) => b.id)).toEqual(['2', '1', '3']);
  });

  it('combina più filtri insieme', () => {
    const bandi = [
      creaBando({ id: '1', fonte: 'eit', priorita: 'alta', titolo: 'Bando gaming' }),
      creaBando({ id: '2', fonte: 'eit', priorita: 'da_verificare', titolo: 'Bando gaming' }),
      creaBando({ id: '3', fonte: 'invitalia', priorita: 'alta', titolo: 'Bando gaming' }),
    ];
    const risultato = applicaFiltri(bandi, { ...filtriBase, priorita: 'alta', fonti: ['eit'] });
    expect(risultato.map((b) => b.id)).toEqual(['1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- filtriBandi`
Expected: FAIL — `./filtriBandi` does not exist.

- [ ] **Step 3: Create `dashboard/src/lib/filtriBandi.ts`**

```ts
import type { Bando, Priorita } from './types';

export interface FiltriStato {
  priorita: Priorita | 'tutti';
  fonti: string[];
  ricerca: string;
  ordinamento: 'data_pubblicazione' | 'scadenza';
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

  const query = filtri.ricerca.trim().toLowerCase();
  if (query !== '') {
    risultato = risultato.filter(
      (b) => b.titolo.toLowerCase().includes(query) || b.descrizione.toLowerCase().includes(query)
    );
  }

  return [...risultato].sort((a, b) =>
    filtri.ordinamento === 'scadenza'
      ? confrontaConNullInFondo(a.scadenza, b.scadenza, true)
      : confrontaConNullInFondo(a.data_pubblicazione, b.data_pubblicazione, false)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- filtriBandi`
Expected: PASS (7 tests)

- [ ] **Step 5: Write the failing test — `dashboard/src/components/FiltriBar.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiltriBar } from './FiltriBar';
import type { FiltriStato } from '../lib/filtriBandi';

const filtriBase: FiltriStato = {
  priorita: 'tutti',
  fonti: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
};

describe('FiltriBar', () => {
  it('chiama onCambiaFiltri con il testo di ricerca aggiornato', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit']} onCambiaFiltri={onCambiaFiltri} />);

    await utente.type(screen.getByPlaceholderText(/cerca per titolo/i), 'g');
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, ricerca: 'g' });
  });

  it('chiama onCambiaFiltri quando si seleziona "Match diretto"', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit']} onCambiaFiltri={onCambiaFiltri} />);

    await utente.click(screen.getByRole('button', { name: 'Match diretto' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, priorita: 'alta' });
  });

  it('permette di selezionare più fonti (multi-select)', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit', 'invitalia']} onCambiaFiltri={onCambiaFiltri} />);

    await utente.click(screen.getByLabelText('Fonte'));
    await utente.click(await screen.findByRole('option', { name: 'eit' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, fonti: ['eit'] });
  });

  it('chiama onCambiaFiltri quando si cambia ordinamento a scadenza', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit']} onCambiaFiltri={onCambiaFiltri} />);

    await utente.click(screen.getByLabelText('Ordina per'));
    await utente.click(await screen.findByRole('option', { name: 'Scadenza' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, ordinamento: 'scadenza' });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- FiltriBar`
Expected: FAIL — `./FiltriBar` does not exist.

- [ ] **Step 7: Create `dashboard/src/components/FiltriBar.tsx`**

```tsx
import {
  Box,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  type SelectChangeEvent,
} from '@mui/material';
import type { FiltriStato } from '../lib/filtriBandi';

export interface FiltriBarProps {
  filtri: FiltriStato;
  fontiDisponibili: string[];
  onCambiaFiltri: (filtri: FiltriStato) => void;
}

export function FiltriBar({ filtri, fontiDisponibili, onCambiaFiltri }: FiltriBarProps) {
  function gestisciCambioFonti(evento: SelectChangeEvent<string[]>) {
    const valore = evento.target.value;
    onCambiaFiltri({ ...filtri, fonti: typeof valore === 'string' ? valore.split(',') : valore });
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
      </Box>
    </Box>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- FiltriBar`
Expected: PASS (4 tests)

- [ ] **Step 9: Commit**

```bash
git add dashboard/src/lib/filtriBandi.ts dashboard/src/lib/filtriBandi.test.ts dashboard/src/components/FiltriBar.tsx dashboard/src/components/FiltriBar.test.tsx
git commit -m "feat(dashboard): add filter logic and filter bar (multi-source, priority, search, sort)"
```

---

### Task 7: Lista bandi (fetch, integrazione, mark-as-seen)

**Files:**
- Create: `dashboard/src/components/ListaBandi.tsx`
- Test: `dashboard/src/components/ListaBandi.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase`; `Bando` from `../lib/types`; `applicaFiltri`, `FiltriStato` from `../lib/filtriBandi`; `BandoCard` from `./BandoCard`; `FiltriBar` from `./FiltriBar`.
- Produces: `ListaBandi(): JSX.Element`, a component with no props, used by `App.tsx` (Task 8).

- [ ] **Step 1: Write the failing test — `dashboard/src/components/ListaBandi.test.tsx`**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Bando } from '../lib/types';

function creaBando(overrides: Partial<Bando> = {}): Bando {
  return {
    id: '1',
    fonte: 'eit',
    titolo: 'Bando A',
    descrizione: 'desc',
    url: 'https://esempio.it/a',
    scadenza: null,
    data_pubblicazione: '2026-01-01',
    priorita: 'alta',
    stato: 'nuovo',
    ...overrides,
  };
}

const aggiornaFinto = vi.fn(async () => ({ error: null as { message: string } | null }));
let datiFinti: Bando[] = [];

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: datiFinti, error: null }),
        }),
      }),
      update: (valori: Partial<Bando>) => ({
        eq: (colonna: string, valore: string) => aggiornaFinto(valori, colonna, valore),
      }),
    }),
  },
}));

import { ListaBandi } from './ListaBandi';

describe('ListaBandi', () => {
  beforeEach(() => {
    aggiornaFinto.mockClear();
    datiFinti = [
      creaBando({ id: '1', titolo: 'Bando A' }),
      creaBando({ id: '2', titolo: 'Bando B', priorita: 'da_verificare' }),
    ];
  });

  it('mostra un indicatore di caricamento e poi i bandi ricevuti', async () => {
    render(<ListaBandi />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Bando A')).toBeInTheDocument());
    expect(screen.getByText('Bando B')).toBeInTheDocument();
  });

  it('mostra un messaggio quando nessun bando corrisponde ai filtri', async () => {
    datiFinti = [];
    render(<ListaBandi />);
    await waitFor(() => expect(screen.getByText(/nessun bando trovato/i)).toBeInTheDocument());
  });

  it('aggiorna lo stato su Supabase quando si clicca "segna come visto"', async () => {
    const utente = userEvent.setup();
    render(<ListaBandi />);
    await waitFor(() => expect(screen.getByText('Bando A')).toBeInTheDocument());

    const pulsanti = screen.getAllByRole('button', { name: /segna come visto/i });
    await utente.click(pulsanti[0]);

    await waitFor(() => expect(aggiornaFinto).toHaveBeenCalledWith({ stato: 'visto' }, 'id', '1'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ListaBandi`
Expected: FAIL — `./ListaBandi` does not exist.

- [ ] **Step 3: Create `dashboard/src/components/ListaBandi.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { supabase } from '../lib/supabase';
import type { Bando } from '../lib/types';
import { BandoCard } from './BandoCard';
import { FiltriBar, type FiltriBarProps } from './FiltriBar';
import { applicaFiltri, type FiltriStato } from '../lib/filtriBandi';

const FILTRI_INIZIALI: FiltriStato = {
  priorita: 'tutti',
  fonti: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
};

export function ListaBandi() {
  const [bandi, setBandi] = useState<Bando[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<FiltriStato>(FILTRI_INIZIALI);

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

  const fontiDisponibili = useMemo(() => [...new Set(bandi.map((b) => b.fonte))].sort(), [bandi]);
  const bandiFiltrati = useMemo(() => applicaFiltri(bandi, filtri), [bandi, filtri]);

  const onCambiaFiltri: FiltriBarProps['onCambiaFiltri'] = setFiltri;

  if (caricamento) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pb: 4 }}>
      <FiltriBar filtri={filtri} fontiDisponibili={fontiDisponibili} onCambiaFiltri={onCambiaFiltri} />

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

Note: `Stack` is imported but unused above the final grid design — remove the unused import when implementing (use only `Box`, `CircularProgress`, `Typography`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ListaBandi`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS, no type errors (fix the unused `Stack` import from Step 3 if `typecheck`/build flags it).

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/ListaBandi.tsx dashboard/src/components/ListaBandi.test.tsx
git commit -m "feat(dashboard): add ListaBandi with fetch, filtering and mark-as-seen"
```

---

### Task 8: Guscio applicazione (tema, toggle, gate di autenticazione)

**Files:**
- Modify: `dashboard/src/App.tsx`
- Modify: `dashboard/src/App.test.tsx`

**Interfaces:**
- Consumes: `creaTemaQyros` from `./theme`; `useAuth` from `./hooks/useAuth`; `LoginScreen` from `./components/LoginScreen`; `ListaBandi` from `./components/ListaBandi`.
- Produces: final `App` default export — the app's real entry view.

- [ ] **Step 1: Write the failing test — replace `dashboard/src/App.test.tsx`**

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';

vi.mock('./hooks/useAuth');
vi.mock('./components/LoginScreen', () => ({ LoginScreen: () => <div>Schermata di login</div> }));
vi.mock('./components/ListaBandi', () => ({ ListaBandi: () => <div>Lista bandi</div> }));

import { useAuth } from './hooks/useAuth';
import App from './App';

describe('App', () => {
  afterEach(() => {
    vi.mocked(useAuth).mockReset();
  });

  it('mostra un indicatore di caricamento mentre la sessione viene verificata', () => {
    vi.mocked(useAuth).mockReturnValue({ sessione: null, caricamento: true });
    render(<App />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('mostra la schermata di login quando non c\'è sessione', () => {
    vi.mocked(useAuth).mockReturnValue({ sessione: null, caricamento: false });
    render(<App />);
    expect(screen.getByText('Schermata di login')).toBeInTheDocument();
  });

  it('mostra la lista bandi quando c\'è una sessione attiva', () => {
    vi.mocked(useAuth).mockReturnValue({
      sessione: { access_token: 'finto' } as unknown as Session,
      caricamento: false,
    });
    render(<App />);
    expect(screen.getByText('Lista bandi')).toBeInTheDocument();
  });

  it('cambia icona quando si clicca il pulsante di cambio tema', async () => {
    vi.mocked(useAuth).mockReturnValue({ sessione: null, caricamento: false });
    const utente = userEvent.setup();
    render(<App />);

    expect(screen.getByTestId('Brightness7Icon')).toBeInTheDocument();
    await utente.click(screen.getByLabelText('Cambia tema chiaro/scuro'));
    expect(screen.getByTestId('Brightness4Icon')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- App`
Expected: FAIL — current `App.tsx` placeholder doesn't render a progressbar / login / lista bandi / theme toggle.

- [ ] **Step 3: Replace `dashboard/src/App.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { AppBar, Box, CircularProgress, CssBaseline, IconButton, ThemeProvider, Toolbar, Typography } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { creaTemaQyros } from './theme';
import { useAuth } from './hooks/useAuth';
import { LoginScreen } from './components/LoginScreen';
import { ListaBandi } from './components/ListaBandi';

function rilevaPreferenzaSistema(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function App() {
  const [modalita, setModalita] = useState<'light' | 'dark'>(rilevaPreferenzaSistema);
  const tema = useMemo(() => creaTemaQyros(modalita), [modalita]);
  const { sessione, caricamento } = useAuth();

  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <AppBar position="sticky" color="secondary" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            QYROS Bandi Monitor
          </Typography>
          <IconButton
            color="inherit"
            onClick={() => setModalita((m) => (m === 'dark' ? 'light' : 'dark'))}
            aria-label="Cambia tema chiaro/scuro"
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            {modalita === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ pt: 2 }}>
        {caricamento ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : sessione ? (
          <ListaBandi />
        ) : (
          <LoginScreen />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- App`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full test suite, typecheck and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests PASS (24 total across the project), no type errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/App.tsx dashboard/src/App.test.tsx
git commit -m "feat(dashboard): wire up theme toggle and auth-gated view in App shell"
```

---

### Task 9: Verifica manuale nel browser e workflow di deploy

**Files:**
- Create: `.github/workflows/deploy-dashboard.yml`
- Modify: `dashboard/README.md`

**Interfaces:**
- Consumes: repository secrets `SUPABASE_URL` (already set in Fase 3) and a new `SUPABASE_ANON_KEY` secret (configured in Fase 4b, not by this task).
- Produces: a GitHub Actions workflow that builds and publishes `dashboard/` to GitHub Pages on every push to `main` that touches `dashboard/**`.

- [ ] **Step 1: Start the local dev server and visually verify the login screen**

Run (from `dashboard/`): `cp .env.example .env`, then edit `.env` to set:
```
VITE_SUPABASE_URL=https://atcdtnmwbllvdeikswfk.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_wk48FzEwAAXxaM5fLKvJZQ_7FCLcpNJ
```
(this is the real project's public anon key — safe to use locally, it is protected by RLS and is meant to be embedded in client-side code)

Run: `npm run dev`, then open the printed local URL in a browser.

Expected: the login screen renders with QYROS branding (dark background `#040a1b`, orange "Invia link di accesso" button), an email field, and no console errors. Verify the layout does not horizontally scroll at a narrow (mobile) width and at a wide (desktop) width. Type an email and submit — expect the "ti abbiamo inviato un link" confirmation to appear (this actually calls the real Supabase `signInWithOtp`, which is harmless — it only queues a magic-link email if the address matches an existing user, and does not create one because public signup is disabled by default project settings pending Fase 4b's explicit config). Stop the dev server when done.

- [ ] **Step 2: Create `.github/workflows/deploy-dashboard.yml`**

```yaml
name: Pubblica la dashboard

on:
  push:
    branches: [main]
    paths:
      - 'dashboard/**'
      - '.github/workflows/deploy-dashboard.yml'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: dashboard
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: dashboard/package-lock.json
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dashboard/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Validate the workflow YAML syntax**

Run: `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/deploy-dashboard.yml')); print('YAML valido')"`
Expected: prints `YAML valido` with no errors. (If `python3`/`yaml` is unavailable, visually double check indentation instead — every key under `jobs:`, `steps:`, `with:`, `env:` must line up exactly as shown above.)

- [ ] **Step 4: Update `dashboard/README.md`**

Replace the "Stato Fase 4a" section with:

```markdown
## Stato Fase 4a

App completa (login, tema QYROS, filtri multi-fonte, ricerca, ordinamento, card bando,
segna come visto/nuovo), tutta testata (nessuna chiamata di rete reale nei test
automatici), verificata anche manualmente in un browser locale. Workflow di
pubblicazione su GitHub Pages (`.github/workflows/deploy-dashboard.yml`) creato.

Resta da fare (Fase 4b): impostare il segreto `SUPABASE_ANON_KEY` su GitHub, abilitare
GitHub Pages per il repository, creare l'utente autorizzato su Supabase Auth,
registrare l'URL della dashboard pubblicata come redirect URL autorizzato, e verificare
l'accesso reale end-to-end.
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy-dashboard.yml dashboard/README.md
git commit -m "feat(dashboard): add GitHub Pages deploy workflow"
```

---

## Fine Fase 4a

A questo punto tutto il codice della dashboard è scritto, testato (nessuna chiamata di
rete reale nella suite automatica) e verificato manualmente in locale con le credenziali
reali. La Fase 4b (fuori da questo piano, eseguita interattivamente dopo il merge) copre:
impostare il nuovo segreto `SUPABASE_ANON_KEY`, abilitare GitHub Pages, creare l'utente
Supabase Auth autorizzato, configurare il redirect URL, e la verifica end-to-end reale
(login via magic link, dati reali visibili, segna-come-visto persistito).
