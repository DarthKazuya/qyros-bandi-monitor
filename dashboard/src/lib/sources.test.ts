import { describe, expect, it } from 'vitest';
import { FONTI_ATTIVE } from './sources';

describe('FONTI_ATTIVE', () => {
  it('è un array non vuoto di stringhe', () => {
    expect(Array.isArray(FONTI_ATTIVE)).toBe(true);
    expect(FONTI_ATTIVE.length).toBeGreaterThan(0);
  });

  it('include le fonti attive note', () => {
    expect(FONTI_ATTIVE).toContain('eit');
    expect(FONTI_ATTIVE).toContain('regione-lombardia');
  });

  it('esclude le fonti non attive', () => {
    expect(FONTI_ATTIVE).not.toContain('slot-personalizzato');
  });
});
