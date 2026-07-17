import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BandoRaw, EsistenteBando, Priorita } from './types.js';
import type { DbPort, FonteFallita } from './db-port.js';

export function creaClienteSupabaseReale(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chiave) {
    throw new Error("Variabili d'ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY mancanti");
  }
  return createClient(url, chiave);
}

export function creaDbPortSupabase(client: SupabaseClient): DbPort {
  return {
    async trovaEsistente(fonte: string, url: string): Promise<EsistenteBando | null> {
      const { data, error } = await client
        .from('bandi')
        .select('hash_contenuto')
        .eq('fonte', fonte)
        .eq('url', url)
        .maybeSingle();
      if (error) throw new Error(`Supabase trovaEsistente: ${error.message}`);
      return data ? { hash_contenuto: (data as { hash_contenuto: string }).hash_contenuto } : null;
    },

    async inserisciBando(bando: BandoRaw, priorita: Priorita | null, scartato: boolean): Promise<void> {
      const { error } = await client.from('bandi').insert({
        fonte: bando.fonte,
        titolo: bando.titolo,
        descrizione: bando.descrizione,
        url: bando.url,
        scadenza: bando.scadenza,
        data_pubblicazione: bando.data_pubblicazione,
        hash_contenuto: bando.hash_contenuto,
        priorita,
        scartato,
      });
      if (error) throw new Error(`Supabase inserisciBando: ${error.message}`);
    },

    async aggiornaBando(fonte: string, url: string, bando: BandoRaw): Promise<void> {
      const { error } = await client
        .from('bandi')
        .update({
          titolo: bando.titolo,
          descrizione: bando.descrizione,
          scadenza: bando.scadenza,
          data_pubblicazione: bando.data_pubblicazione,
          hash_contenuto: bando.hash_contenuto,
          aggiornato_il: new Date().toISOString(),
        })
        .eq('fonte', fonte)
        .eq('url', url);
      if (error) throw new Error(`Supabase aggiornaBando: ${error.message}`);
    },

    async registraEsitoJob(fontiOk: string[], fontiFallite: FonteFallita[], nuoviBandi: number): Promise<void> {
      const { error } = await client.from('job_run_log').insert({
        fonti_ok: fontiOk,
        fonti_fallite: fontiFallite,
        nuovi_bandi: nuoviBandi,
      });
      if (error) throw new Error(`Supabase registraEsitoJob: ${error.message}`);
    },
  };
}
