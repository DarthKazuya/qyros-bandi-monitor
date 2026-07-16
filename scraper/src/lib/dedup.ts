import type { BandoRaw, DedupAction, EsistenteBando } from './types.js';

export function decidiAzione(esistente: EsistenteBando | null, incoming: BandoRaw): DedupAction {
  if (!esistente) {
    return 'insert';
  }
  if (esistente.hash_contenuto === incoming.hash_contenuto) {
    return 'skip';
  }
  return 'update';
}
