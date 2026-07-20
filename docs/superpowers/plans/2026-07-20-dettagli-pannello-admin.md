# Dettagli pannello admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show full date+time on pending requests, store and display nome/cognome for authorized users, and always show the admin first with an "(ADMIN)" label.

**Architecture:** Three independent, sequential slices: (1) a formatting-only change in `RichiesteInAttesa.tsx`, (2) a data-flow change threading `nome`/`cognome` from the approval action into Supabase Auth `user_metadata` and back out through `elenco_utenti`, (3) a display-only change in `UtentiAutorizzati.tsx` consuming what (2) now returns.

**Tech Stack:** React 18 + TypeScript, MUI v6, Deno Edge Function (Supabase), Vitest + Testing Library.

## Global Constraints

- Single admin only, hardcoded as `EMAIL_AMMINISTRATORE` (`panto75@gmail.com`) — no multi-admin/roles work in this plan.
- No backfill for existing non-admin users without `user_metadata` — they display email-only, unchanged from today. The admin's own `user_metadata` backfill is already done (SQL in `supabase/schema.sql`, applied 2026-07-20).
- Session persistence (`dashboard/src/lib/supabase.ts`) is untouched — already `persistSession: true` by default for everyone.
- All UI copy is Italian.
- All interactive controls keep the existing 44px minimum touch target (`sx={{ minHeight: 44 }}`).

---

## Task 1: Show date and time (to the second) on pending requests

