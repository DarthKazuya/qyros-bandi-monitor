import incentiviGovScraper from '../sources/incentivi-gov.js';

const risultati = await incentiviGovScraper.scrape();
console.log(`Trovati ${risultati.length} incentivi ancora validi:`);
for (const bando of risultati.slice(0, 5)) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'nessuna'} | ${bando.url}`);
}
