import { creaClienteSupabaseReale } from '../src/lib/db-port-supabase.js';
import { caricaKeywords } from '../src/lib/config.js';
import { classifica } from '../src/lib/matching.js';

async function main() {
  const client = creaClienteSupabaseReale();
  const keywords = await caricaKeywords(client);

  const { data, error } = await client.from('bandi').select('id, titolo, descrizione');
  if (error) {
    throw new Error(`Impossibile leggere i bandi: ${error.message}`);
  }

  const bandi = (data ?? []) as { id: string; titolo: string; descrizione: string }[];
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
