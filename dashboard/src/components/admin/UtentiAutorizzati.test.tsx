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
