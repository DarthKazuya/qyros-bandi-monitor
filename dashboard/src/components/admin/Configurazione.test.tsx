import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ImpostazioniJob, ParolaChiave, SuggerimentoParolaChiave } from '../../lib/types';

let paroleFinte: ParolaChiave[] = [];
let impostazioniFinte: ImpostazioniJob | null = null;
let suggerimentiFinti: SuggerimentoParolaChiave[] = [];
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
const aggiornaSuggerimentoFinto = vi.fn(async (valori: Partial<SuggerimentoParolaChiave>, colonna: string, valore: string) => ({
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
      if (tabella === 'suggerimenti_parole_chiave') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: suggerimentiFinti, error: null }),
            }),
          }),
          update: (valori: Partial<SuggerimentoParolaChiave>) => ({
            eq: (colonna: string, valore: string) => aggiornaSuggerimentoFinto(valori, colonna, valore),
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
    aggiornaSuggerimentoFinto.mockClear();
    paroleFinte = [
      { id: '1', parola: 'gaming', livello: 'livello1', contatore_click: 12 },
      { id: '2', parola: 'startup', livello: 'livello2', contatore_click: 0 },
    ];
    impostazioniFinte = { id: 1, ora: 8, fuso_orario: 'Europe/Rome' };
    suggerimentiFinti = [];
  });

  it('mostra le parole chiave raggruppate per livello', async () => {
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming (12)')).toBeInTheDocument());
    expect(screen.getByText('startup (0)')).toBeInTheDocument();
  });

  it('mostra l\'ora attuale', async () => {
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByDisplayValue('8')).toBeInTheDocument());
  });

  it('aggiunge una nuova parola chiave', async () => {
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming (12)')).toBeInTheDocument());

    await utente.type(screen.getByLabelText('Nuova parola chiave'), 'fintech');
    await utente.click(screen.getByRole('button', { name: 'Aggiungi' }));

    await waitFor(() => expect(inserisciFinto).toHaveBeenCalledWith({ parola: 'fintech', livello: 'livello2' }));
  });

  it('rimuove una parola chiave esistente', async () => {
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('gaming (12)')).toBeInTheDocument());

    const chipGaming = screen.getByText('gaming (12)').closest('.MuiChip-root') as HTMLElement;
    const pulsanteElimina = within(chipGaming).getByTestId('CancelIcon');
    await utente.click(pulsanteElimina);

    await waitFor(() => expect(eliminaFinto).toHaveBeenCalledWith('id', '1'));
  });

  it('mostra quante volte ogni parola chiave è stata usata come filtro', async () => {
    render(<Configurazione />);
    // MUI Chip rende `label` come un unico nodo di testo, quindi il conteggio
    // non è isolabile da 'gaming': verifichiamo l'etichetta completa.
    await waitFor(() => expect(screen.getByText('gaming (12)')).toBeInTheDocument());
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

  it('mostra i suggerimenti in attesa', async () => {
    suggerimentiFinti = [
      { id: 's1', parola: 'blockchain', proposto_da: 'mario.rossi@esempio.it', proposto_il: '2026-07-20T10:00:00Z', stato: 'in_attesa' },
    ];
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('blockchain')).toBeInTheDocument());
    expect(screen.getByText(/mario.rossi@esempio.it/)).toBeInTheDocument();
  });

  it('accettando un suggerimento lo aggiunge alle parole chiave e lo rimuove dall\'elenco', async () => {
    suggerimentiFinti = [
      { id: 's1', parola: 'blockchain', proposto_da: 'mario.rossi@esempio.it', proposto_il: '2026-07-20T10:00:00Z', stato: 'in_attesa' },
    ];
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('blockchain')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Accetta' }));

    await waitFor(() => expect(inserisciFinto).toHaveBeenCalledWith({ parola: 'blockchain', livello: 'livello2' }));
    await waitFor(() =>
      expect(aggiornaSuggerimentoFinto).toHaveBeenCalledWith({ stato: 'accettato' }, 'id', 's1')
    );
    await waitFor(() => expect(screen.queryByText(/proposto da/)).not.toBeInTheDocument());
  });

  it('rifiutando un suggerimento aggiorna solo il suo stato', async () => {
    suggerimentiFinti = [
      { id: 's1', parola: 'blockchain', proposto_da: 'mario.rossi@esempio.it', proposto_il: '2026-07-20T10:00:00Z', stato: 'in_attesa' },
    ];
    const utente = userEvent.setup();
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('blockchain')).toBeInTheDocument());

    await utente.click(screen.getByRole('button', { name: 'Rifiuta' }));

    await waitFor(() =>
      expect(aggiornaSuggerimentoFinto).toHaveBeenCalledWith({ stato: 'rifiutato' }, 'id', 's1')
    );
    expect(inserisciFinto).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('blockchain')).not.toBeInTheDocument());
  });

  it('mostra un messaggio quando non ci sono suggerimenti in attesa', async () => {
    render(<Configurazione />);
    await waitFor(() => expect(screen.getByText('Nessun suggerimento in attesa.')).toBeInTheDocument());
  });
});
