export const FIXTURE_REST_API = JSON.stringify([
  {
    date: '2026-04-08T09:11:20',
    slug: 'test-bando-obiettivo',
    link: 'https://www.fondazionecariplo.it/bando/test-bando-obiettivo/',
    title: { rendered: 'Test Bando con Obiettivo' },
    content: {
      rendered:
        '<div class="info-bando-container">' +
        '<h2 class="title__info">TIPO</h2><p class="text__medium wp-block-paragraph">Con scadenza</p>' +
        '<h2 class="title__info">OBIETTIVO</h2><p class="text__medium wp-block-paragraph">Favorire progetti di innovazione tecnologica nel settore gaming.</p>' +
        '</div>',
    },
  },
  {
    date: '2026-05-01T10:00:00',
    slug: 'test-bando-telethon-style',
    link: 'https://www.fondazionecariplo.it/bando/test-bando-telethon-style/',
    title: { rendered: 'Test Bando &#8211; Stile Telethon' },
    content: {
      rendered:
        '<div class="info-bando-container">' +
        '<h2 class="title__info">Project Duration and Budget</h2><p class="text__medium wp-block-paragraph">Testo di fallback senza intestazione OBIETTIVO.</p>' +
        '</div>',
    },
  },
]);

export const FIXTURE_DETTAGLIO_UNA_FASE = `
<html><body>
<div class="separator__block row"><h2 class="title__sidebar">Stato:</h2><span class="status">Attivo</span></div>
<div class="separator__block row"><h2 class="title__sidebar">Bando con scadenza</h2><span class="font__bold text__normal">23/07/2026</span></div>
</body></html>
`;

export const FIXTURE_DETTAGLIO_DUE_FASI = `
<html><body>
<div class="separator__block row"><h2 class="title__sidebar">Stato:</h2><span class="status">Attivo</span></div>
<div class="separator__block row"><h2 class="title__sidebar">Fase 1</h2><span class="font__bold text__normal">14/07/2026</span></div>
<div class="separator__block row"><h2 class="title__sidebar">Fase 2</h2><span class="font__bold text__normal">25/03/2027</span></div>
</body></html>
`;

export const FIXTURE_DETTAGLIO_SENZA_SCADENZA = `
<html><body>
<div class="separator__block row"><h2 class="title__sidebar">Stato:</h2><span class="status">Scaduto</span></div>
<div class="separator__block row"><h2 class="title__sidebar">Bando senza scadenza</h2><span class="font__bold text__normal"></span></div>
</body></html>
`;
