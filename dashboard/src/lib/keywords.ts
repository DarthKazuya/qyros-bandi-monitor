import keywordsJson from '../../../config/keywords.json';

interface KeywordsConfig {
  livello1: string[];
  livello2: string[];
}

const { livello1, livello2 } = keywordsJson as KeywordsConfig;

export const PAROLE_CHIAVE: string[] = [...new Set([...livello1, ...livello2])];
