import eitScraper from '../sources/eit.js';

const risultati = await eitScraper.scrape();
console.log(`Trovati ${risultati.length} bandi da EIT:`);
for (const bando of risultati) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'n/d'} | ${bando.url}`);
}
