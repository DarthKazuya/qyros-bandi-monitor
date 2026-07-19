import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Keywords, ScheduleConfig, SourceConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, '../../../config');

export async function caricaKeywords(client: SupabaseClient | null): Promise<Keywords> {
  if (!client) {
    const raw = readFileSync(resolve(CONFIG_DIR, 'keywords.json'), 'utf8');
    return JSON.parse(raw) as Keywords;
  }

  const { data, error } = await client.from('parole_chiave').select('parola, livello');
  if (error) {
    throw new Error(`Impossibile caricare le parole chiave da Supabase: ${error.message}`);
  }

  const righe = (data ?? []) as { parola: string; livello: string }[];
  return {
    livello1: righe.filter((r) => r.livello === 'livello1').map((r) => r.parola),
    livello2: righe.filter((r) => r.livello === 'livello2').map((r) => r.parola),
  };
}

export function caricaSources(): SourceConfig[] {
  const raw = readFileSync(resolve(CONFIG_DIR, 'sources.json'), 'utf8');
  const parsed = JSON.parse(raw) as { fonti: SourceConfig[] };
  return parsed.fonti;
}

export async function caricaSchedule(client: SupabaseClient | null): Promise<ScheduleConfig> {
  if (!client) {
    const raw = readFileSync(resolve(CONFIG_DIR, 'schedule.json'), 'utf8');
    return JSON.parse(raw) as ScheduleConfig;
  }

  const { data, error } = await client
    .from('impostazioni_job')
    .select('ora, fuso_orario')
    .eq('id', 1)
    .single();
  if (error) {
    throw new Error(`Impossibile caricare l'orario di esecuzione da Supabase: ${error.message}`);
  }

  const riga = data as { ora: number; fuso_orario: string };
  return { ora: riga.ora, timezone: riga.fuso_orario };
}
