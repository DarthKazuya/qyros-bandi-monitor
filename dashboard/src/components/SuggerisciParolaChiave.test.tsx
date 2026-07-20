import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const inserisciFinto = vi.fn(async (valori: { parola: string }) => ({
  error: null as { message: string } | null,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (valori: { parola: string }) => inserisciFinto(valori),
    }),
  },
}));

import { SuggerisciParolaChiave } from './SuggerisciParolaChiave';

describe('SuggerisciParolaChiave', () => {
  beforeEach(() => {
    inserisciFinto.mockClear();
  });

  it('invia il suggerimento e mostra una conferma', async () => {
    const utente = userEvent.setup();
    render(<SuggerisciParolaChiave />);

    await utente.type(screen.getByLabelText('Suggerisci una parola chiave'), 'blockchain');
    await utente.click(screen.getByRole('button', { name: 'Invia' }));

    await waitFor(() => expect(inserisciFinto).toHaveBeenCalledWith({ parola: 'blockchain' }));
    await waitFor(() => expect(screen.getByText(/suggerimento inviato/i)).toBeInTheDocument());
  });

  it('non invia nulla se il campo è vuoto', async () => {
    const utente = userEvent.setup();
    render(<SuggerisciParolaChiave />);

    await utente.click(screen.getByRole('button', { name: 'Invia' }));

    expect(inserisciFinto).not.toHaveBeenCalled();
  });

  it('mostra un errore se l\'invio fallisce', async () => {
    inserisciFinto.mockResolvedValueOnce({ error: { message: 'Errore di rete' } });
    const utente = userEvent.setup();
    render(<SuggerisciParolaChiave />);

    await utente.type(screen.getByLabelText('Suggerisci una parola chiave'), 'blockchain');
    await utente.click(screen.getByRole('button', { name: 'Invia' }));

    await waitFor(() => expect(screen.getByText('Errore di rete')).toBeInTheDocument());
  });
});
