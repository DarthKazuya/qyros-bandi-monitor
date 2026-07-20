import { describe, expect, it } from 'vitest';
import { creaTemaQyros } from './theme';

describe('creaTemaQyros', () => {
  it('usa la nuova palette primaria indaco in entrambe le modalità', () => {
    expect(creaTemaQyros('light').palette.primary.main).toBe('#5B6EE8');
    expect(creaTemaQyros('dark').palette.primary.main).toBe('#7A8AF0');
  });

  it('usa il teal come colore secondario, con i toni container per i badge', () => {
    const chiaro = creaTemaQyros('light').palette.secondary;
    expect(chiaro.main).toBe('#0F6E56');
    expect(chiaro.container).toBe('#D2EFF0');
    expect(chiaro.onContainer).toBe('#0F6E56');

    const scuro = creaTemaQyros('dark').palette.secondary;
    expect(scuro.main).toBe('#9FE1CB');
    expect(scuro.container).toBe('#085041');
    expect(scuro.onContainer).toBe('#9FE1CB');
  });

  it('usa il grigio-blu come colore neutro (ruolo info) per i badge "da verificare"', () => {
    const chiaro = creaTemaQyros('light').palette.info;
    expect(chiaro.main).toBe('#78909C');
    expect(chiaro.container).toBe('#ECEFF1');
    expect(chiaro.onContainer).toBe('#37474F');

    const scuro = creaTemaQyros('dark').palette.info;
    expect(scuro.main).toBe('#78909C');
    expect(scuro.container).toBe('#37474F');
    expect(scuro.onContainer).toBe('#CFD8DC');
  });

  it('riserva il rosso esclusivamente al ruolo errore, in entrambe le modalità', () => {
    expect(creaTemaQyros('light').palette.error.main).toBe('#D32F2F');
    expect(creaTemaQyros('dark').palette.error.main).toBe('#D32F2F');
  });

  it('applica i colori personalizzati agli avvisi di errore (Alert standard)', () => {
    const chiaro = creaTemaQyros('light').components?.MuiAlert?.styleOverrides
      ?.standardError as Record<string, string>;
    expect(chiaro).toMatchObject({ backgroundColor: '#FCEBEB', color: '#501313' });

    const scuro = creaTemaQyros('dark').components?.MuiAlert?.styleOverrides
      ?.standardError as Record<string, string>;
    expect(scuro).toMatchObject({ backgroundColor: '#791F1F', color: '#F7C1C1' });
  });

  it('non usa mai il nero puro come sfondo pagina in dark mode', () => {
    expect(creaTemaQyros('dark').palette.background.default).toBe('#111318');
  });

  it('usa uno sfondo card leggermente più chiaro dello sfondo pagina in dark mode', () => {
    expect(creaTemaQyros('dark').palette.background.paper).toBe('#1a1d24');
  });

  it('imposta la modalità richiesta', () => {
    expect(creaTemaQyros('dark').palette.mode).toBe('dark');
    expect(creaTemaQyros('light').palette.mode).toBe('light');
  });

  it('usa un raggio degli angoli di 12px (token di forma Material 3)', () => {
    expect(creaTemaQyros('light').shape.borderRadius).toBe(12);
  });

  it('genera 25 livelli di ombra, più tenui del default MUI', () => {
    const ombre = creaTemaQyros('light').shadows;
    expect(ombre).toHaveLength(25);
    expect(ombre[0]).toBe('none');
    expect(ombre[1]).toBe('0px 2px 6px rgba(15,20,30,0.16)');
    expect(ombre[24]).toBe('0px 16px 48px rgba(15,20,30,0.08)');
  });
});
