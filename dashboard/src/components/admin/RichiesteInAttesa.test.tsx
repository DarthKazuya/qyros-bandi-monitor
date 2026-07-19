import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RichiestaAccesso } from '../../lib/types';

function creaRichiesta(overrides: Partial<RichiestaAccesso> = {}): RichiestaAccesso {
  return {
    id: '1',
    email: 'mario.rossi@esempio.it',
    nome: 'Mario',
    cognome: 'Rossi',
    richiesto_il: '2026-07-15T10:00:00Z',
    stato: 'in_attesa',
    ...overrides,
  };
}

const aggiornaFinto = vi.fn(async (valori: Partial<RichiestaAccesso>, colonna: string, valore: string) => ({
  error: null as { message: string } | null,
}));
let datiFinti: RichiestaAccesso[] = [];

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: datiFinti, error: null }),
        }),
      }),
      update: (valori: Partial<RichiestaAccesso>) => ({
        eq: (colonna: string, valore: string) => aggiornaFinto(valori, colonna, valore),
      }),
    }),
  },
}));

const chiamaAdminActionsFinta = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
vi.mock('../../lib/admin', () => ({
  chiamaAdminActions: (...args: unknown[]) => chiamaAdminActionsFinta(...args),
}));

import { RichiesteInAttesa } from './RichiesteInAttesa';

describe('RichiesteInAttesa', () => {
  beforeEach(() => {
    aggiornaFinto.mockClear();
    chiamaAdminActionsFinta.mockClear();
    datiFinti = [creaRichiesta()];
  });

  it('mostra le richieste in attesa', async () => {
    render(<RichiesteInAttesa />);
    await waitFor(() => expect(screen.getByText('Mario Rossi')).toBeInTheDocument());
    expect(screen.getByText(/mario.rossi@esempio.it/)).toBeInTheDocument();
  });

  it('mostra un messaggio quando non ci sono richieste', async () => {
    datiFinti = [];
    render(<RichiesteInAttesa />);
    await waitFor(() => expect(screen.getByText('Nessuna richiesta in attesa.')).toBeInTheDocument());
  });

  it('approvando chiama la Edge Function e rimuove la richiesta dall\'elenco', async () => {
    const utente = userEvent.setup();
    render(<RichiesteInAttesa />);
    await waitFor(() => expect(screen.getByText('Mario Rossi')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Approva' }));

    await waitFor(() =>
      expect(chiamaAdminActionsFinta).toHaveBeenCalledWith('approva_richiesta', {
        id: '1',
        email: 'mario.rossi@esempio.it',
      })
    );
    await waitFor(() => expect(screen.queryByText('Mario Rossi')).not.toBeInTheDocument());
  });

  it('rifiutando aggiorna lo stato direttamente e rimuove la richiesta dall\'elenco', async () => {
    const utente = userEvent.setup();
    render(<RichiesteInAttesa />);
    await waitFor(() => expect(screen.getByText('Mario Rossi')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Rifiuta' }));

    await waitFor(() => expect(aggiornaFinto).toHaveBeenCalledWith({ stato: 'rifiutata' }, 'id', '1'));
    await waitFor(() => expect(screen.queryByText('Mario Rossi')).not.toBeInTheDocument());
  });

  it('mostra un errore se l\'approvazione fallisce', async () => {
    chiamaAdminActionsFinta.mockRejectedValueOnce(new Error('Utente già esistente'));
    const utente = userEvent.setup();
    render(<RichiesteInAttesa />);
    await waitFor(() => expect(screen.getByText('Mario Rossi')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Approva' }));

    await waitFor(() => expect(screen.getByText('Utente già esistente')).toBeInTheDocument());
    expect(screen.getByText('Mario Rossi')).toBeInTheDocument();
  });
});
