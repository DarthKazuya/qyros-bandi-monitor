import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiltriBar } from './FiltriBar';
import type { FiltriStato } from '../lib/filtriBandi';

const filtriBase: FiltriStato = {
  priorita: 'tutti',
  fonti: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
};

describe('FiltriBar', () => {
  it('chiama onCambiaFiltri con il testo di ricerca aggiornato', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit']} onCambiaFiltri={onCambiaFiltri} />);

    await utente.type(screen.getByPlaceholderText(/cerca per titolo/i), 'g');
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, ricerca: 'g' });
  });

  it('chiama onCambiaFiltri quando si seleziona "Match diretto"', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit']} onCambiaFiltri={onCambiaFiltri} />);

    await utente.click(screen.getByRole('button', { name: 'Match diretto' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, priorita: 'alta' });
  });

  it('permette di selezionare più fonti (multi-select)', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit', 'invitalia']} onCambiaFiltri={onCambiaFiltri} />);

    await utente.click(screen.getByLabelText('Fonte'));
    await utente.click(await screen.findByRole('option', { name: 'eit' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, fonti: ['eit'] });
  });

  it('chiama onCambiaFiltri quando si cambia ordinamento a scadenza', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit']} onCambiaFiltri={onCambiaFiltri} />);

    await utente.click(screen.getByLabelText('Ordina per'));
    await utente.click(await screen.findByRole('option', { name: 'Scadenza' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, ordinamento: 'scadenza' });
  });
});
