import { describe, expect, it } from 'vitest';
import { eOraDiEseguire, oraCorrenteRoma } from './schedule.js';
import type { ScheduleConfig } from './types.js';

describe('oraCorrenteRoma', () => {
  it('calcola le 8 del mattino a Roma in orario estivo (CEST, UTC+2)', () => {
    // 2026-07-16T06:00:00Z = 08:00 a Roma in estate
    const data = new Date('2026-07-16T06:00:00Z');
    expect(oraCorrenteRoma(data)).toBe(8);
  });

  it('calcola le 8 del mattino a Roma in orario invernale (CET, UTC+1)', () => {
    // 2026-01-16T07:00:00Z = 08:00 a Roma in inverno
    const data = new Date('2026-01-16T07:00:00Z');
    expect(oraCorrenteRoma(data)).toBe(8);
  });
});

describe('eOraDiEseguire', () => {
  const schedule: ScheduleConfig = { ora: 8, timezone: 'Europe/Rome' };

  it('restituisce true quando l\'ora corrisponde a quella configurata', () => {
    const data = new Date('2026-07-16T06:00:00Z');
    expect(eOraDiEseguire(schedule, data)).toBe(true);
  });

  it('restituisce false quando l\'ora non corrisponde', () => {
    const data = new Date('2026-07-16T10:00:00Z');
    expect(eOraDiEseguire(schedule, data)).toBe(false);
  });
});
