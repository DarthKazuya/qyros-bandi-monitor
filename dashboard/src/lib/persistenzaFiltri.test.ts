import { afterEach, describe, expect, it } from 'vitest';
import { CHIAVE_LOCALSTORAGE, caricaFiltriSalvati, salvaFiltri } from './persistenzaFiltri';
import type { FiltriStato } from './filtriBandi';

const filtriEsempio: FiltriStato = {
  fonti: ['eit'],
  paroleChiave: ['gaming'],
  ricerca: 'test',
  ordinamento: 'scadenza',
  direzioneOrdinamento: 'crescente',
};

describe('persistenzaFiltri', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('salvaFiltri seguito da caricaFiltriSalvati restituisce lo stesso oggetto', () => {
    salvaFiltri(filtriEsempio);
    expect(caricaFiltriSalvati()).toEqual(filtriEsempio);
  });

  it('caricaFiltriSalvati restituisce null se non c\'è nulla di salvato', () => {
    expect(caricaFiltriSalvati()).toBeNull();
  });

  it('caricaFiltriSalvati restituisce null se il dato salvato non è JSON valido', () => {
    localStorage.setItem(CHIAVE_LOCALSTORAGE, 'non è json{{{');
    expect(caricaFiltriSalvati()).toBeNull();
  });

  it('caricaFiltriSalvati restituisce null se il dato salvato ha una forma inaspettata', () => {
    localStorage.setItem(CHIAVE_LOCALSTORAGE, JSON.stringify({ qualcosa: 'altro' }));
    expect(caricaFiltriSalvati()).toBeNull();
  });

  it('caricaFiltriSalvati restituisce null se manca un campo obbligatorio', () => {
    const incompleto = { ...filtriEsempio } as Partial<FiltriStato>;
    delete incompleto.direzioneOrdinamento;
    localStorage.setItem(CHIAVE_LOCALSTORAGE, JSON.stringify(incompleto));
    expect(caricaFiltriSalvati()).toBeNull();
  });
});
