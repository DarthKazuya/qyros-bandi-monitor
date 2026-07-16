export type Priorita = 'alta' | 'da_verificare';

export interface BandoRaw {
  fonte: string;
  titolo: string;
  descrizione: string;
  url: string;
  scadenza: string | null;
  data_pubblicazione: string | null;
  hash_contenuto: string;
}

export interface MatchResult {
  priorita: Priorita | null;
  scartato: boolean;
}

export interface Keywords {
  livello1: string[];
  livello2: string[];
}

export interface SourceConfig {
  id: string;
  nome: string;
  url: string;
  scraperModule: string;
  attivo: boolean;
}

export interface ScheduleConfig {
  ora: number;
  timezone: string;
}

export interface Scraper {
  id: string;
  scrape(): Promise<BandoRaw[]>;
}

export interface EsistenteBando {
  hash_contenuto: string;
}

export type DedupAction = 'insert' | 'update' | 'skip';
