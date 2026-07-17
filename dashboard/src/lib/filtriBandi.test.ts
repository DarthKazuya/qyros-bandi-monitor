import { describe, expect, it } from 'vitest';
import { applicaFiltri, type FiltriStato } from './filtriBandi';
import type { Bando } from './types';

function creaBando(overrides: Partial<Bando> = {}): Bando {
  return {
    id: '1',
    fonte: 'eit',
    titolo: 'Bando gaming',
    descrizione: 'desc',
    url: 'https://esempio.it/1',
    scadenza: null,
    data_pubblicazione: null,
    priorita: 'alta',
    stato: 'nuovo',
    ...overrides,
  };
}

const filtriBase: FiltriStato = {
  priorita: 'tutti',
  fonti: [],
  ricerca: '',
  ordinamento: 'data_pubblicazione',
};

describe('applicaFiltri', () => {
  it('non filtra nulla con i filtri di default', () => {
    const bandi = [creaBando({ id: '1' }), creaBando({ id: '2' })];
    expect(applicaFiltri(bandi, filtriBase).map((b) => b.id)).toEqual(['1', '2']);
  });

  it('filtra per priorita alta', () => {
    const bandi = [creaBando({ id: '1', priorita: 'alta' }), creaBando({ id: '2', priorita: 'da_verificare' })];
    const risultato = applicaFiltri(bandi, { ...filtriBase, priorita: 'alta' });
    expect(risultato.map((b) => b.id)).toEqual(['1']);
  });

  it('filtra per una o più fonti selezionate (multi-select)', () => {
    const bandi = [
      creaBando({ id: '1', fonte: 'eit' }),
      creaBando({ id: '2', fonte: 'invitalia' }),
      creaBando({ id: '3', fonte: 'europa-creativa-media' }),
    ];
    const risultato = applicaFiltri(bandi, { ...filtriBase, fonti: ['eit', 'invitalia'] });
    expect(risultato.map((b) => b.id).sort()).toEqual(['1', '2']);
  });

  it('filtra per testo libero su titolo e descrizione, case-insensitive', () => {
    const bandi = [
      creaBando({ id: '1', titolo: 'Bando Gaming 2026' }),
      creaBando({ id: '2', titolo: 'Altro bando', descrizione: 'per il settore GAMING' }),
      creaBando({ id: '3', titolo: 'Non correlato', descrizione: 'niente' }),
    ];
    const risultato = applicaFiltri(bandi, { ...filtriBase, ricerca: 'gaming' });
    expect(risultato.map((b) => b.id).sort()).toEqual(['1', '2']);
  });

  it('ordina per data_pubblicazione dal più recente, con i null in fondo', () => {
    const bandi = [
      creaBando({ id: '1', data_pubblicazione: '2026-01-01' }),
      creaBando({ id: '2', data_pubblicazione: '2026-03-01' }),
      creaBando({ id: '3', data_pubblicazione: null }),
    ];
    const risultato = applicaFiltri(bandi, filtriBase);
    expect(risultato.map((b) => b.id)).toEqual(['2', '1', '3']);
  });

  it('ordina per scadenza dalla più vicina, con i null in fondo', () => {
    const bandi = [
      creaBando({ id: '1', scadenza: '2026-06-01' }),
      creaBando({ id: '2', scadenza: '2026-03-01' }),
      creaBando({ id: '3', scadenza: null }),
    ];
    const risultato = applicaFiltri(bandi, { ...filtriBase, ordinamento: 'scadenza' });
    expect(risultato.map((b) => b.id)).toEqual(['2', '1', '3']);
  });

  it('combina più filtri insieme', () => {
    const bandi = [
      creaBando({ id: '1', fonte: 'eit', priorita: 'alta', titolo: 'Bando gaming' }),
      creaBando({ id: '2', fonte: 'eit', priorita: 'da_verificare', titolo: 'Bando gaming' }),
      creaBando({ id: '3', fonte: 'invitalia', priorita: 'alta', titolo: 'Bando gaming' }),
    ];
    const risultato = applicaFiltri(bandi, { ...filtriBase, priorita: 'alta', fonti: ['eit'] });
    expect(risultato.map((b) => b.id)).toEqual(['1']);
  });
});
