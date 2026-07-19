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
import { beforeEach } from 'vitest';

describe('LoginScreen — Passo 1 (email)', () => {
  beforeEach(() => {
    signInWithOtpFinto.mockClear();
    verifyOtpFinto.mockClear();
    inserisciRichiestaFinto.mockClear();
    signInWithOtpFinto.mockResolvedValue({
      error: null as { message: string; code?: string } | null,
    });
  });
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

  it('permette di tornare indietro e correggere l\'email dopo l\'espansione a Nome/Cognome', async () => {
    signInWithOtpFinto.mockResolvedValueOnce({
      error: { message: 'Signups not allowed for this instance', code: 'signup_disabled' },
    });
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await utente.type(screen.getByLabelText('Email'), 'errore@esempio.it');
    await utente.click(screen.getByRole('button', { name: 'Accedi' }));
    await waitFor(() => expect(screen.getByLabelText('Nome')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Cambia email' }));

    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cognome')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).not.toBeDisabled();
    expect(inserisciRichiestaFinto).not.toHaveBeenCalled();
  });
});

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

    await waitFor(() => expect(screen.getByText('Il codice non è corretto o è scaduto. Richiedine uno nuovo.')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Richiedi un nuovo codice' }));
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByLabelText('Codice')).not.toBeInTheDocument();
  });
});
