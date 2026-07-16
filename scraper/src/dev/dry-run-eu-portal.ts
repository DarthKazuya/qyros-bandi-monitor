import euPortalScraper from '../sources/eu-portal.js';

const risultati = await euPortalScraper.scrape();
console.log(`\n=== EU Portal Scraper Dry Run ===`);
console.log(`Trovati ${risultati.length} bandi da EU Portal:\n`);

let conScadenza = 0;
let senzaScadenza = 0;

for (const bando of risultati.slice(0, 10)) {
  const scadenza = bando.scadenza ?? 'n/d';
  if (bando.scadenza) conScadenza++;
  else senzaScadenza++;

  console.log(`[${risultati.indexOf(bando) + 1}] ${bando.titolo.substring(0, 70)}`);
  console.log(`    Scadenza: ${scadenza}`);
  console.log(`    URL: ${bando.url}`);
  console.log(`    Hash: ${bando.hash_contenuto.substring(0, 16)}...`);
  console.log();
}

console.log(`\n=== Statistiche ===`);
console.log(`Totale: ${risultati.length}`);
console.log(`Con scadenza: ${conScadenza}`);
console.log(`Senza scadenza: ${senzaScadenza}`);
