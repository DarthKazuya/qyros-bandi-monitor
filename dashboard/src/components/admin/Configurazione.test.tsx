import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ImpostazioniJob, ParolaChiave } from '../../lib/types';

let paroleFinte: ParolaChiave[] = [];
let impostazioniFinte: ImpostazioniJob | null = null;
const inserisciFinto = vi.fn(async (valori: Partial<ParolaChiave>) => ({
  data: { id: '99', ...valori },
  error: null as { message: string } | null,
}));
const eliminaFinto = vi.fn(async (colonna: string, valore: string) => ({
  error: null as { message: string } | null,
}));
const aggiornaOraFinto = vi.fn(async (valori: Partial<ImpostazioniJob>, colonna: string, valore: number) => ({
  error: null as { message: string } | null,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (tabella: string) => {
      if (tabella === 'parole_chiave') {
        return {
          select: () => ({
            order: async () => ({ data: paroleFinte, error: null }),
          }),
          insert: (valori: Partial<ParolaChiave>) => ({
            select: () => ({
              single: async () => inserisciFinto(valori),
            }),
          }),
          delete: () => ({
            eq: (colonna: string, valore: string) => eliminaFinto(colonna, valore),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: impostazioniFinte, error: null }),
          }),
        }),
        update: (valori: Partial<ImpostazioniJob>) => ({
          eq: (colonna: string, valore: number) => aggiornaOraFinto(valori, colonna, valore),
        }),
      };
    },
  },
}));

import { Configurazione } from './Configurazione';

describe('Configurazione', () => {
  beforeEach(() => {
    inserisciFinto.mockClear();
    eliminaFinto.mockClear();
    aggiornaOraFinto.mockClear();
    paroleFinte = [
      { id: '1', parola: 'gaming', livello: 'livello1' },
      { id: '2', parola: 'startup', livello: 'livello2' },
    ];
    impostazioniFinte = { id: 1, ora: 8, fuso_orario: 'Europe/Rome' };
  });

  it('mostra le parole chiave raggruppate per livello', async () => {
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming')).toBeInTheDocument());
    expect(screen.getByText('startup')).toBeInTheDocument();
  });

  it('mostra l\'ora attuale', async () => {
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByDisplayValue('8')).toBeInTheDocument());
  });

  it('aggiunge una nuova parola chiave', async () => {
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming')).toBeInTheDocument());

    await utente.type(screen.getByLabelText('Nuova parola chiave'), 'fintech');
    await utente.click(screen.getByRole('button', { name: 'Aggiungi' }));

    await waitFor(() => expect(inserisciFinto).toHaveBeenCalledWith({ parola: 'fintech', livello: 'livello2' }));
  });

  it('rimuove una parola chiave esistente', async () => {
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming')).toBeInTheDocument());

    const chipGaming = screen.getByText('gaming').closest('.MuiChip-root') as HTMLElement;
    const pulsanteElimina = within(chipGaming).getByTestId('CancelIcon');
    await utente.click(pulsanteElimina);

    await waitFor(() => expect(eliminaFinto).toHaveBeenCalledWith('id', '1'));
  });

  it('salva la nuova ora', async () => {
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByDisplayValue('8')).toBeInTheDocument());

    const campoOra = screen.getByLabelText('Ora (0-23)');
    await utente.clear(campoOra);
    await utente.type(campoOra, '9');
    await utente.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(aggiornaOraFinto).toHaveBeenCalledWith({ ora: 9 }, 'id', 1));
  });
});
