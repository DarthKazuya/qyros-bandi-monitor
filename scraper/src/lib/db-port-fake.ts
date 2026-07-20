import type { BandoRaw, EsistenteBando, Priorita } from './types.js';
import type { DbPort, FonteFallita } from './db-port.js';

export interface BandoSalvato {
  bando: BandoRaw;
  priorita: Priorita | null;
  scartato: boolean;
  paroleTrovate: string[];
}

export interface DbPortFake {
  db: DbPort;
  salvati: BandoSalvato[];
  aggiornati: BandoRaw[];
  ultimoEsito: { fontiOk: string[]; fontiFallite: FonteFallita[]; nuoviBandi: number } | null;
}

export function creaDbPortFake(): DbPortFake {
  const salvati: BandoSalvato[] = [];
  const aggiornati: BandoRaw[] = [];
  const esistenti = new Map<string, EsistenteBando>();
  const stato: DbPortFake = { db: null as unknown as DbPort, salvati, aggiornati, ultimoEsito: null };

  stato.db = {
    async trovaEsistente(fonte, url) {
      return esistenti.get(`${fonte}::${url}`) ?? null;
    },
    async inserisciBando(bando, priorita, scartato, paroleTrovate) {
      salvati.push({ bando, priorita, scartato, paroleTrovate });
      esistenti.set(`${bando.fonte}::${bando.url}`, { hash_contenuto: bando.hash_contenuto });
    },
    async aggiornaBando(fonte, url, bando) {
      aggiornati.push(bando);
      esistenti.set(`${fonte}::${url}`, { hash_contenuto: bando.hash_contenuto });
    },
    async registraEsitoJob(fontiOk, fontiFallite, nuoviBandi) {
      stato.ultimoEsito = { fontiOk, fontiFallite, nuoviBandi };
    },
  };

  return stato;
}
