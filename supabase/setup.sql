-- Ejecutar una vez en el SQL Editor de un proyecto Supabase dedicado a Therapy.
-- Puede repetirse: no reemplaza los registros existentes.
create table if not exists public.therapy_state (
  id integer primary key check (id=1),
  revision integer not null default 0,
  payload jsonb not null
);
create table if not exists public.therapy_files (
  id uuid primary key,
  target text not null,
  name text not null,
  mime text not null,
  size integer not null check (size>0 and size<=4000000),
  created timestamptz not null default now()
);
create index if not exists therapy_files_target on public.therapy_files(target);
alter table public.therapy_state enable row level security;
alter table public.therapy_files enable row level security;
revoke all on public.therapy_state,public.therapy_files from anon,authenticated;
grant select,insert,update,delete on public.therapy_state,public.therapy_files to service_role;
insert into public.therapy_state(id,payload) values (1,
  '{"version":7,"suppliers":[],"items":[],"sales":[],"settlements":[],"payments":[],"returns":[],"priceChanges":[],"reviews":[],"proposals":[],"adjustments":[],"imports":[],"audit":[],"counters":{"item":0,"supplier":0}}'::jsonb
) on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('therapy-files','therapy-files',false,4000000,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=4000000,
  allowed_mime_types=excluded.allowed_mime_types;
-- No crear políticas públicas de lectura/escritura para este bucket.
