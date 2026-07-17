-- QYROS Bandi Monitor — schema Supabase (Fase 3)
-- Da eseguire una sola volta nell'SQL Editor di Supabase:
-- Project → SQL Editor → New query → incollare questo intero file → Run

create table if not exists bandi (
  id uuid primary key default gen_random_uuid(),
  fonte text not null,
  titolo text not null,
  descrizione text not null,
  url text not null,
  scadenza date,
  data_pubblicazione date,
  hash_contenuto text not null,
  priorita text check (priorita in ('alta', 'da_verificare')),
  scartato boolean not null default false,
  stato text not null default 'nuovo' check (stato in ('nuovo', 'visto', 'scaduto')),
  primo_rilevamento timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  unique (fonte, url)
);

create table if not exists job_run_log (
  id uuid primary key default gen_random_uuid(),
  eseguito_il timestamptz not null default now(),
  fonti_ok text[] not null default '{}',
  fonti_fallite jsonb not null default '[]'::jsonb,
  nuovi_bandi integer not null default 0
);

-- Row Level Security: lettura e modifica riservate agli utenti autenticati
-- (dashboard, Fase 4). Il job scrive con la service_role key, che bypassa
-- sempre le policy RLS per progetto/disegno di Supabase: non serve alcuna
-- policy esplicita per l'inserimento dal job.
alter table bandi enable row level security;
alter table job_run_log enable row level security;

create policy "bandi_select_authenticated" on bandi
  for select to authenticated using (true);

create policy "bandi_update_stato_authenticated" on bandi
  for update to authenticated using (true) with check (true);

-- Correzione: la tabella job_run_log non aveva i permessi di scrittura per
-- il ruolo service_role (usato dal job), a differenza di bandi. Concessione
-- esplicita, sicura da eseguire più volte.
grant all on table public.job_run_log to service_role;
grant all on table public.bandi to service_role;

-- Correzione: la tabella bandi aveva le policy RLS per il ruolo authenticated
-- (Fase 4, dashboard) ma non i permessi di base sulla tabella — le policy RLS
-- da sole non bastano senza una grant esplicita. Scoperto nella prima verifica
-- reale della dashboard (Fase 4b): errore "permission denied for table bandi"
-- al primo accesso autenticato. Concessione esplicita, sicura da eseguire più
-- volte. Solo select/update: la dashboard non deve poter inserire o cancellare
-- righe, quello resta compito esclusivo del job (service_role).
grant select, update on table public.bandi to authenticated;
