import type { ScheduleConfig } from './types.js';

export function oraCorrenteRoma(now: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    hour: 'numeric',
    hourCycle: 'h23',
  });
  return Number(formatter.format(now));
}

export function eOraDiEseguire(schedule: ScheduleConfig, now: Date = new Date()): boolean {
  return oraCorrenteRoma(now) === schedule.ora;
}
