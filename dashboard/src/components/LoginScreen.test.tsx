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
