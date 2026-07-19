# Accesso con link+codice e richiesta a due passi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any already-approved user (including the admin) complete login with either the email link or a 6-digit code, and reduce the access-request form to email-only for anyone who's already approved.

**Architecture:** No new tables, Edge Functions, or secrets. `LoginScreen.tsx` becomes a small state machine (`modulo` → `attesa-codice` / `richiesta-inviata`) built entirely on `supabase.auth.signInWithOtp` / `verifyOtp`, which Supabase already backs with a native one-time code alongside the existing magic link. The only non-code change is enabling that code in two Supabase Auth email templates (Magic Link, Invite) via the Supabase Dashboard.

**Tech Stack:** React 18 + TypeScript, MUI v6, `@supabase/supabase-js` `^2.47.10`, Vitest + Testing Library.

## Global Constraints

- No new database table, Edge Function, or secret — this feature is UI + Supabase Auth email-template configuration only (spec: "Nessuna nuova tabella, nessuna nuova Edge Function, nessun nuovo segreto").
- All interactive controls keep the existing 44px minimum touch target used across the dashboard (`sx={{ minHeight: 44 }}`).
- The admin (`panto75@gmail.com`) is never special-cased in `LoginScreen.tsx` — same email, same two options (link or code), as everyone else.
- No attempt-counter or lockout UI for the code field in this phase — an invalid/expired code shows an error and a way to go back to Step 1 and request a new one.
- `supabase.auth.verifyOtp` uses `type: 'email'` — the code shown by `LoginScreen` always originates from a `signInWithOtp` call the component itself just made in the current page load, never from an out-of-band invite email opened independently, so `type: 'invite'` is never needed client-side (resolved during planning; the spec had flagged this as open).
- All UI copy is Italian, matching the rest of the dashboard.

---

## Task 1: Two-step login form — email first, name/surname only when needed

**Files:**
- Modify: `dashboard/src/components/LoginScreen.tsx`
- Modify: `dashboard/src/components/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })` (existing), `supabase.from('richieste_accesso').insert({ email, nome, cognome })` (existing) — both already mocked in the test file's `vi.mock('../lib/supabase', ...)`.
- Produces: internal state `fase: 'modulo' | 'attesa-codice' | 'richiesta-inviata'` and `mostraCampiNuovoUtente: boolean`, both consumed by Task 2 (which adds the `'attesa-codice'` rendering branch and the code form).

- [ ] **Step 1: Write the failing tests for the two-step form**

Replace the full contents of `dashboard/src/components/LoginScreen.test.tsx` with:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signInWithOtpFinto = vi.fn(
  async (args: { email: string; options?: { emailRedirectTo?: string } }) => ({
    error: null as { message: string; code?: string } | null,
  })
);
const verifyOtpFinto = vi.fn(
  async (args: { email: string; token: string; type: string }) => ({
    error: null as { message: string } | null,
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
      verifyOtp: (args: { email: string; token: string; type: string }) => verifyOtpFinto(args),
    },
    from: () => ({
      insert: (valori: { email: string; nome: string; cognome: string }) => inserisciRichiestaFinto(valori),
    }),
  },
}));

import { LoginScreen } from './LoginScreen';

