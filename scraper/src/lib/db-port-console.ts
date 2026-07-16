import type { DbPort, FonteFallita } from './db-port.js';

export function creaDbPortConsole(): DbPort {
  return {
    async trovaEsistente() {
      return null;
    },
    async inserisciBando(bando, priorita, scartato) {
      console.log(`[NUOVO] (${priorita ?? 'scartato'}) ${bando.titolo} — ${bando.url}`);
    },
    async aggiornaBando(_fonte, _url, bando) {
      console.log(`[AGGIORNATO] ${bando.titolo}`);
    },
    async registraEsitoJob(fontiOk: string[], fontiFallite: FonteFallita[], nuoviBandi: number) {
      console.log(`Esito: ${nuoviBandi} nuovi bandi, fonti ok: ${fontiOk.join(', ') || 'nessuna'}, fonti fallite: ${fontiFallite.map((f) => f.fonte).join(', ') || 'nessuna'}`);
    },
  };
}
