export const FIXTURE_CATEGORIA_CON_BANDO = `
<html><body>
<div class="widget-recent-posts">
  <div class="sidebar-widget-title">
    <h4>Test Category<br />I bandi aperti</h4>
  </div>
  <ul>
    <li class="clearfix">
      <div class="widget-blog-content">
        <a href="/bandi/test-bando-videogame-2026"><span>Test bando videogame 2026</span></a>
      </div>
    </li>
  </ul>
</div>
<div class="widget-recent-posts">
  <div class="sidebar-widget-title">
    <h4>Test Category<br />I bandi chiusi</h4>
  </div>
  <ul>
    <li class="clearfix">
      <div class="widget-blog-content">
        <a href="/bandi/vecchio-bando-chiuso"><span>Vecchio bando chiuso</span></a>
      </div>
    </li>
  </ul>
</div>
</body></html>
`;

export const FIXTURE_CATEGORIA_SENZA_BANDI = `
<html><body>
<div class="widget-recent-posts">
  <div class="sidebar-widget-title">
    <h4>Test Category<br />I bandi aperti</h4>
  </div>
  <p class="bandoChiuso">Al momento non ci sono bandi aperti in questa categoria.</p>
</div>
</body></html>
`;

export const FIXTURE_DETTAGLIO = `
<html><body>
<h2 class="post-title">Test bando videogame 2026</h2>
<article class="post-content">
  <div class="event-description">
    <p>Primo paragrafo di descrizione sul budget disponibile.</p>
    <p>Secondo paragrafo sugli obiettivi del bando.</p>
  </div>
</article>
<div class="widget-upcoming-events">
  <ul>
    <li class="event-item">
      <div class="event-date"><span class="date">3</span><span class="month">Dic</span></div>
      <div class="event-detail"><h4>Prima scadenza</h4><span class="event-dayntime">2025 | Ore 17:00</span></div>
    </li>
    <li class="event-item">
      <div class="event-date"><span class="date">7</span><span class="month">Mag</span></div>
      <div class="event-detail"><h4>Seconda scadenza</h4><span class="event-dayntime">2026 | Ore 17:00</span></div>
    </li>
  </ul>
</div>
</body></html>
`;
