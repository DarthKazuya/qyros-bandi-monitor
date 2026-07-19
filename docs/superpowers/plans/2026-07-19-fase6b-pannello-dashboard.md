# Fase 6b — Pannello di controllo nella dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dashboard-facing half of the admin control panel: a "Richiedi accesso" flow folded into the existing login screen, a 4-section admin panel (pending requests, authorized users, job run history, keyword/schedule configuration) visible only to the admin, and a logout button. Consumes the tables and Edge Function built in Fase 6a (already live in production).

**Architecture:** Pure additions to `dashboard/`. Admin-only privileged actions (approve a request, list users, revoke a user) go through the already-deployed `admin-actions` Edge Function via `supabase.functions.invoke`. Everything else (reading requests/keywords/schedule/job history, rejecting a request) is a direct Supabase call protected by the RLS policies Fase 6a already put in place — no new backend work.

**Tech Stack:** Same as prior dashboard phases — Vite, React 18, TypeScript, MUI 6, Vitest + Testing Library.

## Global Constraints

- The sole recognized administrator is the literal email `panto75@gmail.com` — a single shared constant (`EMAIL_AMMINISTRATORE`), never duplicated as a string literal elsewhere in `dashboard/`.
- The admin panel and its "Pannello" toggle button must be invisible to any signed-in user who isn't the admin — this is a UI convenience only; the real security boundary is the RLS policies and the Edge Function's own email check from Fase 6a (both already in place and already verified live).
- **Verified fact, not an assumption:** when `supabase.auth.signInWithOtp({ email })` is called for an email with no existing account (project has public signup disabled), Supabase returns an error with `error.code === 'signup_disabled'` — confirmed by a live `curl` test against this exact project on 2026-07-19, not guessed. Detect this exact code, not the error message text (message text is not a stable API contract; the code is).
- Rejecting a request (`stato: 'rifiutata'`) is a direct Supabase `update` call (covered by the existing `richieste_accesso_admin_update` RLS policy) — it does NOT go through the Edge Function. Only `approva_richiesta` (creates a real Auth user) and `revoca_utente`/`elenco_utenti` (need the Auth Admin API) go through `supabase.functions.invoke('admin-actions', ...)`.
- Touch targets ≥44px on every new interactive element (buttons, chips with delete affordance, tabs, icon buttons) — standing project convention.
- Zero real Supabase/network calls in the automated test suite — every test that touches `../lib/supabase` or `../lib/admin` must mock it.
- No `.js` extensions on relative TS/TSX imports — standing dashboard convention.
- New components that are admin-only live under `dashboard/src/components/admin/`, kept separate from the bandi-viewing UI.

---

### Task 1: Modulo condiviso admin (costante, chiamata alla Edge Function) e tipi

**Files:**
- Create: `dashboard/src/lib/admin.ts`
- Test: `dashboard/src/lib/admin.test.ts`
- Modify: `dashboard/src/lib/types.ts`

**Interfaces:**
- Produces: `EMAIL_AMMINISTRATORE = 'panto75@gmail.com'`. `eAmministratore(email: string | undefined): boolean`. `chiamaAdminActions<T = unknown>(azione: string, corpo?: Record<string, unknown>): Promise<T>` — invokes the `admin-actions` Edge Function, throws a plain `Error` with a readable message on failure (unpacking the Edge Function's own `{errore: "..."}` JSON body when present, falling back to the raw error message otherwise). New types: `RichiestaAccesso`, `UtenteAutorizzato`, `EsecuzioneJob`, `ParolaChiave`, `ImpostazioniJob`. Consumed by every later task in this plan.

- [ ] **Step 1: Write the failing test — `dashboard/src/lib/admin.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { EMAIL_AMMINISTRATORE, eAmministratore } from './admin';

const invokeFinto = vi.fn();

vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeFinto(...args) } },
}));

describe('eAmministratore', () => {
  it('restituisce true per l\'email amministratore', () => {
    expect(eAmministratore(EMAIL_AMMINISTRATORE)).toBe(true);
  });

  it('restituisce false per un\'altra email', () => {
    expect(eAmministratore('altro@esempio.it')).toBe(false);
  });

  it('restituisce false per undefined', () => {
    expect(eAmministratore(undefined)).toBe(false);
  });
});

describe('chiamaAdminActions', () => {
  it('restituisce i dati quando la chiamata riesce', async () => {
    const { chiamaAdminActions } = await import('./admin');
    invokeFinto.mockResolvedValueOnce({ data: { utenti: [] }, error: null });

    const risultato = await chiamaAdminActions('elenco_utenti');

    expect(risultato).toEqual({ utenti: [] });
    expect(invokeFinto).toHaveBeenCalledWith('admin-actions', { body: { azione: 'elenco_utenti' } });
  });

  it('include parametri aggiuntivi nel corpo della richiesta', async () => {
    const { chiamaAdminActions } = await import('./admin');
    invokeFinto.mockResolvedValueOnce({ data: { ok: true }, error: null });

    await chiamaAdminActions('revoca_utente', { id: 'abc' });

    expect(invokeFinto).toHaveBeenCalledWith('admin-actions', { body: { azione: 'revoca_utente', id: 'abc' } });
  });

  it('lancia un errore con il messaggio del corpo quando la Edge Function risponde con un errore HTTP', async () => {
    const { chiamaAdminActions } = await import('./admin');
    const erroreFinto = {
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => ({ errore: 'Non autorizzato' }) },
    };
    invokeFinto.mockResolvedValueOnce({ data: null, error: erroreFinto });

    await expect(chiamaAdminActions('elenco_utenti')).rejects.toThrow('Non autorizzato');
  });

  it('lancia un errore generico quando manca il contesto HTTP (es. errore di rete)', async () => {
    const { chiamaAdminActions } = await import('./admin');
    invokeFinto.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });

    await expect(chiamaAdminActions('elenco_utenti')).rejects.toThrow('Failed to fetch');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run admin`
Expected: FAIL — `./admin` does not exist.

- [ ] **Step 3: Create `dashboard/src/lib/admin.ts`**

```ts
import { supabase } from './supabase';

export const EMAIL_AMMINISTRATORE = 'panto75@gmail.com';

export function eAmministratore(email: string | undefined): boolean {
  return email === EMAIL_AMMINISTRATORE;
}

export async function chiamaAdminActions<T = unknown>(
  azione: string,
  corpo: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-actions', {
    body: { azione, ...corpo },
  });

  if (error) {
    const contesto = (error as { context?: Response }).context;
    if (contesto && typeof contesto.json === 'function') {
      const corpoErrore = await contesto.json();
      throw new Error(corpoErrore.errore ?? error.message);
    }
    throw new Error(error.message);
  }

  return data as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run admin`
Expected: PASS (7 tests)

- [ ] **Step 5: Append to `dashboard/src/lib/types.ts`**

```ts

export interface RichiestaAccesso {
  id: string;
  email: string;
  nome: string;
  cognome: string;
  richiesto_il: string;
  stato: 'in_attesa' | 'approvata' | 'rifiutata';
}

export interface UtenteAutorizzato {
  id: string;
  email: string;
}

export interface FonteFallitaLog {
  fonte: string;
  errore: string;
}

export interface EsecuzioneJob {
  id: string;
  eseguito_il: string;
  fonti_ok: string[];
  fonti_fallite: FonteFallitaLog[];
  nuovi_bandi: number;
}

export interface ParolaChiave {
  id: string;
  parola: string;
  livello: 'livello1' | 'livello2';
}

export interface ImpostazioniJob {
  id: number;
  ora: number;
  fuso_orario: string;
}
```

- [ ] **Step 6: Run typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: clean, no errors. If `error.code` is used elsewhere in this plan and doesn't typecheck against the installed `@supabase/supabase-js` version's `AuthError` type, the fallback is `(error as unknown as { code?: string }).code` — but try the direct form first, it is expected to work with the version pinned in this project (`^2.47.10`).

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/lib/admin.ts dashboard/src/lib/admin.test.ts dashboard/src/lib/types.ts
git commit -m "feat(dashboard): add admin email check and Edge Function invocation helper"
```

---

### Task 2: Sezione pannello — Richieste in attesa

**Files:**
- Create: `dashboard/src/components/admin/RichiesteInAttesa.tsx`
- Test: `dashboard/src/components/admin/RichiesteInAttesa.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `../../lib/supabase`, `chiamaAdminActions` from `../../lib/admin`, `RichiestaAccesso` from `../../lib/types`.
- Produces: `RichiesteInAttesa(): JSX.Element`, a zero-prop component. Consumed by Task 6 (`PannelloAdmin.tsx`).

- [ ] **Step 1: Write the failing test — `dashboard/src/components/admin/RichiesteInAttesa.test.tsx`**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RichiestaAccesso } from '../../lib/types';

