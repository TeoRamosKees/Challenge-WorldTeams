-- Extensión para guardar embeddings (pgvector)
create extension if not exists vector with schema extensions;


-- referrers: empleados que pueden referir
-- para este MVP, esta tabla parte de un seed, la idea seria conectar con una base de datos
-- preexistente, google workspace, etc. que sirva con un "login".
create table public.referrers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  full_name   text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index referrers_email_uk on public.referrers (lower(email));


-- candidates: una fila por persona referida, con su estado en el proceso
create table public.candidates (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  full_name           text not null,
  linkedin_url        text,                              -- opcional
  country             text,
  profile_type        text not null default 'other'
                      check (profile_type in ('architecture', 'engineering', 'design',
                                              'support', 'other')),
  profile_description text,                              -- texto libre del perfil
  profile_embedding   extensions.vector(1536),           -- embedding de profile_description
  notes               text,                              -- por qué lo recomienda el empleado
  consent_confirmed   boolean not null default false,    -- el empleado declara que el candidato aceptó
  status              text not null default 'submitted'
                      check (status in ('submitted', 'hired', 'rejected')),
  hired_at            timestamptz,
  created_at          timestamptz not null default now()
);

-- Unicidad por email (sin distinguir mayúsculas)
create unique index candidates_email_uk on public.candidates (lower(email));

-- Búsqueda por similitud (distancia coseno) sobre el embedding
create index candidates_profile_embedding_idx
  on public.candidates
  using hnsw (profile_embedding extensions.vector_cosine_ops);

-- referrals: une al empleado que refiere con el candidato referido
create table public.referrals (
  id            uuid primary key default gen_random_uuid(),
  referrer_id   uuid not null references public.referrers (id),
  candidate_id  uuid not null references public.candidates (id),
  -- un candidato proviene de un solo empleado
  constraint referrals_candidate_uk unique (candidate_id)
);

create index referrals_referrer_idx on public.referrals (referrer_id);

-- rewards: se crea (desde n8n) cuando el candidato es contratado
-- paid_at vacío = pendiente de pago
create table public.rewards (
  id           uuid primary key default gen_random_uuid(),
  referral_id  uuid not null references public.referrals (id),
  amount_usd   numeric(10,2) not null check (amount_usd >= 0),
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  -- una sola recompensa por referido
  constraint rewards_referral_uk unique (referral_id)
);

-- Seguridad: RLS activado sin políticas. Solo accede el service role
-- (n8n y el backend de la landing). Nada queda expuesto públicamente.
alter table public.referrers  enable row level security;
alter table public.candidates enable row level security;
alter table public.referrals  enable row level security;
alter table public.rewards    enable row level security;