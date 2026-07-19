import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./RichiesteInAttesa', () => ({ RichiesteInAttesa: () => <div>Contenuto richieste</div> }));
vi.mock('./UtentiAutorizzati', () => ({ UtentiAutorizzati: () => <div>Contenuto utenti</div> }));
vi.mock('./StoricoEsecuzioni', () => ({ StoricoEsecuzioni: () => <div>Contenuto storico</div> }));
vi.mock('./Configurazione', () => ({ Configurazione: () => <div>Contenuto configurazione</div> }));

import { PannelloAdmin } from './PannelloAdmin';

describe('PannelloAdmin', () => {
  it('mostra la sezione Richieste di default', () => {
    render(<PannelloAdmin />);
    expect(screen.getByText('Contenuto richieste')).toBeInTheDocument();
  });

  it('passa alla sezione Utenti quando si clicca la scheda corrispondente', async () => {
    const utente = userEvent.setup();
    render(<PannelloAdmin />);
    await utente.click(screen.getByRole('tab', { name: 'Utenti' }));
    expect(screen.getByText('Contenuto utenti')).toBeInTheDocument();
    expect(screen.queryByText('Contenuto richieste')).not.toBeInTheDocument();
  });

  it('passa alla sezione Storico quando si clicca la scheda corrispondente', async () => {
    const utente = userEvent.setup();
    render(<PannelloAdmin />);
    await utente.click(screen.getByRole('tab', { name: 'Storico' }));
    expect(screen.getByText('Contenuto storico')).toBeInTheDocument();
  });

  it('passa alla sezione Configurazione quando si clicca la scheda corrispondente', async () => {
    const utente = userEvent.setup();
    render(<PannelloAdmin />);
    await utente.click(screen.getByRole('tab', { name: 'Configurazione' }));
    expect(screen.getByText('Contenuto configurazione')).toBeInTheDocument();
  });
});
