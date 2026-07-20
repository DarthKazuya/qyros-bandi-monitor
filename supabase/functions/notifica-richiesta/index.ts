const URL_DASHBOARD = 'https://darthkazuya.github.io/qyros-bandi-monitor/';
const EMAIL_AMMINISTRATORE = 'panto75@gmail.com';
const RESEND_API_URL = 'https://api.resend.com/emails';

interface PayloadWebhook {
  type: string;
  table: string;
  record: {
    email: string;
    nome: string;
    cognome: string;
    richiesto_il: string;
  };
}

function escapeHtml(testo: string): string {
  return testo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (richiesta: Request) => {
  if (richiesta.method !== 'POST') {
    return new Response(JSON.stringify({ errore: 'Metodo non consentito' }), { status: 405 });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ errore: "Variabile d'ambiente RESEND_API_KEY mancante" }), { status: 500 });
  }

  const payload = (await richiesta.json()) as PayloadWebhook;
  const { email, nome, cognome } = payload.record;

  const rispostaResend = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Fund Radar <notifiche@qyros.net>',
      to: [EMAIL_AMMINISTRATORE],
      subject: 'Nuova richiesta di accesso — Fund Radar',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2>Nuova richiesta di accesso</h2>
          <p>Hai ricevuto una nuova richiesta di accesso da <strong>${escapeHtml(nome)} ${escapeHtml(cognome)}</strong> (${escapeHtml(email)}).</p>
          <p><a href="${URL_DASHBOARD}">Vai al pannello per approvarla o rifiutarla</a></p>
        </div>
      `,
    }),
  });

  if (!rispostaResend.ok) {
    const corpoErrore = await rispostaResend.text();
    return new Response(JSON.stringify({ errore: `Resend: ${corpoErrore}` }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
