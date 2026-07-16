import invitaliaScraper from '../sources/invitalia.js';

const risultati = await invitaliaScraper.scrape();
console.log(`Trovati ${risultati.length} incentivi Invitalia attivi/in apertura:`);
for (const bando of risultati.slice(0, 5)) {
  console.log(`- ${bando.titolo} | scadenza: ${bando.scadenza ?? 'nessuna'} | ${bando.url}`);
}
