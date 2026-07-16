import axios from 'axios';
import { calcolaHash } from '../lib/hash.js';
import type { BandoRaw, Scraper } from '../lib/types.js';

const SOLR_URL =
  'https://www.incentivi.gov.it/solr/coredrupal/select?q.op=OR&wt=json&rows=8000&sort=ds_last_update+desc&q=index_id:incentivi&fl=nid:zs_nid,page_title:zs_title,url:zs_url,open_date:zs_field_open_date,close_date:zs_field_close_date,body:zs_body,close_date_descriptor:zs_field_close_date_descriptor';

export type FetchApi = () => Promise<string>;

async function fetchApiReale(): Promise<string> {
  const { data } = await axios.get(SOLR_URL);
  return typeof data === 'string' ? data : JSON.stringify(data);
}

interface DocIncentivo {
  page_title: string;
  url: string;
  close_date?: string;
  body?: string;
}

interface RispostaSolr {
  response: {
    docs: DocIncentivo[];
  };
}

function eAncoraValido(closeDate: string | undefined, oggi: Date): boolean {
  if (!closeDate) return true;
  return new Date(closeDate) >= oggi;
}

export function creaIncentiviGovScraper(fetchApi: FetchApi = fetchApiReale): Scraper {
  return {
    id: 'incentivi-gov',
    async scrape(): Promise<BandoRaw[]> {
      const corpo = await fetchApi();
      const risposta = JSON.parse(corpo) as RispostaSolr;
      const oggi = new Date();
      oggi.setHours(0, 0, 0, 0);

      return risposta.response.docs
        .filter((doc) => eAncoraValido(doc.close_date, oggi))
        .map((doc) => {
          const titolo = doc.page_title;
          const descrizione = doc.body?.trim() || titolo;
          return {
            fonte: 'incentivi-gov',
            titolo,
            descrizione,
            url: `https://www.incentivi.gov.it${doc.url}`,
            scadenza: doc.close_date ? doc.close_date.slice(0, 10) : null,
            data_pubblicazione: null,
            hash_contenuto: calcolaHash(titolo, descrizione),
          };
        });
    },
  };
}

const incentiviGovScraper = creaIncentiviGovScraper();
export default incentiviGovScraper;
