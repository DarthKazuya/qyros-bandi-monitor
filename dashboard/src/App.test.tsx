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
