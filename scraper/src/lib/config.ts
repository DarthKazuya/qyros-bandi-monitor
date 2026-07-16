import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Keywords, ScheduleConfig, SourceConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, '../../../config');

export function caricaKeywords(): Keywords {
  const raw = readFileSync(resolve(CONFIG_DIR, 'keywords.json'), 'utf8');
  return JSON.parse(raw) as Keywords;
}

export function caricaSources(): SourceConfig[] {
  const raw = readFileSync(resolve(CONFIG_DIR, 'sources.json'), 'utf8');
  const parsed = JSON.parse(raw) as { fonti: SourceConfig[] };
  return parsed.fonti;
}

export function caricaSchedule(): ScheduleConfig {
  const raw = readFileSync(resolve(CONFIG_DIR, 'schedule.json'), 'utf8');
  return JSON.parse(raw) as ScheduleConfig;
}
