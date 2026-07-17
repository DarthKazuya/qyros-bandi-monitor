import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';

// `vi.mock('./hooks/useAuth')` sotto è un automock: Vitest esegue il modulo reale
// per scoprirne la forma prima di sostituirlo. `useAuth.ts` importa `../lib/supabase`,
// che lancia un errore se le variabili d'ambiente Supabase non sono impostate (vedi
// `src/lib/supabase.ts`). Lo stub qui sotto evita quell'errore in fase di collect,
// con lo stesso pattern già usato in LoginScreen.test.tsx e ListaBandi.test.tsx.
vi.mock('./lib/supabase', () => ({ supabase: {} }));
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
