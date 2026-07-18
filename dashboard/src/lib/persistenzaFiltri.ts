import type { FiltriStato } from './filtriBandi';

export const CHIAVE_LOCALSTORAGE = 'qyros-dashboard-filtri';

const PRIORITA_VALIDE = ['tutti', 'alta', 'da_verificare'];
const ORDINAMENTI_VALIDI = ['data_pubblicazione', 'scadenza'];
const DIREZIONI_VALIDE = ['crescente', 'decrescente'];

function eFiltriStatoValido(valore: unknown): valore is FiltriStato {
  if (typeof valore !== 'object' || valore === null) return false;
  const v = valore as Record<string, unknown>;

  return (
    typeof v.priorita === 'string' &&
    PRIORITA_VALIDE.includes(v.priorita) &&
    Array.isArray(v.fonti) &&
    v.fonti.every((f) => typeof f === 'string') &&
    Array.isArray(v.paroleChiave) &&
    v.paroleChiave.every((p) => typeof p === 'string') &&
    typeof v.ricerca === 'string' &&
    typeof v.ordinamento === 'string' &&
    ORDINAMENTI_VALIDI.includes(v.ordinamento) &&
    typeof v.direzioneOrdinamento === 'string' &&
    DIREZIONI_VALIDE.includes(v.direzioneOrdinamento)
  );
}

export function salvaFiltri(filtri: FiltriStato): void {
  localStorage.setItem(CHIAVE_LOCALSTORAGE, JSON.stringify(filtri));
}

export function caricaFiltriSalvati(): FiltriStato | null {
  const grezzo = localStorage.getItem(CHIAVE_LOCALSTORAGE);
  if (!grezzo) return null;

  try {
    const parsato: unknown = JSON.parse(grezzo);
    return eFiltriStatoValido(parsato) ? parsato : null;
  } catch {
    return null;
  }
}
