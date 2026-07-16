import { classifica } from './matching.js';
import { decidiAzione } from './dedup.js';
import type { BandoRaw, Keywords, Priorita, Scraper } from './types.js';
import type { DbPort, FonteFallita } from './db-port.js';

export interface EsecuzioneRisultato {
  nuoviBandiRilevanti: Array<{ bando: BandoRaw; priorita: Priorita }>;
  fontiOk: string[];
  fontiFallite: FonteFallita[];
}

export async function eseguiRaccolta(scrapers: Scraper[], keywords: Keywords, db: DbPort): Promise<EsecuzioneRisultato> {
  const fontiOk: string[] = [];
  const fontiFallite: FonteFallita[] = [];
  const nuoviBandiRilevanti: Array<{ bando: BandoRaw; priorita: Priorita }> = [];

  for (const scraper of scrapers) {
    try {
      const bandiGrezzi = await scraper.scrape();

      for (const bando of bandiGrezzi) {
        const esistente = await db.trovaEsistente(bando.fonte, bando.url);
        const azione = decidiAzione(esistente, bando);

        if (azione === 'skip') {
          continue;
        }

        if (azione === 'update') {
          await db.aggiornaBando(bando.fonte, bando.url, bando);
          continue;
        }

        const { priorita, scartato } = classifica(bando.titolo, bando.descrizione, keywords);
        await db.inserisciBando(bando, priorita, scartato);
        if (!scartato && priorita) {
          nuoviBandiRilevanti.push({ bando, priorita });
        }
      }

      fontiOk.push(scraper.id);
    } catch (err) {
      fontiFallite.push({ fonte: scraper.id, errore: err instanceof Error ? err.message : String(err) });
    }
  }

  await db.registraEsitoJob(fontiOk, fontiFallite, nuoviBandiRilevanti.length);

  return { nuoviBandiRilevanti, fontiOk, fontiFallite };
}
