import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

const EMAIL_AMMINISTRATORE = 'panto75@gmail.com';

function clienteServizio() {
  const url = Deno.env.get('SUPABASE_URL');
  const chiave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !chiave) {
    throw new Error("Variabili d'ambiente SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY mancanti");
  }
  return createClient(url, chiave);
}

async function emailUtenteAutenticato(richiesta: Request, client: ReturnType<typeof clienteServizio>): Promise<string | null> {
  const intestazione = richiesta.headers.get('Authorization');
  if (!intestazione) return null;

  const token = intestazione.replace('Bearer ', '');
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

function risposta(corpo: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (richiesta: Request) => {
  if (richiesta.method !== 'POST') {
    return risposta({ errore: 'Metodo non consentito' }, 405);
  }

  const client = clienteServizio();
  const email = await emailUtenteAutenticato(richiesta, client);
  if (email !== EMAIL_AMMINISTRATORE) {
    return risposta({ errore: 'Non autorizzato' }, 403);
  }

  const corpo = await richiesta.json();

  if (corpo.azione === 'elenco_utenti') {
    const { data, error } = await client.auth.admin.listUsers();
    if (error) {
      return risposta({ errore: error.message }, 500);
    }
    const utenti = data.users.map((u) => ({ id: u.id, email: u.email }));
    return risposta({ utenti }, 200);
  }

  return risposta({ errore: 'Azione sconosciuta' }, 400);
});
