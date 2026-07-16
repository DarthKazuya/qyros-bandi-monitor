export const FIXTURE_LISTA_PAGINA1 = `
<html><body>
<div data-max-page-num="1"></div>
<div class="results-block">
  <div class="card card-bg card-big">
    <h4 class="card-title" data-content="Titolo completo non troncato del primo bando di test per il settore fintech">Titolo completo non troncato del primo bando...</h4>
    <a class="text-decoration-none" href="/servizi/servizio/bandi/dettaglio/test/bando-test-1"></a>
    <p class="card-text">
      <svg class="icon-popover" data-content="Descrizione breve completa del primo bando di test."></svg>
    </p>
    <input class="checkCloseDate" value="2099-12-31 16:00" />
  </div>
  <div class="card card-bg card-big">
    <h4 class="card-title" data-content="Secondo bando di test">Secondo bando di test</h4>
    <a class="text-decoration-none" href="/servizi/servizio/bandi/dettaglio/test/bando-test-2"></a>
    <p class="card-text">
      <svg class="icon-popover" data-content="Descrizione breve del secondo bando."></svg>
    </p>
    <input class="checkCloseDate" value="2099-06-30 12:00" />
  </div>
</div>
</body></html>
`;

export const FIXTURE_DETTAGLIO_CON_PUBBLICAZIONE = `
<html><head><meta name="description" content="Descrizione estesa dalla pagina di dettaglio del primo bando."></head><body>
<p>Pubblicato il: <strong data-entity="pubblicazione">15/06/2026 ,</strong> ore 10:53</p>
</body></html>
`;

export const FIXTURE_DETTAGLIO_SENZA_PUBBLICAZIONE = `
<html><head><meta name="description" content="Descrizione estesa dalla pagina di dettaglio del secondo bando."></head><body>
<p>Nessuna informazione di pubblicazione disponibile.</p>
</body></html>
`;
