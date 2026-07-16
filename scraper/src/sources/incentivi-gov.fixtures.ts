export const FIXTURE_RISPOSTA = JSON.stringify({
  response: {
    numFound: 3,
    docs: [
      {
        nid: '1',
        page_title: 'Bando aperto di test gaming',
        url: '/it/catalogo/bando-aperto-test',
        open_date: '2026-01-01T00:00:00',
        close_date: '2099-12-31T00:00:00',
        body: 'Descrizione di un bando ancora aperto sul settore gaming.',
      },
      {
        nid: '2',
        page_title: 'Bando scaduto di test',
        url: '/it/catalogo/bando-scaduto-test',
        open_date: '2020-01-01T00:00:00',
        close_date: '2020-06-30T00:00:00',
        body: 'Descrizione di un bando gia scaduto.',
      },
      {
        nid: '3',
        page_title: 'Bando a sportello senza scadenza',
        url: '/it/catalogo/bando-sportello-test',
        open_date: '2026-01-01T00:00:00',
        body: 'Descrizione di un bando a sportello, senza data di chiusura.',
      },
    ],
  },
});
