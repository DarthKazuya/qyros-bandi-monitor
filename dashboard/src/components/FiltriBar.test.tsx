import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiltriBar } from './FiltriBar';
import type { FiltriStato } from '../lib/filtriBandi';

const filtriBase: FiltriStato = {
  priorita: 'tutti',
  fonti: [],
  paroleChiave: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
  direzioneOrdinamento: 'decrescente',
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

  it('la sezione parole chiave è chiusa di default e si apre al tap', async () => {
    const utente = userEvent.setup();
    render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit']} onCambiaFiltri={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'gaming' })).not.toBeInTheDocument();
    await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
    expect(screen.getByRole('button', { name: 'gaming' })).toBeInTheDocument();
  });

  it('chiama onCambiaFiltri con la parola chiave selezionata', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit']} onCambiaFiltri={onCambiaFiltri} />);

    await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
    await utente.click(screen.getByRole('button', { name: 'gaming' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, paroleChiave: ['gaming'] });
  });

  it('deseleziona una parola chiave già selezionata', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    const filtriConParola = { ...filtriBase, paroleChiave: ['gaming'] };
    render(<FiltriBar filtri={filtriConParola} fontiDisponibili={['eit']} onCambiaFiltri={onCambiaFiltri} />);

    await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
    await utente.click(screen.getByRole('button', { name: 'gaming' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, paroleChiave: [] });
  });

  it('chiama onCambiaFiltri con la direzione invertita quando si clicca il pulsante di direzione', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    render(<FiltriBar filtri={filtriBase} fontiDisponibili={['eit']} onCambiaFiltri={onCambiaFiltri} />);

    await utente.click(screen.getByLabelText(/inverti direzione ordinamento/i));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, direzioneOrdinamento: 'crescente' });
  });
});
