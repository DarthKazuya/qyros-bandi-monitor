import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiltriBar } from './FiltriBar';
import type { FiltriStato } from '../lib/filtriBandi';
import type { ParolaChiave } from '../lib/types';

const filtriBase: FiltriStato = {
  fonti: [],
  paroleChiave: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
  direzioneOrdinamento: 'decrescente',
};

const paroleChiaveEsempio: ParolaChiave[] = [
  { id: 'p1', parola: 'gaming', livello: 'livello1', contatore_click: 0 },
];

function renderFiltriBar(props: Partial<ComponentProps<typeof FiltriBar>> = {}) {
  return render(
    <FiltriBar
      filtri={filtriBase}
      fontiDisponibili={['eit']}
      paroleChiaveDisponibili={paroleChiaveEsempio}
      numeroRisultati={5}
      onCambiaFiltri={vi.fn()}
      onParolaChiaveCliccata={vi.fn()}
      {...props}
    />
  );
}

describe('FiltriBar', () => {
  it('chiama onCambiaFiltri con il testo di ricerca aggiornato', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    renderFiltriBar({ onCambiaFiltri });

    await utente.type(screen.getByPlaceholderText(/cerca per titolo/i), 'g');
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, ricerca: 'g' });
  });

  it('permette di selezionare più fonti (multi-select)', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    renderFiltriBar({ fontiDisponibili: ['eit', 'invitalia'], onCambiaFiltri });

    await utente.click(screen.getByLabelText('Fonte'));
    await utente.click(await screen.findByRole('option', { name: 'eit' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, fonti: ['eit'] });
  });

  it('chiama onCambiaFiltri quando si cambia ordinamento a scadenza', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    renderFiltriBar({ onCambiaFiltri });

    await utente.click(screen.getByLabelText('Ordina per'));
    await utente.click(await screen.findByRole('option', { name: 'Scadenza' }));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, ordinamento: 'scadenza' });
  });

  it('la sezione parole chiave è chiusa di default e si apre al tap', async () => {
    const utente = userEvent.setup();
    renderFiltriBar();

    expect(screen.queryByRole('button', { name: 'gaming' })).not.toBeInTheDocument();
    await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
    expect(screen.getByRole('button', { name: 'gaming' })).toBeInTheDocument();
  });

  it('chiama onCambiaFiltri e onParolaChiaveCliccata con la parola chiave selezionata', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    const onParolaChiaveCliccata = vi.fn();
    renderFiltriBar({ onCambiaFiltri, onParolaChiaveCliccata });

    await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
    await utente.click(screen.getByRole('button', { name: 'gaming' }));

    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, paroleChiave: ['gaming'] });
    expect(onParolaChiaveCliccata).toHaveBeenCalledWith('p1');
  });

  it('deseleziona una parola chiave già selezionata, e conta comunque il click', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    const onParolaChiaveCliccata = vi.fn();
    renderFiltriBar({ filtri: { ...filtriBase, paroleChiave: ['gaming'] }, onCambiaFiltri, onParolaChiaveCliccata });

    await utente.click(screen.getByRole('button', { name: /parole chiave/i }));
    await utente.click(screen.getByRole('button', { name: 'gaming' }));

    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, paroleChiave: [] });
    expect(onParolaChiaveCliccata).toHaveBeenCalledWith('p1');
  });

  it('chiama onCambiaFiltri con la direzione invertita quando si clicca il pulsante di direzione', async () => {
    const utente = userEvent.setup();
    const onCambiaFiltri = vi.fn();
    renderFiltriBar({ onCambiaFiltri });

    await utente.click(screen.getByLabelText(/inverti direzione ordinamento/i));
    expect(onCambiaFiltri).toHaveBeenCalledWith({ ...filtriBase, direzioneOrdinamento: 'crescente' });
  });

  it('mostra accanto a "Parole chiave" il numero di bandi trovati con la selezione attuale, non il numero di parole selezionate', () => {
    renderFiltriBar({ filtri: { ...filtriBase, paroleChiave: ['gaming', 'startup'] }, numeroRisultati: 7 });
    expect(screen.getByText('Parole chiave (7 bandi)')).toBeInTheDocument();
  });

  it('usa il singolare quando il risultato è un solo bando', () => {
    renderFiltriBar({ numeroRisultati: 1 });
    expect(screen.getByText('Parole chiave (1 bando)')).toBeInTheDocument();
  });
});