describe('LoginScreen — Passo 1 (email)', () => {
  it('mostra solo il campo Email all\'avvio, nessun campo Nome/Cognome', () => {
    render(<LoginScreen />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cognome')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accedi' })).toBeInTheDocument();
  });

  it('email già autorizzata: invia il codice e passa al riquadro di verifica, senza chiedere nome/cognome', async () => {
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await utente.type(screen.getByLabelText('Email'), 'mario.rossi@esempio.it');
    await utente.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(signInWithOtpFinto).toHaveBeenCalledWith({
      email: 'mario.rossi@esempio.it',
      options: { emailRedirectTo: window.location.href },
    });
    await waitFor(() => expect(screen.getByText(/ti abbiamo inviato un link di accesso/i)).toBeInTheDocument());
    expect(inserisciRichiestaFinto).not.toHaveBeenCalled();
  });

  it('email non autorizzata: espande il modulo chiedendo Nome e Cognome, senza inviare ancora la richiesta', async () => {
    signInWithOtpFinto.mockResolvedValueOnce({
      error: { message: 'Signups not allowed for this instance', code: 'signup_disabled' },
    });
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await utente.type(screen.getByLabelText('Email'), 'nuovo@esempio.it');
    await utente.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() => expect(screen.getByLabelText('Nome')).toBeInTheDocument());
    expect(screen.getByLabelText('Cognome')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Richiedi accesso' })).toBeInTheDocument();
    expect(inserisciRichiestaFinto).not.toHaveBeenCalled();
  });

  it('completando Nome/Cognome dopo l\'espansione, invia la richiesta di accesso una sola volta', async () => {
    signInWithOtpFinto.mockResolvedValueOnce({
      error: { message: 'Signups not allowed for this instance', code: 'signup_disabled' },
    });
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await utente.type(screen.getByLabelText('Email'), 'nuovo@esempio.it');
    await utente.click(screen.getByRole('button', { name: 'Accedi' }));
    await waitFor(() => expect(screen.getByLabelText('Nome')).toBeInTheDocument());

    await utente.type(screen.getByLabelText('Nome'), 'Mario');
    await utente.type(screen.getByLabelText('Cognome'), 'Rossi');
    await utente.click(screen.getByRole('button', { name: 'Richiedi accesso' }));

    await waitFor(() =>
      expect(inserisciRichiestaFinto).toHaveBeenCalledWith({
        email: 'nuovo@esempio.it',
        nome: 'Mario',
        cognome: 'Rossi',
      })
    );
    expect(signInWithOtpFinto).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText(/richiesta di accesso è stata inviata/i)).toBeInTheDocument());
  });

  it('mostra un messaggio di errore generico se signInWithOtp fallisce per un altro motivo', async () => {
    signInWithOtpFinto.mockResolvedValueOnce({ error: { message: 'Troppe richieste, riprova più tardi' } });
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await utente.type(screen.getByLabelText('Email'), 'mario.rossi@esempio.it');
    await utente.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() => expect(screen.getByText('Troppe richieste, riprova più tardi')).toBeInTheDocument());
    expect(inserisciRichiestaFinto).not.toHaveBeenCalled();
  });

  it('mostra un errore se l\'inserimento della richiesta di accesso fallisce', async () => {
    signInWithOtpFinto.mockResolvedValueOnce({
      error: { message: 'Signups not allowed for this instance', code: 'signup_disabled' },
    });
    inserisciRichiestaFinto.mockResolvedValueOnce({ error: { message: 'Errore di rete' } });
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await utente.type(screen.getByLabelText('Email'), 'nuovo@esempio.it');
    await utente.click(screen.getByRole('button', { name: 'Accedi' }));
    await waitFor(() => expect(screen.getByLabelText('Nome')).toBeInTheDocument());
    await utente.type(screen.getByLabelText('Nome'), 'Mario');
    await utente.type(screen.getByLabelText('Cognome'), 'Rossi');
    await utente.click(screen.getByRole('button', { name: 'Richiedi accesso' }));

    await waitFor(() => expect(screen.getByText('Errore di rete')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dashboard && npm test -- LoginScreen`
Expected: FAIL — `LoginScreen` still renders Nome/Cognome/Email together and a button labelled "Invia link di accesso", so `getByLabelText('Nome')` at the top level and `getByRole('button', { name: 'Accedi' })` do not match.

- [ ] **Step 3: Replace `LoginScreen.tsx` with the two-step form**

Replace the full contents of `dashboard/src/components/LoginScreen.tsx` with:

```tsx
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { supabase } from '../lib/supabase';

type Fase = 'modulo' | 'attesa-codice' | 'richiesta-inviata';

export function LoginScreen() {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [mostraCampiNuovoUtente, setMostraCampiNuovoUtente] = useState(false);
  const [fase, setFase] = useState<Fase>('modulo');
  const [errore, setErrore] = useState<string | null>(null);
  const [invioInCorso, setInvioInCorso] = useState(false);

  async function gestisciInvioModulo(evento: FormEvent) {
    evento.preventDefault();
    setErrore(null);
    setInvioInCorso(true);

    try {
      if (mostraCampiNuovoUtente) {
        const { error: erroreRichiesta } = await supabase.from('richieste_accesso').insert({ email, nome, cognome });
        if (erroreRichiesta) {
          setErrore(erroreRichiesta.message);
          return;
        }
        setFase('richiesta-inviata');
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      });

      if (!error) {
        setFase('attesa-codice');
        return;
      }

      if (error.code === 'signup_disabled') {
        setMostraCampiNuovoUtente(true);
        return;
      }

      setErrore(error.message);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setInvioInCorso(false);
    }
  }

  if (fase === 'richiesta-inviata') {
    return (
      <SchermataCentrata>
        <Alert severity="success" sx={{ mt: 2 }}>
          La tua richiesta di accesso è stata inviata. Riceverai un'email quando sarà approvata.
        </Alert>
      </SchermataCentrata>
    );
  }

  if (fase === 'attesa-codice') {
    return (
      <SchermataCentrata>
        <Alert severity="success" sx={{ mt: 2 }}>
          Ti abbiamo inviato un link di accesso a {email}. Apri l'email e clicca il link per
          entrare.
        </Alert>
      </SchermataCentrata>
    );
  }

  return (
    <SchermataCentrata>
      <Box component="form" onSubmit={gestisciInvioModulo} sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Inserisci la tua email per ricevere un link di accesso, o per richiederlo se non lo hai
          ancora.
        </Typography>
        <TextField
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          autoFocus
          required
          disabled={mostraCampiNuovoUtente}
          InputLabelProps={{ required: false }}
          sx={{ mb: 2 }}
        />
        {mostraCampiNuovoUtente && (
          <>
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
          </>
        )}
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
          {invioInCorso ? 'Invio in corso...' : mostraCampiNuovoUtente ? 'Richiedi accesso' : 'Accedi'}
        </Button>
      </Box>
    </SchermataCentrata>
  );
}

function SchermataCentrata({ children }: { children: React.ReactNode }) {
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
          {children}
        </CardContent>
      </Card>
    </Box>
  );
}
```

Note: the `fase === 'attesa-codice'` branch here shows the same link-only confirmation message the app has always shown — a fully working, independently testable deliverable. Task 2 replaces this branch's body with the code-entry form (different message plus the "Codice" field), it does not add a parallel branch.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd dashboard && npm test -- LoginScreen`
Expected: PASS (6 tests). The `verifyOtpFinto` mock added in Step 1 is unused until Task 2 — this causes no failure, just an unused-mock (TypeScript may flag `verifyOtpFinto` as declared-but-unused only if referenced nowhere; it IS referenced inside the `vi.mock` factory, so no compiler error).

- [ ] **Step 5: Typecheck and commit**

Run: `cd dashboard && npm run typecheck`
Expected: no errors.

```bash
git add dashboard/src/components/LoginScreen.tsx dashboard/src/components/LoginScreen.test.tsx
git commit -m "feat(dashboard): two-step login form, email first"
```

---

## Task 2: Code-entry step and verification (mobile-friendly)

**Files:**
- Modify: `dashboard/src/components/LoginScreen.tsx`
- Modify: `dashboard/src/components/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: `fase`, `mostraCampiNuovoUtente`, `email`, `SchermataCentrata` from Task 1 (same file, no import needed).
- Consumes: `supabase.auth.verifyOtp({ email, token, type: 'email' })` — new call, added to the existing `vi.mock('../lib/supabase', ...)` mock in Task 1's test rewrite (`verifyOtpFinto` is already wired in the mock; this task starts exercising it).
- Produces: nothing consumed by later tasks — this is the last dashboard code task.

- [ ] **Step 1: Write the failing tests for the code step**

Append a **new** `describe` block at the end of `dashboard/src/components/LoginScreen.test.tsx`, after the existing `describe('LoginScreen — Passo 1 (email)', ...)` block (do not nest it inside):

```tsx
describe('LoginScreen — riquadro codice', () => {
  async function inviaEmailAutorizzata(utente: ReturnType<typeof userEvent.setup>) {
    render(<LoginScreen />);
    await utente.type(screen.getByLabelText('Email'), 'mario.rossi@esempio.it');
    await utente.click(screen.getByRole('button', { name: 'Accedi' }));
    await waitFor(() => expect(screen.getByLabelText('Codice')).toBeInTheDocument());
  }

  it('mostra il campo Codice con tastiera numerica dopo l\'invio dell\'email', async () => {
    const utente = userEvent.setup();
    await inviaEmailAutorizzata(utente);

    const campoCodice = screen.getByLabelText('Codice');
    expect(campoCodice).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByRole('button', { name: 'Verifica codice' })).toBeInTheDocument();
  });

  it('codice corretto: chiama verifyOtp con email, codice e type email', async () => {
    const utente = userEvent.setup();
    await inviaEmailAutorizzata(utente);

    await utente.type(screen.getByLabelText('Codice'), '123456');
    await utente.click(screen.getByRole('button', { name: 'Verifica codice' }));

    await waitFor(() =>
      expect(verifyOtpFinto).toHaveBeenCalledWith({
        email: 'mario.rossi@esempio.it',
        token: '123456',
        type: 'email',
      })
    );
  });

  it('codice sbagliato: mostra l\'errore e un modo per tornare al passo 1', async () => {
    verifyOtpFinto.mockResolvedValueOnce({ error: { message: 'Token has expired or is invalid' } });
    const utente = userEvent.setup();
    await inviaEmailAutorizzata(utente);

    await utente.type(screen.getByLabelText('Codice'), '000000');
    await utente.click(screen.getByRole('button', { name: 'Verifica codice' }));

    await waitFor(() => expect(screen.getByText('Token has expired or is invalid')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Richiedi un nuovo codice' }));
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByLabelText('Codice')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dashboard && npm test -- LoginScreen`
Expected: FAIL — no element with label "Codice" exists yet (`fase === 'attesa-codice'` currently renders nothing extra).

- [ ] **Step 3: Add the code step to `LoginScreen.tsx`**

In `dashboard/src/components/LoginScreen.tsx`, add two pieces of state right after the existing `useState` calls:

```tsx
  const [codice, setCodice] = useState('');
  const [verificaInCorso, setVerificaInCorso] = useState(false);
```

Add the verification handler and the reset-to-step-1 handler, right after `gestisciInvioModulo`:

```tsx
  async function gestisciVerificaCodice(evento: FormEvent) {
    evento.preventDefault();
    setErrore(null);
    setVerificaInCorso(true);

    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: codice, type: 'email' });
      if (error) {
        setErrore(error.message);
      }
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setVerificaInCorso(false);
    }
  }

  function richiediNuovoCodice() {
    setFase('modulo');
    setMostraCampiNuovoUtente(false);
    setCodice('');
    setErrore(null);
  }
```

Replace the `if (fase === 'attesa-codice')` block added in Task 1 (the one showing the link-only confirmation) with this version:

```tsx
  if (fase === 'attesa-codice') {
    return (
      <SchermataCentrata>
        <Alert severity="success" sx={{ mt: 2, mb: 2 }}>
          Ti abbiamo inviato un link di accesso a {email}. Apri l'email e clicca il link per
          entrare, oppure inserisci qui sotto il codice a 6 cifre che trovi nella stessa email.
        </Alert>
        <Box component="form" onSubmit={gestisciVerificaCodice}>
          <TextField
            label="Codice"
            value={codice}
            onChange={(e) => setCodice(e.target.value)}
            fullWidth
            autoFocus
            required
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
            InputLabelProps={{ required: false }}
            sx={{
              mb: 2,
              '& input': { fontSize: '1.5rem', letterSpacing: '0.5rem', textAlign: 'center' },
            }}
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
            disabled={verificaInCorso}
            sx={{ minHeight: 44, mb: 1 }}
          >
            {verificaInCorso ? 'Verifica in corso...' : 'Verifica codice'}
          </Button>
          <Button variant="text" fullWidth onClick={richiediNuovoCodice} sx={{ minHeight: 44 }}>
            Richiedi un nuovo codice
          </Button>
        </Box>
      </SchermataCentrata>
    );
  }
```

`inputProps={{ inputMode: 'numeric', ... }}` (same pattern as the existing `ora` field in `Configurazione.tsx:163`) opens the numeric keypad on mobile instead of the full keyboard; `pattern: '[0-9]*'` reinforces this on iOS Safari specifically. `minHeight: 44` on both buttons matches the touch-target convention used everywhere else in the dashboard.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd dashboard && npm test -- LoginScreen`
Expected: PASS (9 tests total: 6 from Task 1 + 3 new).

- [ ] **Step 5: Typecheck, full test suite, and commit**

Run: `cd dashboard && npm run typecheck && npm test`
Expected: no errors, all suites pass.

```bash
git add dashboard/src/components/LoginScreen.tsx dashboard/src/components/LoginScreen.test.tsx
git commit -m "feat(dashboard): add 6-digit code entry alongside the login link"
```

---

## Task 3: Enable the code in Supabase's email templates

**Files:**
- Create: `supabase/email-templates/magic-link.html`
- Create: `supabase/email-templates/invite.html`
- Create: `supabase/email-templates/README.md`

**Interfaces:**
- Consumes: nothing from Task 1/2 code — this is Supabase Auth project configuration, independent of the dashboard bundle.
- Produces: nothing consumed by other tasks — this is the last task in the plan.

This task has no automated test: Supabase Auth email templates are hosted-project configuration with no CLI/API deploy path reachable from this environment (confirmed against Supabase's docs — for hosted projects, "copy the templates into the Email Templates section of the Dashboard"; the Management API PATCH endpoint exists but needs a personal access token this environment doesn't have). The files below are the tracked source of truth (same pattern as `supabase/functions/admin-actions/README.md` for the Edge Function deploy step); publishing them is a guided manual step, verified live.

- [ ] **Step 1: Create the tracked template files**

Create `supabase/email-templates/magic-link.html`:

```html
<h2>Your sign-in link</h2>
<p>Follow the link below to sign in. This link expires shortly and can only be used once.</p>
<p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
<p>Or enter this code instead: <strong>{{ .Token }}</strong></p>
```

Create `supabase/email-templates/invite.html`:

```html
<h2>You've been invited</h2>
<p>You've been invited to create an account. Follow the link below to accept.</p>
<p><a href="{{ .ConfirmationURL }}">Accept invitation</a></p>
<p>Or enter this code instead: <strong>{{ .Token }}</strong></p>
```

Both are the current Supabase default template content (confirmed against Supabase's own documentation for the `mailer_templates_magic_link_content` / `mailer_templates_invite_content` defaults) with one line added: the `{{ .Token }}` variable, which Supabase populates with the same 6-digit one-time code backing the link, on both templates. No other line changes — subjects stay "Your sign-in link" and "You've been invited".

Create `supabase/email-templates/README.md`:

```markdown
# Supabase Auth email templates

Tracked copies of the two Auth email templates this project customizes.
Hosted Supabase projects have no CLI/API deploy path reachable without a
personal access token, so these are pasted in manually — this directory is
the source of truth to copy from, the Dashboard is where they actually run.

## Publishing a change

1. Go to `supabase.com/dashboard/project/atcdtnmwbllvdeikswfk/auth/templates`.
2. Pick the template ("Magic Link" or "Invite user").
3. Replace its content with the matching file here.
4. Save.

## Why both show a 6-digit code

Supabase generates a `{{ .Token }}` (code) tied to the same one-time pass as
`{{ .ConfirmationURL }}` (link) for every auth email. Showing both lets a
user complete login by typing the code even if the link gets silently
consumed first — e.g. by a mail provider's automated link-prefetching /
safe-link scanning, which Supabase's own docs list as a known cause of
"Token has expired or is invalid" on a link the user never actually clicked.
```

- [ ] **Step 2: Commit the tracked template files**

```bash
git add supabase/email-templates/
git commit -m "docs(supabase): track email templates that add the 6-digit code"
```

- [ ] **Step 3: Publish both templates to the live Supabase project**

Guided browser step (not automatable from this environment): open
`https://supabase.com/dashboard/project/atcdtnmwbllvdeikswfk/auth/templates`,
select **Magic Link**, replace its body with the content of
`supabase/email-templates/magic-link.html`, save; repeat for **Invite user**
with `supabase/email-templates/invite.html`.

- [ ] **Step 4: Verify live**

On the deployed dashboard (`https://darthkazuya.github.io/qyros-bandi-monitor/`):
request a login link for an already-authorized email, confirm the received
email shows both the link and a 6-digit code, and that typing the code into
the new "Codice" field logs you in. Then, from the admin panel, approve a
fresh test request and confirm the invite email also shows both the link and
a code.

Expected: both emails show the code; entering it in the dashboard's code
field completes login in both cases.
