import { creaClienteSupabaseReale } from '../src/lib/db-port-supabase.js';
import { caricaKeywords } from '../src/lib/config.js';
import { classifica } from '../src/lib/matching.js';

async function caricaTuttiIBandi(
  client: ReturnType<typeof creaClienteSupabaseReale>
): Promise<{ id: string; titolo: string; descrizione: string }[]> {
  const DIMENSIONE_PAGINA = 1000;
  const bandi: { id: string; titolo: string; descrizione: string }[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await client
      .from('bandi')
      .select('id, titolo, descrizione')
      .range(offset, offset + DIMENSIONE_PAGINA - 1);
    if (error) {
      throw new Error(`Impossibile leggere i bandi: ${error.message}`);
    }
    const pagina = (data ?? []) as { id: string; titolo: string; descrizione: string }[];
    bandi.push(...pagina);
    if (pagina.length < DIMENSIONE_PAGINA) break;
    offset += DIMENSIONE_PAGINA;
  }

  return bandi;
}

async function main() {
  const client = creaClienteSupabaseReale();
  const keywords = await caricaKeywords(client);

  const bandi = await caricaTuttiIBandi(client);
  let aggiornati = 0;
  let senzaCorrispondenza = 0;

  for (const bando of bandi) {
    const { paroleTrovate } = classifica(bando.titolo, bando.descrizione, keywords);
    if (paroleTrovate.length === 0) {
      senzaCorrispondenza++;
      continue;
    }

    const { error: erroreUpdate } = await client
      .from('bandi')
      .update({ parole_corrispondenti: paroleTrovate })
      .eq('id', bando.id);
    if (erroreUpdate) {
      console.error(`Errore aggiornando il bando ${bando.id}: ${erroreUpdate.message}`);
      continue;
    }
    aggiornati++;
  }

  console.log(
    `Backfill completato: ${aggiornati} bandi aggiornati, ${senzaCorrispondenza} senza corrispondenza con le parole chiave attuali, su ${bandi.length} totali.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
