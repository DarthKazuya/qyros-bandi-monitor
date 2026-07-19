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
