import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BandoCard } from './BandoCard';
import type { Bando } from '../lib/types';

function dataLocaleISO(data: Date): string {
  const anno = data.getFullYear();
  const mese = String(data.getMonth() + 1).padStart(2, '0');
  const giorno = String(data.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

function creaBando(overrides: Partial<Bando> = {}): Bando {
  return {
    id: '1',
    fonte: 'eit',
    titolo: 'Bando di test',
    descrizione: 'Descrizione',
    url: 'https://esempio.it/bando-test',
    scadenza: '2026-12-31',
    data_pubblicazione: null,
    priorita: 'alta',
    stato: 'nuovo',
    parole_corrispondenti: ['gaming'],
    ...overrides,
  };
}

describe('BandoCard', () => {
  it('mostra la parola chiave corrispondente invece di un\'etichetta astratta', () => {
    render(<BandoCard bando={creaBando({ parole_corrispondenti: ['fintech'] })} onCambiaStato={vi.fn()} />);
    expect(screen.getByText('Corrisponde a: fintech')).toBeInTheDocument();
  });

  it('elenca più parole corrispondenti separate da virgola', () => {
    render(<BandoCard bando={creaBando({ parole_corrispondenti: ['gaming', 'fintech'] })} onCambiaStato={vi.fn()} />);
    expect(screen.getByText('Corrisponde a: gaming, fintech')).toBeInTheDocument();
  });

  it('non mostra il vecchio badge "Match diretto"/"Da verificare"', () => {
    render(<BandoCard bando={creaBando({ priorita: 'alta', parole_corrispondenti: ['gaming'] })} onCambiaStato={vi.fn()} />);
    expect(screen.queryByText('Match diretto')).not.toBeInTheDocument();
    expect(screen.queryByText('Da verificare')).not.toBeInTheDocument();
  });

  it('mostra titolo, fonte e scadenza formattata in italiano', () => {
    render(<BandoCard bando={creaBando({ titolo: 'Bando gaming 2026', fonte: 'eit', scadenza: '2026-12-31' })} onCambiaStato={vi.fn()} />);
    expect(screen.getByText('Bando gaming 2026')).toBeInTheDocument();
    expect(screen.getByText(/eit/)).toBeInTheDocument();
    expect(screen.getByText(/31\/12\/2026/)).toBeInTheDocument();
  });

  it('non mostra la scadenza quando è null', () => {
    render(<BandoCard bando={creaBando({ scadenza: null })} onCambiaStato={vi.fn()} />);
    expect(screen.queryByText(/scadenza/i)).not.toBeInTheDocument();
  });

  it('mostra un link al bando che apre in una nuova scheda', () => {
    render(<BandoCard bando={creaBando({ url: 'https://esempio.it/bando-test' })} onCambiaStato={vi.fn()} />);
    const link = screen.getByRole('link', { name: /vai al bando/i });
    expect(link).toHaveAttribute('href', 'https://esempio.it/bando-test');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('chiama onCambiaStato con "visto" quando si clicca su un bando nuovo', async () => {
    const utente = userEvent.setup();
    const onCambiaStato = vi.fn();
    render(<BandoCard bando={creaBando({ id: '1', stato: 'nuovo' })} onCambiaStato={onCambiaStato} />);

    await utente.click(screen.getByRole('button', { name: /segna come visto/i }));
    expect(onCambiaStato).toHaveBeenCalledWith('1', 'visto');
  });

  it('chiama onCambiaStato con "nuovo" quando si clicca su un bando già visto', async () => {
    const utente = userEvent.setup();
    const onCambiaStato = vi.fn();
    render(<BandoCard bando={creaBando({ id: '1', stato: 'visto' })} onCambiaStato={onCambiaStato} />);

    await utente.click(screen.getByRole('button', { name: /segna come nuovo/i }));
    expect(onCambiaStato).toHaveBeenCalledWith('1', 'nuovo');
  });

  it('mostra il conto alla rovescia per una scadenza futura', () => {
    const tra20Giorni = new Date();
    tra20Giorni.setDate(tra20Giorni.getDate() + 20);
    const scadenza = dataLocaleISO(tra20Giorni);

    render(<BandoCard bando={creaBando({ scadenza })} onCambiaStato={vi.fn()} />);
    expect(screen.getByText('20 giorni alla scadenza')).toBeInTheDocument();
  });

  it('mostra "Scaduto" per una scadenza passata', () => {
    const ieri = new Date();
    ieri.setDate(ieri.getDate() - 1);
    const scadenza = dataLocaleISO(ieri);

    render(<BandoCard bando={creaBando({ scadenza })} onCambiaStato={vi.fn()} />);
    expect(screen.getByText('Scaduto')).toBeInTheDocument();
  });

  it('non mostra alcun badge di conto alla rovescia quando la scadenza è null', () => {
    render(<BandoCard bando={creaBando({ scadenza: null })} onCambiaStato={vi.fn()} />);
    expect(screen.queryByText(/alla scadenza/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Scaduto')).not.toBeInTheDocument();
  });
});