**Files:**
- Modify: `dashboard/src/components/admin/RichiesteInAttesa.tsx`
- Test: `dashboard/src/components/admin/RichiesteInAttesa.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks (independent of Tasks 2 and 3).

- [ ] **Step 1: Write the failing test**

Add this test to `dashboard/src/components/admin/RichiesteInAttesa.test.tsx`, inside the existing `describe('RichiesteInAttesa', ...)` block, after the `'mostra le richieste in attesa'` test:

```tsx
  it('mostra data e ora complete di secondi nella richiesta', async () => {
    render(<RichiesteInAttesa />);
    await waitFor(() => expect(screen.getByText('Mario Rossi')).toBeInTheDocument());
    expect(
      screen.getByText((testo) => /richiesta il \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}/.test(testo))
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd dashboard && npm test -- RichiesteInAttesa`
Expected: FAIL — the current text only has `richiesta il 15/07/2026` (no time), so the regex requiring `HH:MM:SS` after the date does not match.

- [ ] **Step 3: Update `formattaData`**

In `dashboard/src/components/admin/RichiesteInAttesa.tsx`, replace:

```tsx
function formattaData(data: string): string {
  return new Date(data).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
```

with:

```tsx
function formattaData(data: string): string {
  return new Date(data).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd dashboard && npm test -- RichiesteInAttesa`
Expected: PASS (6 tests: 5 existing + 1 new).

- [ ] **Step 5: Typecheck and commit**

Run: `cd dashboard && npm run typecheck`
Expected: no errors.

```bash
git add dashboard/src/components/admin/RichiesteInAttesa.tsx dashboard/src/components/admin/RichiesteInAttesa.test.tsx
git commit -m "feat(dashboard): show full date and time on pending access requests"
```

---

## Task 2: Store nome/cognome on the account at approval, expose them from elenco_utenti

**Files:**
- Modify: `dashboard/src/lib/types.ts`
- Modify: `dashboard/src/components/admin/RichiesteInAttesa.tsx`
- Test: `dashboard/src/components/admin/RichiesteInAttesa.test.tsx`
- Modify: `supabase/functions/admin-actions/index.ts`
- Modify: `supabase/functions/admin-actions/README.md`

**Interfaces:**
- Consumes: `RichiestaAccesso` (existing, has `nome`/`cognome` already).
- Produces: `UtenteAutorizzato` gains optional `nome?: string` and `cognome?: string`, consumed by Task 3's `UtentiAutorizzati.tsx`. The Edge Function's `elenco_utenti` response shape becomes `{ utenti: { id, email, nome?, cognome? }[] }`.

- [ ] **Step 1: Write the failing test**

In `dashboard/src/components/admin/RichiesteInAttesa.test.tsx`, replace the existing assertion in the `'approvando chiama la Edge Function e rimuove la richiesta dall\'elenco'` test:

```tsx
    await waitFor(() =>
      expect(chiamaAdminActionsFinta).toHaveBeenCalledWith('approva_richiesta', {
        id: '1',
        email: 'mario.rossi@esempio.it',
      })
    );
```

with:

```tsx
    await waitFor(() =>
      expect(chiamaAdminActionsFinta).toHaveBeenCalledWith('approva_richiesta', {
        id: '1',
        email: 'mario.rossi@esempio.it',
        nome: 'Mario',
        cognome: 'Rossi',
      })
    );
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd dashboard && npm test -- RichiesteInAttesa`
Expected: FAIL — `chiamaAdminActionsFinta` is currently called without `nome`/`cognome`, so the exact-match assertion fails.

- [ ] **Step 3: Add `nome`/`cognome` to the `UtenteAutorizzato` type**

In `dashboard/src/lib/types.ts`, replace:

```ts
export interface UtenteAutorizzato {
  id: string;
  email: string;
}
```

with:

```ts
export interface UtenteAutorizzato {
  id: string;
  email: string;
  nome?: string;
  cognome?: string;
}
```

- [ ] **Step 4: Send nome/cognome when approving**

In `dashboard/src/components/admin/RichiesteInAttesa.tsx`, replace the `approva` function:

```tsx
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
```

with:

```tsx
  async function approva(richiesta: RichiestaAccesso) {
    setErrore(null);
    setAzioneInCorso(richiesta.id);
    try {
      await chiamaAdminActions('approva_richiesta', {
        id: richiesta.id,
        email: richiesta.email,
        nome: richiesta.nome,
        cognome: richiesta.cognome,
      });
      setRichieste((precedenti) => precedenti.filter((r) => r.id !== richiesta.id));
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
    setAzioneInCorso(null);
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd dashboard && npm test -- RichiesteInAttesa`
Expected: PASS (6 tests).

- [ ] **Step 6: Update the Edge Function to store and return nome/cognome**

In `supabase/functions/admin-actions/index.ts`, replace the `approva_richiesta` block:

```ts
  if (corpo.azione === 'approva_richiesta') {
    const { id, email: emailRichiedente } = corpo;
    if (!id || !emailRichiedente) {
      return risposta({ errore: 'id ed email sono obbligatori' }, 400);
    }

    const { error: erroreCreazione } = await client.auth.admin.inviteUserByEmail(emailRichiedente, {
      redirectTo: URL_DASHBOARD,
    });
```

with:

```ts
  if (corpo.azione === 'approva_richiesta') {
    const { id, email: emailRichiedente, nome, cognome } = corpo;
    if (!id || !emailRichiedente) {
      return risposta({ errore: 'id ed email sono obbligatori' }, 400);
    }

    const { error: erroreCreazione } = await client.auth.admin.inviteUserByEmail(emailRichiedente, {
      redirectTo: URL_DASHBOARD,
      data: { nome, cognome },
    });
```

(the rest of the `approva_richiesta` block — updating `richieste_accesso.stato` and the response — is unchanged)

Then replace the `elenco_utenti` block:

```ts
  if (corpo.azione === 'elenco_utenti') {
    const { data, error } = await client.auth.admin.listUsers();
    if (error) {
      return risposta({ errore: error.message }, 500);
    }
    const utenti = data.users.map((u) => ({ id: u.id, email: u.email }));
    return risposta({ utenti }, 200);
  }
```

with:

```ts
  if (corpo.azione === 'elenco_utenti') {
    const { data, error } = await client.auth.admin.listUsers();
    if (error) {
      return risposta({ errore: error.message }, 500);
    }
    const utenti = data.users.map((u) => ({
      id: u.id,
      email: u.email,
      nome: u.user_metadata?.nome as string | undefined,
      cognome: u.user_metadata?.cognome as string | undefined,
    }));
    return risposta({ utenti }, 200);
  }
```

- [ ] **Step 7: Update the Edge Function README**

In `supabase/functions/admin-actions/README.md`, replace:

```markdown
- `elenco_utenti` — nessun parametro aggiuntivo. Restituisce `{ utenti: [...] }`.
- `approva_richiesta` — richiede `id` (id della riga in `richieste_accesso`) ed
  `email`. Crea l'utente Supabase Auth, gli invia l'email di invito con il link
  di accesso (`inviteUserByEmail`) e marca la richiesta come approvata.
```

with:

```markdown
- `elenco_utenti` — nessun parametro aggiuntivo. Restituisce
  `{ utenti: [{ id, email, nome?, cognome? }] }` — `nome`/`cognome` provengono
  da `user_metadata` e sono assenti per utenti creati prima che questo campo
  esistesse.
- `approva_richiesta` — richiede `id` (id della riga in `richieste_accesso`),
  `email`, e opzionalmente `nome`/`cognome` (salvati in `user_metadata`
  dell'utente Supabase Auth creato). Crea l'utente, gli invia l'email di
  invito con il link di accesso (`inviteUserByEmail`) e marca la richiesta
  come approvata.
```

- [ ] **Step 8: Full dashboard test suite, typecheck, and commit**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: no errors, all suites pass.

```bash
git add dashboard/src/lib/types.ts dashboard/src/components/admin/RichiesteInAttesa.tsx dashboard/src/components/admin/RichiesteInAttesa.test.tsx supabase/functions/admin-actions/index.ts supabase/functions/admin-actions/README.md
git commit -m "feat: store nome/cognome in user_metadata at approval, return from elenco_utenti"
```

---

## Task 3: Show nome/cognome, sort the admin first, label with "(ADMIN)"

**Files:**
- Modify: `dashboard/src/components/admin/UtentiAutorizzati.tsx`
- Test: `dashboard/src/components/admin/UtentiAutorizzati.test.tsx`

**Interfaces:**
- Consumes: `UtenteAutorizzato` (from Task 2) with optional `nome?`/`cognome?`; `EMAIL_AMMINISTRATORE` from `../../lib/admin` (existing import, unchanged).
- Produces: nothing consumed by later tasks — last task in this plan.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `dashboard/src/components/admin/UtentiAutorizzati.test.tsx` with:

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

  it('mostra nome e cognome come testo principale, email come sottotitolo', async () => {
    chiamaAdminActionsFinta.mockResolvedValueOnce({
      utenti: [{ id: '2', email: 'mario.rossi@esempio.it', nome: 'Mario', cognome: 'Rossi' }],
    });
    render(<UtentiAutorizzati />);
    await waitFor(() => expect(screen.getByText('Mario Rossi')).toBeInTheDocument());
    expect(screen.getByText('mario.rossi@esempio.it')).toBeInTheDocument();
  });

  it('mostra solo l\'email quando nome/cognome non sono disponibili', async () => {
    chiamaAdminActionsFinta.mockResolvedValueOnce({
      utenti: [{ id: '2', email: 'mario.rossi@esempio.it' }],
    });
    render(<UtentiAutorizzati />);
    await waitFor(() => expect(screen.getByText('mario.rossi@esempio.it')).toBeInTheDocument());
  });

  it('mostra l\'amministratore con "(ADMIN)" dopo il nome', async () => {
    chiamaAdminActionsFinta.mockResolvedValueOnce({
      utenti: [{ id: '1', email: 'panto75@gmail.com', nome: 'Luca', cognome: 'Panto' }],
    });
    render(<UtentiAutorizzati />);
    await waitFor(() => expect(screen.getByText('Luca Panto (ADMIN)')).toBeInTheDocument());
    expect(screen.getByText('panto75@gmail.com')).toBeInTheDocument();
  });

  it('ordina sempre l\'amministratore per primo, indipendentemente dall\'ordine ricevuto', async () => {
    chiamaAdminActionsFinta.mockResolvedValueOnce({
      utenti: [
        { id: '2', email: 'mario.rossi@esempio.it', nome: 'Mario', cognome: 'Rossi' },
        { id: '1', email: 'panto75@gmail.com', nome: 'Luca', cognome: 'Panto' },
      ],
    });
    render(<UtentiAutorizzati />);
    await waitFor(() => expect(screen.getByText('Luca Panto (ADMIN)')).toBeInTheDocument());
    const testi = screen.getAllByText(/Panto|Rossi/).map((el) => el.textContent);
    expect(testi[0]).toContain('Luca Panto');
  });

  it('non mostra il pulsante Revoca per l\'amministratore stesso', async () => {
    chiamaAdminActionsFinta.mockResolvedValueOnce({
      utenti: [{ id: '1', email: 'panto75@gmail.com', nome: 'Luca', cognome: 'Panto' }],
    });
    render(<UtentiAutorizzati />);
    await waitFor(() => expect(screen.getByText('Luca Panto (ADMIN)')).toBeInTheDocument());
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

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dashboard && npm test -- UtentiAutorizzati`
Expected: FAIL — the component currently renders only `utente.email` with no name, no "(ADMIN)" suffix, and no admin-first sort.

- [ ] **Step 3: Rewrite `UtentiAutorizzati.tsx`**

Replace the full contents of `dashboard/src/components/admin/UtentiAutorizzati.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { chiamaAdminActions, EMAIL_AMMINISTRATORE } from '../../lib/admin';
import type { UtenteAutorizzato } from '../../lib/types';

function ordinaAmministratorePerPrimo(utenti: UtenteAutorizzato[]): UtenteAutorizzato[] {
  return [...utenti].sort((a, b) => {
    if (a.email === EMAIL_AMMINISTRATORE) return -1;
    if (b.email === EMAIL_AMMINISTRATORE) return 1;
    return 0;
  });
}

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
          {ordinaAmministratorePerPrimo(utenti).map((utente) => {
            const nomeCompleto = utente.nome && utente.cognome ? `${utente.nome} ${utente.cognome}` : null;
            const eAmministratore = utente.email === EMAIL_AMMINISTRATORE;
            const testoPrincipale = (nomeCompleto ?? utente.email) + (eAmministratore ? ' (ADMIN)' : '');

            return (
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
                <Box>
                  <Typography>{testoPrincipale}</Typography>
                  {nomeCompleto && (
                    <Typography variant="body2" color="text.secondary">
                      {utente.email}
                    </Typography>
                  )}
                </Box>
                {!eAmministratore && (
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
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd dashboard && npm test -- UtentiAutorizzati`
Expected: PASS (7 tests).

- [ ] **Step 5: Full suite, typecheck, and commit**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: no errors, all suites pass.

```bash
git add dashboard/src/components/admin/UtentiAutorizzati.tsx dashboard/src/components/admin/UtentiAutorizzati.test.tsx
git commit -m "feat(dashboard): show nome/cognome, sort admin first, label with (ADMIN)"
```

---

## Manual verification (no automated coverage — Edge Function + live email)

After all three tasks are merged and the Edge Function is deployed
(`npx supabase functions deploy admin-actions --project-ref atcdtnmwbllvdeikswfk --use-api`,
or the Supabase Dashboard's in-browser Edge Function editor if the CLI isn't
authenticated — same constraint as prior phases):

1. Submit a fresh test access request, approve it from the panel, and
   confirm in "Utenti autorizzati" that the new user shows their real
   name with email underneath.
2. Confirm the admin's row ("Luca Panto (ADMIN)") appears first regardless
   of where Supabase's `listUsers()` places it.
3. Confirm "Richieste in attesa" shows the full timestamp including seconds
   for a fresh request.
