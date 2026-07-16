import cariploScraper from '../sources/fondazione-cariplo.js';

const risultati = await cariploScraper.scrape();
console.log(`Trovati ${risultati.length} bandi da Fondazione Cariplo:`);
for (const bando of risultati.slice(0, 5)) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'n/d'} | pubblicato: ${bando.data_pubblicazione ?? 'n/d'} | ${bando.url}`);
}
