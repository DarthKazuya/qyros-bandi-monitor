import { caricaKeywords, caricaSchedule, caricaSources } from './lib/config.js';
import { creaDbPortConsole } from './lib/db-port-console.js';
import { eseguiRaccolta } from './lib/orchestrator.js';
import { eOraDiEseguire } from './lib/schedule.js';
import type { Scraper } from './lib/types.js';

async function costruisciScraperAttivi(): Promise<Scraper[]> {
  const fontiAttive = caricaSources().filter((f) => f.attivo && f.scraperModule);
  const scrapers: Scraper[] = [];

  for (const fonte of fontiAttive) {
    const modulo = await import(`./sources/${fonte.scraperModule}.js`);
    scrapers.push(modulo.default as Scraper);
  }

  return scrapers;
}

async function main(): Promise<void> {
  const schedule = caricaSchedule();
  const forzaEsecuzione = process.argv.includes('--force');

  if (!forzaEsecuzione && !eOraDiEseguire(schedule)) {
    console.log(`Non e l'ora configurata (${schedule.ora}:00 ${schedule.timezone}), esco senza eseguire.`);
    return;
  }

  const keywords = caricaKeywords();
  const scrapers = await costruisciScraperAttivi();
  const db = creaDbPortConsole();

  const risultato = await eseguiRaccolta(scrapers, keywords, db);

  console.log(`\nTrovati ${risultato.nuoviBandiRilevanti.length} nuovi bandi rilevanti.`);
  if (risultato.fontiFallite.length > 0) {
    console.log('Attenzione, fonti fallite:', risultato.fontiFallite);
  }
}

main().catch((err) => {
  console.error('Errore fatale nel job:', err);
  process.exit(1);
});
