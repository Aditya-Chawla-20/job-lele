-- Apply only to the separate JobLele preview Supabase project for this PR.
create table public.joblele_analytics_events (
  id uuid primary key,
  session_id uuid not null,
  kind text not null check (kind in ('board_view', 'detail_view', 'apply_click')),
  job_id text,
  source text not null check (source in ('direct', 'x', 'linkedin', 'naukri', 'search', 'email', 'other')),
  campaign text not null default '' check (campaign = '' or campaign ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  device text not null check (device in ('mobile', 'tablet', 'desktop', 'unknown')),
  recorded_at timestamptz not null default now(),
  check ((kind = 'board_view' and job_id is null) or (kind <> 'board_view' and length(job_id) between 1 and 150 and job_id is not null))
);
create index joblele_events_recent on public.joblele_analytics_events (recorded_at);
alter table public.joblele_analytics_events enable row level security;
revoke all on public.joblele_analytics_events from public, anon, authenticated;
grant select, insert on public.joblele_analytics_events to service_role;

create function public.joblele_analytics_report(window_days integer default 30)
returns jsonb language sql stable security invoker set search_path = '' as $$
with bounds as (
  select ((now() at time zone 'Asia/Kolkata')::date - (least(greatest(coalesce(window_days, 30), 1), 30) - 1)) as first_day,
         (now() at time zone 'Asia/Kolkata')::date as last_day
), events as materialized (
  select e.*, (recorded_at at time zone 'Asia/Kolkata')::date as day
  from public.joblele_analytics_events e cross join bounds b
  where recorded_at >= (b.first_day::timestamp at time zone 'Asia/Kolkata')
    and recorded_at < ((b.last_day + 1)::timestamp at time zone 'Asia/Kolkata')
), days as (
  select b.first_day + n as day
  from bounds b cross join pg_catalog.generate_series(0, b.last_day - b.first_day) as series(n)
), dimensions as (
  select dim.group_name, dim.label, e.kind
  from events e cross join lateral (values ('sources', e.source), ('devices', e.device),
    ('campaigns', nullif(e.campaign, '')), ('jobs', e.job_id)) as dim(group_name, label)
  where dim.label is not null
), breakdowns as (
  select group_name, label, count(*) filter (where kind='board_view') as board_views,
    count(*) filter (where kind='detail_view') as detail_views,
    count(*) filter (where kind='apply_click') as apply_clicks
  from dimensions group by group_name, label
), daily as (
  select d.day::text as label, count(e.id) filter (where e.kind='board_view') as board_views,
    count(e.id) filter (where e.kind='detail_view') as detail_views,
    count(e.id) filter (where e.kind='apply_click') as apply_clicks
  from days d left join events e using (day) group by d.day
), job_daily as (
  select job_id as label, day, source, device,
    count(*) filter (where kind='detail_view') as detail_views,
    count(*) filter (where kind='apply_click') as apply_clicks
  from events where job_id is not null
  group by job_id, day, source, device
  order by day desc, apply_clicks desc, detail_views desc, job_id, source, device
  limit 250
), totals as (
  select count(*) filter (where kind='board_view') as board_views,
    count(*) filter (where kind='detail_view') as detail_views,
    count(*) filter (where kind='apply_click') as apply_clicks,
    count(distinct session_id) as sessions,
    count(distinct session_id) filter (where kind='apply_click') as converted_sessions
  from events
)
select jsonb_build_object(
  'totals', (select to_jsonb(t) from totals t),
  'daily', coalesce((select jsonb_agg(to_jsonb(d) order by label desc) from daily d), '[]'::jsonb),
  'sources', coalesce((select jsonb_agg(to_jsonb(b) - 'group_name' order by apply_clicks desc, board_views desc, label) from breakdowns b where group_name='sources'), '[]'::jsonb),
  'devices', coalesce((select jsonb_agg(to_jsonb(b) - 'group_name' order by apply_clicks desc, board_views desc, label) from breakdowns b where group_name='devices'), '[]'::jsonb),
  'campaigns', coalesce((select jsonb_agg(to_jsonb(c) - 'group_name') from (select * from breakdowns where group_name='campaigns' order by apply_clicks desc, board_views desc, label limit 100) c), '[]'::jsonb),
  'jobs', coalesce((select jsonb_agg(to_jsonb(j) - 'group_name') from (select * from breakdowns where group_name='jobs' order by apply_clicks desc, detail_views desc, label limit 100) j), '[]'::jsonb),
  'job_daily', coalesce((select jsonb_agg(to_jsonb(j) order by day desc, apply_clicks desc, detail_views desc, label, source, device) from job_daily j), '[]'::jsonb)
);
$$;
revoke all on function public.joblele_analytics_report(integer) from public, anon, authenticated;
grant execute on function public.joblele_analytics_report(integer) to service_role;
