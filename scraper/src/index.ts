import { caricaKeywords, caricaSchedule, caricaSources } from './lib/config.js';
import { creaDbPortConsole } from './lib/db-port-console.js';
import { creaClienteSupabaseReale, creaDbPortSupabase } from './lib/db-port-supabase.js';
import { formattaEmailDigest, inviaEmailReale } from './lib/email.js';
import { eseguiRaccolta } from './lib/orchestrator.js';
import { eOraDiEseguire } from './lib/schedule.js';
import type { DbPort } from './lib/db-port.js';
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

function costruisciDbPort(): DbPort {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Uso il database Supabase reale.');
    return creaDbPortSupabase(creaClienteSupabaseReale());
  }
  console.log('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY assenti: uso il DbPort console (solo log, nessun salvataggio reale).');
  return creaDbPortConsole();
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
  const db = costruisciDbPort();

  const risultato = await eseguiRaccolta(scrapers, keywords, db);

  console.log(`\nTrovati ${risultato.nuoviBandiRilevanti.length} nuovi bandi rilevanti.`);
  if (risultato.fontiFallite.length > 0) {
    console.log('Attenzione, fonti fallite:', risultato.fontiFallite);
  }

  const destinatario = process.env.NOTIFICATION_EMAIL;
  if (risultato.nuoviBandiRilevanti.length === 0) {
    console.log('Nessun nuovo bando rilevante: nessuna email da inviare.');
  } else if (!process.env.RESEND_API_KEY || !destinatario) {
    console.log('RESEND_API_KEY/NOTIFICATION_EMAIL assenti: email non inviata (solo log).');
  } else {
    const html = formattaEmailDigest(risultato.nuoviBandiRilevanti, risultato.fontiFallite);
    await inviaEmailReale({
      a: destinatario,
      oggetto: `Fund Radar: ${risultato.nuoviBandiRilevanti.length} nuovi bandi`,
      html,
    });
    console.log(`Email inviata a ${destinatario}.`);
  }
}

main().catch((err) => {
  console.error('Errore fatale nel job:', err);
  process.exit(1);
});
