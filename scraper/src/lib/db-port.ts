import type { BandoRaw, EsistenteBando, Priorita } from './types.js';

export interface FonteFallita {
  fonte: string;
  errore: string;
}

export interface DbPort {
  trovaEsistente(fonte: string, url: string): Promise<EsistenteBando | null>;
  inserisciBando(bando: BandoRaw, priorita: Priorita | null, scartato: boolean): Promise<void>;
  aggiornaBando(fonte: string, url: string, bando: BandoRaw): Promise<void>;
  registraEsitoJob(fontiOk: string[], fontiFallite: FonteFallita[], nuoviBandi: number): Promise<void>;
}
