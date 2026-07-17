import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signInWithOtpFinto = vi.fn(async (args: { email: string; options?: { emailRedirectTo?: string } }) => ({
  error: null as { message: string } | null,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (args: { email: string; options?: { emailRedirectTo?: string } }) =>
        signInWithOtpFinto(args),
    },
  },
}));

import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  it('mostra un messaggio di conferma dopo aver inviato il link', async () => {
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await utente.type(screen.getByLabelText('Email'), 'test@esempio.it');
    await utente.click(screen.getByRole('button', { name: /invia link di accesso/i }));

    await waitFor(() => expect(screen.getByText(/ti abbiamo inviato un link/i)).toBeInTheDocument());
    expect(signInWithOtpFinto).toHaveBeenCalledWith({
      email: 'test@esempio.it',
      options: { emailRedirectTo: window.location.href },
    });
  });

  it('usa la URL corrente (percorso incluso) come redirect del link di accesso', async () => {
    const utente = userEvent.setup();
    render(<LoginScreen />);

    await utente.type(screen.getByLabelText('Email'), 'test@esempio.it');
    await utente.click(screen.getByRole('button', { name: /invia link di accesso/i }));

    await waitFor(() => expect(signInWithOtpFinto).toHaveBeenCalled());
    const chiamata = signInWithOtpFinto.mock.calls.at(-1)?.[0];
    expect(chiamata?.options?.emailRedirectTo).toBe(window.location.href);
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
