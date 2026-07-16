import regioneLombardiaScraper from '../sources/regione-lombardia.js';

const risultati = await regioneLombardiaScraper.scrape();
console.log(`Trovati ${risultati.length} bandi Regione Lombardia (prime 15 pagine):`);
for (const bando of risultati.slice(0, 5)) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'n/d'} | pubblicato: ${bando.data_pubblicazione ?? 'n/d'} | ${bando.url}`);
}
