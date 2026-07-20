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

-- Fase 6: pannello di controllo riservato

create table if not exists richieste_accesso (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text not null,
  cognome text not null,
  richiesto_il timestamptz not null default now(),
  stato text not null default 'in_attesa' check (stato in ('in_attesa', 'approvata', 'rifiutata'))
);

create table if not exists parole_chiave (
  id uuid primary key default gen_random_uuid(),
  parola text not null,
  livello text not null check (livello in ('livello1', 'livello2')),
  unique (parola, livello)
);

create table if not exists impostazioni_job (
  id int primary key default 1,
  ora int not null check (ora >= 0 and ora <= 23),
  fuso_orario text not null default 'Europe/Rome'
);

alter table richieste_accesso enable row level security;
alter table parole_chiave enable row level security;
alter table impostazioni_job enable row level security;

-- Un solo amministratore, per disegno di questa fase: panto75@gmail.com.
create policy "richieste_accesso_admin_select" on richieste_accesso
  for select to authenticated using (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "richieste_accesso_admin_update" on richieste_accesso
  for update to authenticated
  using (auth.jwt() ->> 'email' = 'panto75@gmail.com')
  with check (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "richieste_accesso_public_insert" on richieste_accesso
  for insert to anon, authenticated with check (true);

create policy "parole_chiave_admin_select" on parole_chiave
  for select to authenticated using (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "parole_chiave_admin_insert" on parole_chiave
  for insert to authenticated with check (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "parole_chiave_admin_delete" on parole_chiave
  for delete to authenticated using (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "impostazioni_job_admin_select" on impostazioni_job
  for select to authenticated using (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "impostazioni_job_admin_update" on impostazioni_job
  for update to authenticated
  using (auth.jwt() ->> 'email' = 'panto75@gmail.com')
  with check (auth.jwt() ->> 'email' = 'panto75@gmail.com');

create policy "job_run_log_admin_select" on job_run_log
  for select to authenticated using (auth.jwt() ->> 'email' = 'panto75@gmail.com');

-- Grant espliciti: RLS da sola non basta senza queste, come già scoperto due volte.
grant select, insert, update on table public.richieste_accesso to anon, authenticated;
grant select, insert, delete on table public.parole_chiave to authenticated;
grant select, update on table public.impostazioni_job to authenticated;
grant select on table public.job_run_log to authenticated;
grant all on table public.richieste_accesso to service_role;
grant all on table public.parole_chiave to service_role;
grant all on table public.impostazioni_job to service_role;

-- Migrazione una tantum dei valori oggi in config/keywords.json e config/schedule.json.
insert into parole_chiave (parola, livello) values
  ('gaming', 'livello1'),
  ('fintech', 'livello1'),
  ('regtech', 'livello1'),
  ('economia circolare', 'livello1'),
  ('circular economy', 'livello1'),
  ('intelligenza artificiale', 'livello2'),
  ('artificial intelligence', 'livello2'),
  ('ai', 'livello2'),
  ('tecnologia', 'livello2'),
  ('tecnologico', 'livello2'),
  ('technology', 'livello2'),
  ('tech', 'livello2'),
  ('startup', 'livello2'),
  ('start-up', 'livello2'),
  ('innovazione', 'livello2'),
  ('innovation', 'livello2')
on conflict (parola, livello) do nothing;

insert into impostazioni_job (id, ora, fuso_orario) values (1, 8, 'Europe/Rome')
on conflict (id) do nothing;

-- Una tantum (2026-07-20, Fase 6d): l'amministratore predata la Fase 6d, quindi
-- non ha nome/cognome in user_metadata come i futuri utenti approvati. Merge
-- additivo per non toccare le altre chiavi già presenti (sub, email_verified...).
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"nome":"Luca","cognome":"Panto"}'::jsonb
where email = 'panto75@gmail.com';

-- Fase 6e: colonna per le parole chiave che hanno causato la classificazione
-- di ogni bando (invece di mostrare solo l'etichetta astratta "Match
-- diretto"/"Da verificare" nella dashboard).
alter table bandi add column if not exists parole_corrispondenti text[] not null default '{}';
