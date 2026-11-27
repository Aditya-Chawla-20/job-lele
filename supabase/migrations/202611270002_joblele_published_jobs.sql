-- Apply only to the isolated JobLele Preview database for this PR.
create table public.joblele_published_jobs (
  id text primary key check (id ~ '^admin-[0-9a-f-]{36}$'),
  posted_date date not null,
  apply_url text unique not null check (length(apply_url) <= 2048 and apply_url like 'https://%'),
  listing jsonb not null check (jsonb_typeof(listing) = 'object'),
  published_at timestamptz not null default now()
);

create index joblele_published_jobs_recent on public.joblele_published_jobs (posted_date desc, published_at desc);
alter table public.joblele_published_jobs enable row level security;
revoke all on public.joblele_published_jobs from public, anon, authenticated, service_role;
grant select, insert on public.joblele_published_jobs to service_role;
