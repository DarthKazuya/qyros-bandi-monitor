import europaCreativaMediaScraper from '../sources/europa-creativa-media.js';

const risultati = await europaCreativaMediaScraper.scrape();
console.log(`Trovati ${risultati.length} bandi aperti su Europa Creativa MEDIA:`);
for (const bando of risultati) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'n/d'} | ${bando.url}`);
}
