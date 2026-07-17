import { describe, expect, it } from 'vitest';
import { creaTemaQyros } from './theme';

describe('creaTemaQyros', () => {
  it('usa il colore arancione QYROS come primario in entrambe le modalità', () => {
    expect(creaTemaQyros('dark').palette.primary.main).toBe('#ff6500');
    expect(creaTemaQyros('light').palette.primary.main).toBe('#ff6500');
  });

  it('usa il blu petrolio QYROS come secondario', () => {
    expect(creaTemaQyros('dark').palette.secondary.main).toBe('#3c6a8b');
  });

  it('usa lo sfondo scuro QYROS in dark mode', () => {
    expect(creaTemaQyros('dark').palette.background.default).toBe('#040a1b');
  });

  it('imposta la modalità richiesta', () => {
    expect(creaTemaQyros('dark').palette.mode).toBe('dark');
    expect(creaTemaQyros('light').palette.mode).toBe('light');
  });
});