function creaRichiesta(overrides: Partial<RichiestaAccesso> = {}): RichiestaAccesso {
  return {
    id: '1',
    email: 'mario.rossi@esempio.it',
    nome: 'Mario',
    cognome: 'Rossi',
    richiesto_il: '2026-07-15T10:00:00Z',
    stato: 'in_attesa',
    ...overrides,
  };
}

const aggiornaFinto = vi.fn(async (valori: Partial<RichiestaAccesso>, colonna: string, valore: string) => ({
  error: null as { message: string } | null,
}));
let datiFinti: RichiestaAccesso[] = [];

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: datiFinti, error: null }),
        }),
      }),
      update: (valori: Partial<RichiestaAccesso>) => ({
        eq: (colonna: string, valore: string) => aggiornaFinto(valori, colonna, valore),
      }),
    }),
  },
}));

const chiamaAdminActionsFinta = vi.fn(async () => ({ ok: true }));
vi.mock('../../lib/admin', () => ({
  chiamaAdminActions: (...args: unknown[]) => chiamaAdminActionsFinta(...args),
}));

import { RichiesteInAttesa } from './RichiesteInAttesa';

describe('RichiesteInAttesa', () => {
  beforeEach(() => {
    aggiornaFinto.mockClear();
    chiamaAdminActionsFinta.mockClear();
    datiFinti = [creaRichiesta()];
  });

  it('mostra le richieste in attesa', async () => {
    render(<RichiesteInAttesa />);
    await waitFor(() => expect(screen.getByText('Mario Rossi')).toBeInTheDocument());
    expect(screen.getByText(/mario.rossi@esempio.it/)).toBeInTheDocument();
  });

  it('mostra un messaggio quando non ci sono richieste', async () => {
    datiFinti = [];
    render(<RichiesteInAttesa />);
    await waitFor(() => expect(screen.getByText('Nessuna richiesta in attesa.')).toBeInTheDocument());
  });

  it('approvando chiama la Edge Function e rimuove la richiesta dall\'elenco', async () => {
    const utente = userEvent.setup();
    render(<RichiesteInAttesa />);
    await waitFor(() => expect(screen.getByText('Mario Rossi')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Approva' }));

    await waitFor(() =>
      expect(chiamaAdminActionsFinta).toHaveBeenCalledWith('approva_richiesta', {
        id: '1',
        email: 'mario.rossi@esempio.it',
      })
    );
    await waitFor(() => expect(screen.queryByText('Mario Rossi')).not.toBeInTheDocument());
  });

  it('rifiutando aggiorna lo stato direttamente e rimuove la richiesta dall\'elenco', async () => {
    const utente = userEvent.setup();
    render(<RichiesteInAttesa />);
    await waitFor(() => expect(screen.getByText('Mario Rossi')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Rifiuta' }));

    await waitFor(() => expect(aggiornaFinto).toHaveBeenCalledWith({ stato: 'rifiutata' }, 'id', '1'));
    await waitFor(() => expect(screen.queryByText('Mario Rossi')).not.toBeInTheDocument());
  });

  it('mostra un errore se l\'approvazione fallisce', async () => {
    chiamaAdminActionsFinta.mockRejectedValueOnce(new Error('Utente già esistente'));
    const utente = userEvent.setup();
    render(<RichiesteInAttesa />);
    await waitFor(() => expect(screen.getByText('Mario Rossi')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Approva' }));

    await waitFor(() => expect(screen.getByText('Utente già esistente')).toBeInTheDocument());
    expect(screen.getByText('Mario Rossi')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run RichiesteInAttesa`
Expected: FAIL — `./RichiesteInAttesa` does not exist.

- [ ] **Step 3: Create `dashboard/src/components/admin/RichiesteInAttesa.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { supabase } from '../../lib/supabase';
import { chiamaAdminActions } from '../../lib/admin';
import type { RichiestaAccesso } from '../../lib/types';

function formattaData(data: string): string {
  return new Date(data).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function RichiesteInAttesa() {
  const [richieste, setRichieste] = useState<RichiestaAccesso[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [azioneInCorso, setAzioneInCorso] = useState<string | null>(null);

  useEffect(() => {
    caricaRichieste();
  }, []);

  async function caricaRichieste() {
    setCaricamento(true);
    const { data, error } = await supabase
      .from('richieste_accesso')
      .select('id, email, nome, cognome, richiesto_il, stato')
      .eq('stato', 'in_attesa')
      .order('richiesto_il', { ascending: false });

    if (error) {
      setErrore(error.message);
    } else {
      setRichieste((data ?? []) as RichiestaAccesso[]);
    }
    setCaricamento(false);
  }

  async function approva(richiesta: RichiestaAccesso) {
    setErrore(null);
    setAzioneInCorso(richiesta.id);
    try {
      await chiamaAdminActions('approva_richiesta', { id: richiesta.id, email: richiesta.email });
      setRichieste((precedenti) => precedenti.filter((r) => r.id !== richiesta.id));
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
    setAzioneInCorso(null);
  }

  async function rifiuta(richiesta: RichiestaAccesso) {
    setErrore(null);
    setAzioneInCorso(richiesta.id);
    const { error } = await supabase
      .from('richieste_accesso')
      .update({ stato: 'rifiutata' })
      .eq('id', richiesta.id);
    if (error) {
      setErrore(error.message);
    } else {
      setRichieste((precedenti) => precedenti.filter((r) => r.id !== richiesta.id));
    }
    setAzioneInCorso(null);
  }

  if (caricamento) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {errore && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errore}
        </Alert>
      )}
      {richieste.length === 0 ? (
        <Typography color="text.secondary">Nessuna richiesta in attesa.</Typography>
      ) : (
        <Stack spacing={2}>
          {richieste.map((richiesta) => (
            <Box key={richiesta.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Typography variant="subtitle1">
                {richiesta.nome} {richiesta.cognome}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {richiesta.email} · richiesta il {formattaData(richiesta.richiesto_il)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  disabled={azioneInCorso === richiesta.id}
                  onClick={() => approva(richiesta)}
                  sx={{ minHeight: 44 }}
                >
                  Approva
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  disabled={azioneInCorso === richiesta.id}
                  onClick={() => rifiuta(richiesta)}
                  sx={{ minHeight: 44 }}
                >
                  Rifiuta
                </Button>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run RichiesteInAttesa`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/admin/RichiesteInAttesa.tsx dashboard/src/components/admin/RichiesteInAttesa.test.tsx
git commit -m "feat(dashboard): add RichiesteInAttesa admin panel section"
```

---

### Task 3: Sezione pannello — Utenti autorizzati

**Files:**
- Create: `dashboard/src/components/admin/UtentiAutorizzati.tsx`
- Test: `dashboard/src/components/admin/UtentiAutorizzati.test.tsx`

**Interfaces:**
- Consumes: `chiamaAdminActions`, `EMAIL_AMMINISTRATORE` from `../../lib/admin`, `UtenteAutorizzato` from `../../lib/types`.
- Produces: `UtentiAutorizzati(): JSX.Element`, zero-prop. Consumed by Task 6.

- [ ] **Step 1: Write the failing test — `dashboard/src/components/admin/UtentiAutorizzati.test.tsx`**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const chiamaAdminActionsFinta = vi.fn();
vi.mock('../../lib/admin', () => ({
  EMAIL_AMMINISTRATORE: 'panto75@gmail.com',
  chiamaAdminActions: (...args: unknown[]) => chiamaAdminActionsFinta(...args),
}));

import { UtentiAutorizzati } from './UtentiAutorizzati';

describe('UtentiAutorizzati', () => {
  beforeEach(() => {
    chiamaAdminActionsFinta.mockReset();
  });

  it('mostra l\'elenco utenti', async () => {
    chiamaAdminActionsFinta.mockResolvedValueOnce({
      utenti: [
        { id: '1', email: 'panto75@gmail.com' },
        { id: '2', email: 'mario.rossi@esempio.it' },
      ],
    });
    render(<UtentiAutorizzati />);
    await waitFor(() => expect(screen.getByText('panto75@gmail.com')).toBeInTheDocument());
    expect(screen.getByText('mario.rossi@esempio.it')).toBeInTheDocument();
  });

  it('non mostra il pulsante Revoca per l\'amministratore stesso', async () => {
    chiamaAdminActionsFinta.mockResolvedValueOnce({
      utenti: [{ id: '1', email: 'panto75@gmail.com' }],
    });
    render(<UtentiAutorizzati />);
    await waitFor(() => expect(screen.getByText('panto75@gmail.com')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Revoca' })).not.toBeInTheDocument();
  });

  it('revocando un utente lo rimuove dall\'elenco', async () => {
    chiamaAdminActionsFinta.mockResolvedValueOnce({
      utenti: [{ id: '2', email: 'mario.rossi@esempio.it' }],
    });
    chiamaAdminActionsFinta.mockResolvedValueOnce({ ok: true });
    const utente = userEvent.setup();
    render(<UtentiAutorizzati />);
    await waitFor(() => expect(screen.getByText('mario.rossi@esempio.it')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Revoca' }));

    expect(chiamaAdminActionsFinta).toHaveBeenLastCalledWith('revoca_utente', { id: '2' });
    await waitFor(() => expect(screen.queryByText('mario.rossi@esempio.it')).not.toBeInTheDocument());
  });

  it('mostra un errore se il caricamento fallisce', async () => {
    chiamaAdminActionsFinta.mockRejectedValueOnce(new Error('Non autorizzato'));
    render(<UtentiAutorizzati />);
    await waitFor(() => expect(screen.getByText('Non autorizzato')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run UtentiAutorizzati`
Expected: FAIL — `./UtentiAutorizzati` does not exist.

- [ ] **Step 3: Create `dashboard/src/components/admin/UtentiAutorizzati.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { chiamaAdminActions, EMAIL_AMMINISTRATORE } from '../../lib/admin';
import type { UtenteAutorizzato } from '../../lib/types';

export function UtentiAutorizzati() {
  const [utenti, setUtenti] = useState<UtenteAutorizzato[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [azioneInCorso, setAzioneInCorso] = useState<string | null>(null);

  useEffect(() => {
    caricaUtenti();
  }, []);

  async function caricaUtenti() {
    setCaricamento(true);
    setErrore(null);
    try {
      const risultato = await chiamaAdminActions<{ utenti: UtenteAutorizzato[] }>('elenco_utenti');
      setUtenti(risultato.utenti);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
    setCaricamento(false);
  }

  async function revoca(utente: UtenteAutorizzato) {
    setErrore(null);
    setAzioneInCorso(utente.id);
    try {
      await chiamaAdminActions('revoca_utente', { id: utente.id });
      setUtenti((precedenti) => precedenti.filter((u) => u.id !== utente.id));
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
    setAzioneInCorso(null);
  }

  if (caricamento) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {errore && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errore}
        </Alert>
      )}
      {utenti.length === 0 ? (
        <Typography color="text.secondary">Nessun utente autorizzato.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {utenti.map((utente) => (
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
              <Typography>{utente.email}</Typography>
              {utente.email !== EMAIL_AMMINISTRATORE && (
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  disabled={azioneInCorso === utente.id}
                  onClick={() => revoca(utente)}
                  sx={{ minHeight: 44 }}
                >
                  Revoca
                </Button>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run UtentiAutorizzati`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/admin/UtentiAutorizzati.tsx dashboard/src/components/admin/UtentiAutorizzati.test.tsx
git commit -m "feat(dashboard): add UtentiAutorizzati admin panel section"
```

---

### Task 4: Sezione pannello — Storico esecuzioni

**Files:**
- Create: `dashboard/src/components/admin/StoricoEsecuzioni.tsx`
- Test: `dashboard/src/components/admin/StoricoEsecuzioni.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `../../lib/supabase`, `EsecuzioneJob` from `../../lib/types`.
- Produces: `StoricoEsecuzioni(): JSX.Element`, zero-prop. Consumed by Task 6.

- [ ] **Step 1: Write the failing test — `dashboard/src/components/admin/StoricoEsecuzioni.test.tsx`**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { EsecuzioneJob } from '../../lib/types';

let datiFinti: EsecuzioneJob[] = [];

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: datiFinti, error: null }),
        }),
      }),
    }),
  },
}));

import { StoricoEsecuzioni } from './StoricoEsecuzioni';

describe('StoricoEsecuzioni', () => {
  beforeEach(() => {
    datiFinti = [];
  });

  it('mostra le esecuzioni con fonti riuscite e nuovi bandi', async () => {
    datiFinti = [
      {
        id: '1',
        eseguito_il: '2026-07-19T08:00:00Z',
        fonti_ok: ['eit', 'invitalia'],
        fonti_fallite: [],
        nuovi_bandi: 5,
      },
    ];
    render(<StoricoEsecuzioni />);
    await waitFor(() => expect(screen.getByText(/5 nuovi bandi/)).toBeInTheDocument());
    expect(screen.getByText(/eit, invitalia/)).toBeInTheDocument();
  });

  it('mostra le fonti fallite quando presenti', async () => {
    datiFinti = [
      {
        id: '1',
        eseguito_il: '2026-07-19T08:00:00Z',
        fonti_ok: ['eit'],
        fonti_fallite: [{ fonte: 'invitalia', errore: 'timeout' }],
        nuovi_bandi: 2,
      },
    ];
    render(<StoricoEsecuzioni />);
    await waitFor(() => expect(screen.getByText('invitalia: timeout')).toBeInTheDocument());
  });

  it('mostra un messaggio quando non ci sono esecuzioni', async () => {
    render(<StoricoEsecuzioni />);
    await waitFor(() => expect(screen.getByText('Nessuna esecuzione registrata.')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run StoricoEsecuzioni`
Expected: FAIL — `./StoricoEsecuzioni` does not exist.

- [ ] **Step 3: Create `dashboard/src/components/admin/StoricoEsecuzioni.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { supabase } from '../../lib/supabase';
import type { EsecuzioneJob } from '../../lib/types';

function formattaDataOra(data: string): string {
  return new Date(data).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StoricoEsecuzioni() {
  const [esecuzioni, setEsecuzioni] = useState<EsecuzioneJob[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    async function carica() {
      setCaricamento(true);
      const { data, error } = await supabase
        .from('job_run_log')
        .select('id, eseguito_il, fonti_ok, fonti_fallite, nuovi_bandi')
        .order('eseguito_il', { ascending: false })
        .limit(30);

      if (error) {
        setErrore(error.message);
      } else {
        setEsecuzioni((data ?? []) as EsecuzioneJob[]);
      }
      setCaricamento(false);
    }
    carica();
  }, []);

  if (caricamento) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (errore) {
    return <Alert severity="error">{errore}</Alert>;
  }

  if (esecuzioni.length === 0) {
    return <Typography color="text.secondary">Nessuna esecuzione registrata.</Typography>;
  }

  return (
    <Stack spacing={2}>
      {esecuzioni.map((esecuzione) => (
        <Box key={esecuzione.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="subtitle2">{formattaDataOra(esecuzione.eseguito_il)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {esecuzione.nuovi_bandi} nuovi bandi · fonti riuscite: {esecuzione.fonti_ok.join(', ') || 'nessuna'}
          </Typography>
          {esecuzione.fonti_fallite.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {esecuzione.fonti_fallite.map((f) => (
                <Chip key={f.fonte} label={`${f.fonte}: ${f.errore}`} size="small" color="error" />
              ))}
            </Box>
          )}
        </Box>
      ))}
    </Stack>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run StoricoEsecuzioni`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/admin/StoricoEsecuzioni.tsx dashboard/src/components/admin/StoricoEsecuzioni.test.tsx
git commit -m "feat(dashboard): add StoricoEsecuzioni admin panel section"
```

---

### Task 5: Sezione pannello — Configurazione (parole chiave e orario)

**Files:**
- Create: `dashboard/src/components/admin/Configurazione.tsx`
- Test: `dashboard/src/components/admin/Configurazione.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `../../lib/supabase`, `ImpostazioniJob`, `ParolaChiave` from `../../lib/types`.
- Produces: `Configurazione(): JSX.Element`, zero-prop. Consumed by Task 6.

- [ ] **Step 1: Write the failing test — `dashboard/src/components/admin/Configurazione.test.tsx`**

```tsx
import { beforeEach, describe, expect, it, vi, within } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ImpostazioniJob, ParolaChiave } from '../../lib/types';

let paroleFinte: ParolaChiave[] = [];
let impostazioniFinte: ImpostazioniJob | null = null;
const inserisciFinto = vi.fn(async (valori: Partial<ParolaChiave>) => ({
  data: { id: '99', ...valori },
  error: null as { message: string } | null,
}));
const eliminaFinto = vi.fn(async (colonna: string, valore: string) => ({
  error: null as { message: string } | null,
}));
const aggiornaOraFinto = vi.fn(async (valori: Partial<ImpostazioniJob>, colonna: string, valore: number) => ({
  error: null as { message: string } | null,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (tabella: string) => {
      if (tabella === 'parole_chiave') {
        return {
          select: () => ({
            order: async () => ({ data: paroleFinte, error: null }),
          }),
          insert: (valori: Partial<ParolaChiave>) => ({
            select: () => ({
              single: async () => inserisciFinto(valori),
            }),
          }),
          delete: () => ({
            eq: (colonna: string, valore: string) => eliminaFinto(colonna, valore),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: impostazioniFinte, error: null }),
          }),
        }),
        update: (valori: Partial<ImpostazioniJob>) => ({
          eq: (colonna: string, valore: number) => aggiornaOraFinto(valori, colonna, valore),
        }),
      };
    },
  },
}));

import { Configurazione } from './Configurazione';

describe('Configurazione', () => {
  beforeEach(() => {
    inserisciFinto.mockClear();
    eliminaFinto.mockClear();
    aggiornaOraFinto.mockClear();
    paroleFinte = [
      { id: '1', parola: 'gaming', livello: 'livello1' },
      { id: '2', parola: 'startup', livello: 'livello2' },
    ];
    impostazioniFinte = { id: 1, ora: 8, fuso_orario: 'Europe/Rome' };
  });

  it('mostra le parole chiave raggruppate per livello', async () => {
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming')).toBeInTheDocument());
    expect(screen.getByText('startup')).toBeInTheDocument();
  });

  it('mostra l\'ora attuale', async () => {
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByDisplayValue('8')).toBeInTheDocument());
  });

  it('aggiunge una nuova parola chiave', async () => {
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming')).toBeInTheDocument());

    await utente.type(screen.getByLabelText('Nuova parola chiave'), 'fintech');
    await utente.click(screen.getByRole('button', { name: 'Aggiungi' }));

    await waitFor(() => expect(inserisciFinto).toHaveBeenCalledWith({ parola: 'fintech', livello: 'livello2' }));
  });

  it('rimuove una parola chiave esistente', async () => {
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming')).toBeInTheDocument());

    const chipGaming = screen.getByText('gaming').closest('.MuiChip-root') as HTMLElement;
    const pulsanteElimina = within(chipGaming).getByTestId('CancelIcon');
    await utente.click(pulsanteElimina);

    await waitFor(() => expect(eliminaFinto).toHaveBeenCalledWith('id', '1'));
  });

  it('salva la nuova ora', async () => {
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByDisplayValue('8')).toBeInTheDocument());

    const campoOra = screen.getByLabelText('Ora (0-23)');
    await utente.clear(campoOra);
    await utente.type(campoOra, '9');
    await utente.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(aggiornaOraFinto).toHaveBeenCalledWith({ ora: 9 }, 'id', 1));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run Configurazione`
Expected: FAIL — `./Configurazione` does not exist.

- [ ] **Step 3: Create `dashboard/src/components/admin/Configurazione.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Select, TextField, Typography } from '@mui/material';
import { supabase } from '../../lib/supabase';
import type { ImpostazioniJob, ParolaChiave } from '../../lib/types';

export function Configurazione() {
  const [paroleChiave, setParoleChiave] = useState<ParolaChiave[]>([]);
  const [impostazioni, setImpostazioni] = useState<ImpostazioniJob | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [nuovaParola, setNuovaParola] = useState('');
  const [nuovoLivello, setNuovoLivello] = useState<'livello1' | 'livello2'>('livello2');
  const [oraModificata, setOraModificata] = useState<number>(8);
  const [salvataggioOraInCorso, setSalvataggioOraInCorso] = useState(false);

  useEffect(() => {
    carica();
  }, []);

  async function carica() {
    setCaricamento(true);
    const [risultatoParole, risultatoImpostazioni] = await Promise.all([
      supabase.from('parole_chiave').select('id, parola, livello').order('parola'),
      supabase.from('impostazioni_job').select('id, ora, fuso_orario').eq('id', 1).single(),
    ]);

    if (risultatoParole.error) {
      setErrore(risultatoParole.error.message);
    } else {
      setParoleChiave((risultatoParole.data ?? []) as ParolaChiave[]);
    }

    if (risultatoImpostazioni.error) {
      setErrore(risultatoImpostazioni.error.message);
    } else if (risultatoImpostazioni.data) {
      const impostazioniLette = risultatoImpostazioni.data as ImpostazioniJob;
      setImpostazioni(impostazioniLette);
      setOraModificata(impostazioniLette.ora);
    }

    setCaricamento(false);
  }

  async function aggiungiParola() {
    if (nuovaParola.trim() === '') return;
    setErrore(null);
    const { data, error } = await supabase
      .from('parole_chiave')
      .insert({ parola: nuovaParola.trim(), livello: nuovoLivello })
      .select('id, parola, livello')
      .single();
    if (error) {
      setErrore(error.message);
      return;
    }
    setParoleChiave((precedenti) => [...precedenti, data as ParolaChiave]);
    setNuovaParola('');
  }

  async function rimuoviParola(parola: ParolaChiave) {
    setErrore(null);
    const { error } = await supabase.from('parole_chiave').delete().eq('id', parola.id);
    if (error) {
      setErrore(error.message);
      return;
    }
    setParoleChiave((precedenti) => precedenti.filter((p) => p.id !== parola.id));
  }

  async function salvaOra() {
    setErrore(null);
    setSalvataggioOraInCorso(true);
    const { error } = await supabase.from('impostazioni_job').update({ ora: oraModificata }).eq('id', 1);
    setSalvataggioOraInCorso(false);
    if (error) {
      setErrore(error.message);
      return;
    }
    setImpostazioni((precedenti) => (precedenti ? { ...precedenti, ora: oraModificata } : precedenti));
  }

  if (caricamento) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {errore && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errore}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Parole chiave
      </Typography>
      {(['livello1', 'livello2'] as const).map((livello) => (
        <Box key={livello} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {livello === 'livello1' ? 'Livello 1 — Alta priorità' : 'Livello 2 — Da verificare'}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {paroleChiave
              .filter((p) => p.livello === livello)
              .map((parola) => (
                <Chip
                  key={parola.id}
                  label={parola.parola}
                  onDelete={() => rimuoviParola(parola)}
                  sx={{ minHeight: 44 }}
                />
              ))}
          </Box>
        </Box>
      ))}

      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Nuova parola chiave"
          size="small"
          value={nuovaParola}
          onChange={(e) => setNuovaParola(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
        />
        <Select
          size="small"
          value={nuovoLivello}
          onChange={(e) => setNuovoLivello(e.target.value as 'livello1' | 'livello2')}
        >
          <MenuItem value="livello1">Livello 1</MenuItem>
          <MenuItem value="livello2">Livello 2</MenuItem>
        </Select>
        <Button variant="contained" onClick={aggiungiParola} sx={{ minHeight: 44 }}>
          Aggiungi
        </Button>
      </Box>

      <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
        Orario di esecuzione
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          type="number"
          label="Ora (0-23)"
          size="small"
          value={oraModificata}
          onChange={(e) => setOraModificata(Number(e.target.value))}
          inputProps={{ min: 0, max: 23 }}
          sx={{ width: 140 }}
        />
        <Button variant="contained" disabled={salvataggioOraInCorso} onClick={salvaOra} sx={{ minHeight: 44 }}>
          Salva
        </Button>
      </Box>
      {impostazioni && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Fuso orario: {impostazioni.fuso_orario} (non modificabile da qui)
        </Typography>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run Configurazione`
Expected: PASS (5 tests). If the "rimuove una parola chiave esistente" test fails specifically because `data-testid="CancelIcon"` isn't found, inspect the rendered chip's HTML (e.g. via the test's own error output, which prints the DOM) to find the actual delete icon's testid or role, and adjust the query — the rest of the test suite does not depend on this one selector being exactly right.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/admin/Configurazione.tsx dashboard/src/components/admin/Configurazione.test.tsx
git commit -m "feat(dashboard): add Configurazione admin panel section (keywords and schedule)"
```

---

### Task 6: Contenitore del pannello — PannelloAdmin (schede)

**Files:**
- Create: `dashboard/src/components/admin/PannelloAdmin.tsx`
- Test: `dashboard/src/components/admin/PannelloAdmin.test.tsx`

**Interfaces:**
- Consumes: `RichiesteInAttesa`, `UtentiAutorizzati`, `StoricoEsecuzioni`, `Configurazione` from their respective sibling files (Tasks 2-5).
- Produces: `PannelloAdmin(): JSX.Element`, zero-prop. Consumed by Task 8 (`App.tsx`).

- [ ] **Step 1: Write the failing test — `dashboard/src/components/admin/PannelloAdmin.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./RichiesteInAttesa', () => ({ RichiesteInAttesa: () => <div>Contenuto richieste</div> }));
vi.mock('./UtentiAutorizzati', () => ({ UtentiAutorizzati: () => <div>Contenuto utenti</div> }));
vi.mock('./StoricoEsecuzioni', () => ({ StoricoEsecuzioni: () => <div>Contenuto storico</div> }));
vi.mock('./Configurazione', () => ({ Configurazione: () => <div>Contenuto configurazione</div> }));

import { PannelloAdmin } from './PannelloAdmin';

describe('PannelloAdmin', () => {
  it('mostra la sezione Richieste di default', () => {
    render(<PannelloAdmin />);
    expect(screen.getByText('Contenuto richieste')).toBeInTheDocument();
  });

  it('passa alla sezione Utenti quando si clicca la scheda corrispondente', async () => {
    const utente = userEvent.setup();
    render(<PannelloAdmin />);
    await utente.click(screen.getByRole('tab', { name: 'Utenti' }));
    expect(screen.getByText('Contenuto utenti')).toBeInTheDocument();
    expect(screen.queryByText('Contenuto richieste')).not.toBeInTheDocument();
  });

  it('passa alla sezione Storico quando si clicca la scheda corrispondente', async () => {
    const utente = userEvent.setup();
    render(<PannelloAdmin />);
    await utente.click(screen.getByRole('tab', { name: 'Storico' }));
    expect(screen.getByText('Contenuto storico')).toBeInTheDocument();
  });

  it('passa alla sezione Configurazione quando si clicca la scheda corrispondente', async () => {
    const utente = userEvent.setup();
    render(<PannelloAdmin />);
    await utente.click(screen.getByRole('tab', { name: 'Configurazione' }));
    expect(screen.getByText('Contenuto configurazione')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run PannelloAdmin`
Expected: FAIL — `./PannelloAdmin` does not exist.

- [ ] **Step 3: Create `dashboard/src/components/admin/PannelloAdmin.tsx`**

```tsx
import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { RichiesteInAttesa } from './RichiesteInAttesa';
import { UtentiAutorizzati } from './UtentiAutorizzati';
import { StoricoEsecuzioni } from './StoricoEsecuzioni';
import { Configurazione } from './Configurazione';

const SEZIONI = ['richieste', 'utenti', 'storico', 'configurazione'] as const;
type Sezione = (typeof SEZIONI)[number];

export function PannelloAdmin() {
  const [sezione, setSezione] = useState<Sezione>('richieste');

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', px: 2, pb: 4 }}>
      <Tabs
        value={sezione}
        onChange={(_e, valore) => setSezione(valore)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2 }}
      >
        <Tab label="Richieste" value="richieste" sx={{ minHeight: 44 }} />
        <Tab label="Utenti" value="utenti" sx={{ minHeight: 44 }} />
        <Tab label="Storico" value="storico" sx={{ minHeight: 44 }} />
        <Tab label="Configurazione" value="configurazione" sx={{ minHeight: 44 }} />
      </Tabs>

      {sezione === 'richieste' && <RichiesteInAttesa />}
      {sezione === 'utenti' && <UtentiAutorizzati />}
      {sezione === 'storico' && <StoricoEsecuzioni />}
      {sezione === 'configurazione' && <Configurazione />}
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run PannelloAdmin`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/admin/PannelloAdmin.tsx dashboard/src/components/admin/PannelloAdmin.test.tsx
git commit -m "feat(dashboard): add PannelloAdmin tabbed container"
```

---

### Task 7: Schermata di login — richiesta di accesso

**Files:**
- Modify: `dashboard/src/components/LoginScreen.tsx`
- Modify: `dashboard/src/components/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase` (unchanged import, extended usage: `.from('richieste_accesso').insert(...)`).
- Produces: `LoginScreen` keeps its zero-prop signature.

- [ ] **Step 1: Write the failing tests — replace the entire content of `dashboard/src/components/LoginScreen.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signInWithOtpFinto = vi.fn(
  async (args: { email: string; options?: { emailRedirectTo?: string } }) => ({
    error: null as { message: string; code?: string } | null,
  })
);
const inserisciRichiestaFinto = vi.fn(async (valori: { email: string; nome: string; cognome: string }) => ({
  error: null as { message: string } | null,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (args: { email: string; options?: { emailRedirectTo?: string } }) =>
        signInWithOtpFinto(args),
    },
    from: () => ({
      insert: (valori: { email: string; nome: string; cognome: string }) => inserisciRichiestaFinto(valori),
    }),
  },
}));

import { LoginScreen } from './LoginScreen';

async function compilaEInvia(utente: ReturnType<typeof userEvent.setup>) {
  await utente.type(screen.getByLabelText('Nome'), 'Mario');
  await utente.type(screen.getByLabelText('Cognome'), 'Rossi');
  await utente.type(screen.getByLabelText('Email'), 'mario.rossi@esempio.it');
  await utente.click(screen.getByRole('button', { name: /invia link di accesso/i }));
}

describe('LoginScreen', () => {
  it('mostra un messaggio di conferma quando l\'email è già autorizzata', async () => {
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await compilaEInvia(utente);

    await waitFor(() => expect(screen.getByText(/ti abbiamo inviato un link/i)).toBeInTheDocument());
    expect(signInWithOtpFinto).toHaveBeenCalledWith({
      email: 'mario.rossi@esempio.it',
      options: { emailRedirectTo: window.location.href },
    });
    expect(inserisciRichiestaFinto).not.toHaveBeenCalled();
  });

  it('mostra un messaggio di errore generico se signInWithOtp fallisce per un altro motivo', async () => {
    signInWithOtpFinto.mockResolvedValueOnce({ error: { message: 'Troppe richieste, riprova più tardi' } });
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await compilaEInvia(utente);

    await waitFor(() => expect(screen.getByText('Troppe richieste, riprova più tardi')).toBeInTheDocument());
    expect(inserisciRichiestaFinto).not.toHaveBeenCalled();
  });

  it('invia una richiesta di accesso quando l\'email non è autorizzata', async () => {
    signInWithOtpFinto.mockResolvedValueOnce({
      error: { message: 'Signups not allowed for this instance', code: 'signup_disabled' },
    });
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await compilaEInvia(utente);

    await waitFor(() =>
      expect(inserisciRichiestaFinto).toHaveBeenCalledWith({
        email: 'mario.rossi@esempio.it',
        nome: 'Mario',
        cognome: 'Rossi',
      })
    );
    await waitFor(() => expect(screen.getByText(/richiesta di accesso è stata inviata/i)).toBeInTheDocument());
  });

  it('mostra un errore se l\'inserimento della richiesta di accesso fallisce', async () => {
    signInWithOtpFinto.mockResolvedValueOnce({
      error: { message: 'Signups not allowed for this instance', code: 'signup_disabled' },
    });
    inserisciRichiestaFinto.mockResolvedValueOnce({ error: { message: 'Errore di rete' } });
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await compilaEInvia(utente);

    await waitFor(() => expect(screen.getByText('Errore di rete')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run LoginScreen`
Expected: FAIL — no "Nome"/"Cognome" fields exist yet, `signup_disabled` branch doesn't exist.

- [ ] **Step 3: Replace `dashboard/src/components/LoginScreen.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { supabase } from '../lib/supabase';

export function LoginScreen() {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [inviato, setInviato] = useState(false);
  const [richiestaInviata, setRichiestaInviata] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [invioInCorso, setInvioInCorso] = useState(false);

  async function gestisciInvio(evento: FormEvent) {
    evento.preventDefault();
    setErrore(null);
    setInvioInCorso(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });

    if (!error) {
      setInvioInCorso(false);
      setInviato(true);
      return;
    }

    if (error.code === 'signup_disabled') {
      const { error: erroreRichiesta } = await supabase.from('richieste_accesso').insert({ email, nome, cognome });
      setInvioInCorso(false);
      if (erroreRichiesta) {
        setErrore(erroreRichiesta.message);
        return;
      }
      setRichiestaInviata(true);
      return;
    }

    setInvioInCorso(false);
    setErrore(error.message);
  }

  const messaggioConfermato = inviato
    ? `Ti abbiamo inviato un link di accesso a ${email}. Apri l'email e clicca il link per entrare.`
    : richiestaInviata
      ? "La tua richiesta di accesso è stata inviata. Riceverai un'email quando sarà approvata."
      : null;

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
            Fund Radar
          </Typography>
          {messaggioConfermato ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              {messaggioConfermato}
            </Alert>
          ) : (
            <Box component="form" onSubmit={gestisciInvio} sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Inserisci i tuoi dati per ricevere un link di accesso, o per richiederlo se non lo
                hai ancora.
              </Typography>
              <TextField
                label="Nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                fullWidth
                autoFocus
                required
                InputLabelProps={{ required: false }}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Cognome"
                value={cognome}
                onChange={(e) => setCognome(e.target.value)}
                fullWidth
                required
                InputLabelProps={{ required: false }}
                sx={{ mb: 2 }}
              />
              <TextField
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                InputLabelProps={{ required: false }}
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

Run: `cd dashboard && npx vitest run LoginScreen`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/LoginScreen.tsx dashboard/src/components/LoginScreen.test.tsx
git commit -m "feat(dashboard): fold access-request flow into the existing login screen"
```

---

### Task 8: App shell — pulsante Esci e accesso al pannello

**Files:**
- Modify: `dashboard/src/App.tsx`
- Modify: `dashboard/src/App.test.tsx`

**Interfaces:**
- Consumes: `eAmministratore` from `./lib/admin` (Task 1), `PannelloAdmin` from `./components/admin/PannelloAdmin` (Task 6).
- Produces: `App` keeps its default export, no props (entry component).

- [ ] **Step 1: Write the failing tests — replace the entire content of `dashboard/src/App.test.tsx`**

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';

vi.mock('./hooks/useAuth');
vi.mock('./lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock('./components/LoginScreen', () => ({ LoginScreen: () => <div>Schermata di login</div> }));
vi.mock('./components/ListaBandi', () => ({ ListaBandi: () => <div>Lista bandi</div> }));
vi.mock('./components/admin/PannelloAdmin', () => ({ PannelloAdmin: () => <div>Pannello admin</div> }));

import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';
import App from './App';

function creaSessioneFinta(email: string): Session {
  return { access_token: 'finto', user: { email } } as unknown as Session;
}

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

  it('mostra la lista bandi quando c\'è una sessione attiva di un utente non amministratore', () => {
    vi.mocked(useAuth).mockReturnValue({
      sessione: creaSessioneFinta('mario.rossi@esempio.it'),
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

  it('mostra il pulsante Esci quando c\'è una sessione, e lo chiama al click', async () => {
    vi.mocked(useAuth).mockReturnValue({
      sessione: creaSessioneFinta('mario.rossi@esempio.it'),
      caricamento: false,
    });
    const utente = userEvent.setup();
    render(<App />);

    await utente.click(screen.getByLabelText('Esci'));
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('non mostra il pulsante Esci quando non c\'è sessione', () => {
    vi.mocked(useAuth).mockReturnValue({ sessione: null, caricamento: false });
    render(<App />);
    expect(screen.queryByLabelText('Esci')).not.toBeInTheDocument();
  });

  it('non mostra il pulsante Pannello per un utente non amministratore', () => {
    vi.mocked(useAuth).mockReturnValue({
      sessione: creaSessioneFinta('mario.rossi@esempio.it'),
      caricamento: false,
    });
    render(<App />);
    expect(screen.queryByRole('button', { name: 'Pannello' })).not.toBeInTheDocument();
  });

  it('mostra il pulsante Pannello per l\'amministratore e passa alla vista pannello al click', async () => {
    vi.mocked(useAuth).mockReturnValue({
      sessione: creaSessioneFinta('panto75@gmail.com'),
      caricamento: false,
    });
    const utente = userEvent.setup();
    render(<App />);

    expect(screen.getByText('Lista bandi')).toBeInTheDocument();
    await utente.click(screen.getByRole('button', { name: 'Pannello' }));
    expect(screen.getByText('Pannello admin')).toBeInTheDocument();
    expect(screen.queryByText('Lista bandi')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run App`
Expected: FAIL — no logout button, no admin panel toggle exist yet.

- [ ] **Step 3: Replace `dashboard/src/App.tsx`**

```tsx
import { useMemo, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  IconButton,
  ThemeProvider,
  Toolbar,
  Typography,
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import { creaTemaQyros } from './theme';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';
import { eAmministratore } from './lib/admin';
import { LoginScreen } from './components/LoginScreen';
import { ListaBandi } from './components/ListaBandi';
import { PannelloAdmin } from './components/admin/PannelloAdmin';

function App() {
  const [modalita, setModalita] = useState<'light' | 'dark'>('dark');
  const [vistaAdmin, setVistaAdmin] = useState(false);
  const tema = useMemo(() => creaTemaQyros(modalita), [modalita]);
  const { sessione, caricamento } = useAuth();

  const utenteEAmministratore = eAmministratore(sessione?.user.email);

  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <AppBar position="sticky" color="secondary" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Fund Radar
          </Typography>
          {utenteEAmministratore && (
            <Button color="inherit" onClick={() => setVistaAdmin((v) => !v)} sx={{ minHeight: 44, mr: 1 }}>
              {vistaAdmin ? 'Bandi' : 'Pannello'}
            </Button>
          )}
          <IconButton
            color="inherit"
            onClick={() => setModalita((m) => (m === 'dark' ? 'light' : 'dark'))}
            aria-label="Cambia tema chiaro/scuro"
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            {modalita === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
          {sessione && (
            <IconButton
              color="inherit"
              onClick={() => supabase.auth.signOut()}
              aria-label="Esci"
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <LogoutIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ pt: 2 }}>
        {caricamento ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : sessione ? (
          vistaAdmin && utenteEAmministratore ? (
            <PannelloAdmin />
          ) : (
            <ListaBandi />
          )
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

Run: `cd dashboard && npx vitest run App`
Expected: PASS (8 tests)

- [ ] **Step 5: Run the full test suite, typecheck, and build**

Run: `cd dashboard && npm test && npx tsc --noEmit && npm run build`
Expected: all pass — this is the convergence point of this plan. All tests across every file (should be around 100 total across ~20 files), clean typecheck, successful production build.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/App.tsx dashboard/src/App.test.tsx
git commit -m "feat(dashboard): add logout button and admin panel toggle to App shell"
```

---

### Task 9: Verifica manuale nel browser e wrap-up

**Files:**
- Modify: `dashboard/README.md`

**Interfaces:**
- None — verification and documentation only.

- [ ] **Step 1: Start the local dev server and manually verify the new UI (without a real session)**

Run (from `dashboard/`): `cp .env.example .env` if `.env` doesn't already exist, fill in the real `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (same values as prior phases), then `npm run dev`.

Open the printed local URL. Confirm: the login screen now shows Nome, Cognome, and Email fields (in that order), all required. Confirm no console errors. This task's manual check is scoped to what's visible without a real authenticated session — the full authenticated flow (submitting an actual access request, seeing the admin panel with real data, approving/rejecting/revoking) is verified live after deploy, in a separate interactive step, using the admin-generated-session technique already established in this project (Fase 4b, Fase 6a).

- [ ] **Step 2: Update `dashboard/README.md`'s "Stato" section**

Replace the current "## Stato" section's content with an updated version that also covers this phase — read the file first to see its exact current wording (it was last updated at the end of Fase 5), then append a description of what Fase 6b added: the "Richiedi accesso" flow folded into the login screen, the 4-section admin panel (visible only to the administrator), and the logout button — all consuming the Fase 6a backend (database tables and the `admin-actions` Edge Function) that's already live.

- [ ] **Step 3: Commit**

```bash
git add dashboard/README.md
git commit -m "docs(dashboard): update README for Fase 6b"
```

---

## Fine Fase 6b — piano

Dopo l'esecuzione di tutti i task: revisione a due stadi per ciascun task, più una
revisione finale sull'intero insieme prima del merge — stessa disciplina delle fasi
precedenti. La verifica dal vivo con un accesso amministratore reale (approvare una
richiesta di prova, vedere l'elenco utenti aggiornarsi, controllare lo storico
esecuzioni con dati reali, aggiungere/rimuovere una parola chiave reale) avviene
dopo il merge e il deploy, in modo interattivo — stesso schema già usato per ogni
fase precedente di questo progetto.
