import type { Bando, Priorita } from './types';

export interface FiltriStato {
  priorita: Priorita | 'tutti';
  fonti: string[];
  ricerca: string;
  ordinamento: 'data_pubblicazione' | 'scadenza';
}

function confrontaConNullInFondo(valoreA: string | null, valoreB: string | null, ascendente: boolean): number {
  if (!valoreA && !valoreB) return 0;
  if (!valoreA) return 1;
  if (!valoreB) return -1;
  return ascendente ? valoreA.localeCompare(valoreB) : valoreB.localeCompare(valoreA);
}

export function applicaFiltri(bandi: Bando[], filtri: FiltriStato): Bando[] {
  let risultato = bandi;

  if (filtri.priorita !== 'tutti') {
    risultato = risultato.filter((b) => b.priorita === filtri.priorita);
  }

  if (filtri.fonti.length > 0) {
    risultato = risultato.filter((b) => filtri.fonti.includes(b.fonte));
  }

  const query = filtri.ricerca.trim().toLowerCase();
  if (query !== '') {
    risultato = risultato.filter(
      (b) => b.titolo.toLowerCase().includes(query) || b.descrizione.toLowerCase().includes(query)
    );
  }

  return [...risultato].sort((a, b) =>
    filtri.ordinamento === 'scadenza'
      ? confrontaConNullInFondo(a.scadenza, b.scadenza, true)
      : confrontaConNullInFondo(a.data_pubblicazione, b.data_pubblicazione, false)
  );
}
