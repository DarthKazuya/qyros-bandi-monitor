import sourcesJson from '../../../config/sources.json';

interface FonteConfig {
  id: string;
  attivo: boolean;
}

interface SourcesConfig {
  fonti: FonteConfig[];
}

const { fonti } = sourcesJson as SourcesConfig;

export const FONTI_ATTIVE: string[] = fonti.filter((f) => f.attivo).map((f) => f.id);
