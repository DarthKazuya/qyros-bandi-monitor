export type Priorita = 'alta' | 'da_verificare';
export type Stato = 'nuovo' | 'visto' | 'scaduto';

export interface Bando {
  id: string;
  fonte: string;
  titolo: string;
  descrizione: string;
  url: string;
  scadenza: string | null;
  data_pubblicazione: string | null;
  priorita: Priorita | null;
  stato: Stato;
  parole_corrispondenti: string[];
}

export interface RichiestaAccesso {
  id: string;
  email: string;
  nome: string;
  cognome: string;
  richiesto_il: string;
  stato: 'in_attesa' | 'approvata' | 'rifiutata';
}

export interface UtenteAutorizzato {
  id: string;
  email: string;
  nome?: string;
  cognome?: string;
}

export interface FonteFallitaLog {
  fonte: string;
  errore: string;
}

export interface EsecuzioneJob {
  id: string;
  eseguito_il: string;
  fonti_ok: string[];
  fonti_fallite: FonteFallitaLog[];
  nuovi_bandi: number;
}

export interface ParolaChiave {
  id: string;
  parola: string;
  livello: 'livello1' | 'livello2';
  contatore_click: number;
}

export interface SuggerimentoParolaChiave {
  id: string;
  parola: string;
  proposto_da: string;
  proposto_il: string;
  stato: 'in_attesa' | 'accettato' | 'rifiutato';
}

export interface ImpostazioniJob {
  id: number;
  ora: number;
  fuso_orario: string;
}
