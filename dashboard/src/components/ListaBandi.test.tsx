import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Bando } from '../lib/types';

function creaBando(overrides: Partial<Bando> = {}): Bando {
  return {
    id: '1',
    fonte: 'eit',
    titolo: 'Bando A',
    descrizione: 'desc',
    url: 'https://esempio.it/a',
    scadenza: null,
    data_pubblicazione: '2026-01-01',
    priorita: 'alta',
    stato: 'nuovo',
    parole_corrispondenti: [],
    ...overrides,
  };
}

const aggiornaFinto = vi.fn(async (_valori: Partial<Bando>, _colonna: string, _valore: string) => ({
  error: null as { message: string } | null,
}));
let datiFinti: Bando[] = [];

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (tabella: string) => {
      if (tabella === 'parole_chiave') {
        return {
          select: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({ data: datiFinti, error: null }),
          }),
        }),
        update: (valori: Partial<Bando>) => ({
          eq: (colonna: string, valore: string) => aggiornaFinto(valori, colonna, valore),
        }),
      };
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}));

import { ListaBandi } from './ListaBandi';

describe('ListaBandi', () => {
  beforeEach(() => {
    aggiornaFinto.mockClear();
    datiFinti = [
      creaBando({ id: '1', titolo: 'Bando A' }),
      creaBando({ id: '2', titolo: 'Bando B', priorita: 'da_verificare' }),
    ];
  });

  it('mostra un indicatore di caricamento e poi i bandi ricevuti', async () => {
    render(<ListaBandi />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Bando A')).toBeInTheDocument());
    expect(screen.getByText('Bando B')).toBeInTheDocument();
  });

  it('mostra un messaggio quando nessun bando corrisponde ai filtri', async () => {
    datiFinti = [];
    render(<ListaBandi />);
    await waitFor(() => expect(screen.getByText(/nessun bando trovato/i)).toBeInTheDocument());
  });

  it('aggiorna lo stato su Supabase quando si clicca "segna come visto"', async () => {
    const utente = userEvent.setup();
    render(<ListaBandi />);
    await waitFor(() => expect(screen.getByText('Bando A')).toBeInTheDocument());

    const pulsanti = screen.getAllByRole('button', { name: /segna come visto/i });
    await utente.click(pulsanti[0]);

    await waitFor(() => expect(aggiornaFinto).toHaveBeenCalledWith({ stato: 'visto' }, 'id', '1'));
  });
});

describe('ListaBandi — fonti e persistenza', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mostra tutte le fonti attive configurate, non solo quelle con bandi già trovati', async () => {
    datiFinti = [creaBando({ id: '1', fonte: 'eit' })];
    render(<ListaBandi />);
    await waitFor(() => expect(screen.getByText('Bando A')).toBeInTheDocument());

    const utente = userEvent.setup();
    await utente.click(screen.getByLabelText('Fonte'));
    expect(await screen.findByRole('option', { name: 'regione-lombardia' })).toBeInTheDocument();
  });

  it('ripristina i filtri salvati da una visita precedente', async () => {
    localStorage.setItem(
      'qyros-dashboard-filtri',
      JSON.stringify({
        priorita: 'alta',
        fonti: [],
        paroleChiave: [],
        ricerca: '',
        ordinamento: 'data_pubblicazione',
        direzioneOrdinamento: 'decrescente',
      })
    );
    datiFinti = [creaBando({ id: '1', titolo: 'Bando A', priorita: 'alta' }), creaBando({ id: '2', titolo: 'Bando B', priorita: 'da_verificare' })];

    render(<ListaBandi />);
    await waitFor(() => expect(screen.getByText('Bando A')).toBeInTheDocument());
    expect(screen.queryByText('Bando B')).not.toBeInTheDocument();
  });

  it('salva i filtri quando l\'utente li cambia', async () => {
    datiFinti = [creaBando({ id: '1', titolo: 'Bando A' })];
    render(<ListaBandi />);
    await waitFor(() => expect(screen.getByText('Bando A')).toBeInTheDocument());

    const utente = userEvent.setup();
    await utente.click(screen.getByRole('button', { name: /match diretto/i }));

    const salvato = JSON.parse(localStorage.getItem('qyros-dashboard-filtri') ?? '{}');
    expect(salvato.priorita).toBe('alta');
  });
});
