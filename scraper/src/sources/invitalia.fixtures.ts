export const FIXTURE_LISTA = `
<html><body>
<div class="pager">Pagina 1 di 1</div>
<article class="card--incentivi">
  <h3><a class="card-unified__title" href="/incentivi-e-strumenti/test-incentivo-1">Test Incentivo Uno</a></h3>
</article>
<article class="card--incentivi">
  <h3><a class="card-unified__title" href="/incentivi-e-strumenti/test-incentivo-2">Test Incentivo Due</a></h3>
</article>
</body></html>
`;

export const FIXTURE_DETTAGLIO_CON_SCADENZA = `
<html><body>
<h1 class="title">Test Incentivo Uno</h1>
<p class="subtitle">Incentivo di test per il settore gaming</p>
<div class="pagetabctabox">
  <h3>Data apertura</h3>
  <p>1/1/2026</p>
  <h3>Data chiusura</h3>
  <p>15/9/2026</p>
</div>
</body></html>
`;

export const FIXTURE_DETTAGLIO_SENZA_SCADENZA = `
<html><body>
<h1 class="title">Test Incentivo Due</h1>
<p class="subtitle">Incentivo a sportello senza scadenza fissa</p>
<div class="pagetabctabox">
  <h3>Data apertura</h3>
  <p>1/1/2026</p>
</div>
</body></html>
`;
