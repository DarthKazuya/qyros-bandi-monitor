import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signInWithOtpFinto = vi.fn(async (args: { email: string }) => ({ error: null as { message: string } | null }));

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
