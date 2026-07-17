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
}
