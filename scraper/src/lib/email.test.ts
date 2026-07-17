import { describe, expect, it } from 'vitest';
import { formattaEmailDigest } from './email.js';
import type { BandoRaw } from './types.js';

function creaBando(overrides: Partial<BandoRaw> = {}): BandoRaw {
  return {
    fonte: 'eit',
    titolo: 'Bando di test',
    descrizione: 'Descrizione',
    url: 'https://esempio.it/bando-test',
    scadenza: '2026-12-31',
    data_pubblicazione: null,
    hash_contenuto: 'abc123',
    ...overrides,
  };
}

describe('formattaEmailDigest', () => {
  it('include titolo, fonte, scadenza e link per ogni bando, con il badge di priorita corretto', () => {
    const html = formattaEmailDigest(
      [
        { bando: creaBando({ titolo: 'Bando Alta Priorita' }), priorita: 'alta' },
        { bando: creaBando({ titolo: 'Bando Da Verificare' }), priorita: 'da_verificare' },
      ],
      []
    );

    expect(html).toContain('Bando Alta Priorita');
    expect(html).toContain('Bando Da Verificare');
    expect(html).toContain('https://esempio.it/bando-test');
    expect(html).toContain('2026-12-31');
    expect(html).toContain('Match diretto');
    expect(html).toContain('Da verificare');
  });

  it('include il conteggio dei nuovi bandi nel titolo', () => {
    const html = formattaEmailDigest([{ bando: creaBando(), priorita: 'alta' }], []);
    expect(html).toContain('1 nuovi bandi');
  });

  it('include una sezione di avviso quando ci sono fonti fallite', () => {
    const html = formattaEmailDigest([{ bando: creaBando(), priorita: 'alta' }], [{ fonte: 'invitalia', errore: 'timeout' }]);
    expect(html).toContain('invitalia');
    expect(html).toContain('non raggiungibili');
  });

  it('non include alcuna sezione di avviso quando non ci sono fonti fallite', () => {
    const html = formattaEmailDigest([{ bando: creaBando(), priorita: 'alta' }], []);
    expect(html).not.toContain('non raggiungibili');
  });

  it('non mostra alcuna scadenza (ne "null" ne "undefined") quando scadenza e null', () => {
    const html = formattaEmailDigest([{ bando: creaBando({ scadenza: null }), priorita: 'alta' }], []);
    expect(html).not.toContain('scadenza null');
    expect(html).not.toContain('scadenza undefined');
  });

  it('applica escape HTML a titolo, fonte, url e nomi delle fonti fallite, per non rompere la struttura della email', () => {
    const html = formattaEmailDigest(
      [
        {
          bando: creaBando({
            titolo: 'Bando <script>alert(1)</script> & "citazioni"',
            fonte: 'Fonte & Co.',
            url: 'https://esempio.it/bando?a=1&b="test"',
          }),
          priorita: 'alta',
        },
      ],
      [{ fonte: 'Fonte <chiusa>', errore: 'timeout' }]
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;citazioni&quot;');
    expect(html).not.toContain('Fonte <chiusa>');
    expect(html).toContain('Fonte &lt;chiusa&gt;');
  });
});
