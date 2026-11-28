-- Preview-only migration. The existing public feed and analytics are independent.
create function public.joblele_queue_url(value text) returns text
language sql immutable strict set search_path = '' as $$
  select case when value !~ '^https://[a-zA-Z0-9.-]+([/?#]|$)'
                    or value ~ '[[:space:]]'
                    or value ~* '[?&](token|access_token|auth|session|sid|signature|sig|key|email|applicant_id|candidate_id|code)='
              then null else
    regexp_replace(lower(split_part(value, '/', 3)), '[?#].*$', '') ||
    regexp_replace(regexp_replace(split_part(split_part(value, '#', 1), '?', 1), '^https://[^/]+', ''), '/+$', '') ||
    coalesce((
      select '?' || string_agg(pair, '&' order by pair)
      from unnest(string_to_array(split_part(split_part(value, '#', 1), '?', 2), '&')) pair
      where pair <> '' and lower(split_part(pair, '=', 1)) !~ '^(utm_.*|trk|trackingid|refid|ref|source|gh_src|fbclid|gclid|igshid)$'
    ), '')
  end
$$;

create table public.joblele_sourcing_queue (
  id uuid primary key default gen_random_uuid(),
  sequence_no integer generated always as identity unique,
  company text not null check (char_length(company) between 1 and 100),
  title text not null check (char_length(title) between 1 and 150),
  location text not null check (char_length(location) between 1 and 100),
  experience text not null check (char_length(experience) between 1 and 100),
  requisition text check (requisition ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$'),
  req_key text generated always as (
    case when requisition is not null then regexp_replace(lower(company), '[^a-z0-9]', '', 'g') || ':' || lower(requisition) end
  ) stored unique,
  apply_url text not null check (char_length(apply_url) between 9 and 2048),
  apply_key text generated always as (public.joblele_queue_url(apply_url)) stored not null unique,
  posted_date date,
  state text not null default 'collected' check (state in ('collected','verified','reserved','sent_to_muse','posted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz,
  batch_id uuid,
  reserved_until timestamptz,
  sent_at timestamptz,
  handoff_receipt text check (char_length(handoff_receipt) <= 300),
  x_post_url text check (x_post_url ~ '^https://(www\.)?(x\.com|twitter\.com)/[A-Za-z0-9_]+/status/[0-9]{1,24}$'),
  publication_basis text check (publication_basis in ('owner_reported','link_confirmed')),
  publication_recorded_at timestamptz,
  check ((state = 'posted') = (publication_basis is not null)),
  check ((state = 'posted') = (publication_recorded_at is not null)),
  check (publication_basis is distinct from 'link_confirmed' or x_post_url is not null),
  check (state <> 'reserved' or (batch_id is not null and reserved_until is not null)),
  check (state <> 'sent_to_muse' or (sent_at is not null and handoff_receipt is not null))
);
alter table public.joblele_sourcing_queue enable row level security;
revoke all on table public.joblele_sourcing_queue from public, anon, authenticated, service_role;
grant select on table public.joblele_sourcing_queue to service_role;
create index joblele_queue_state_recent on public.joblele_sourcing_queue (state, sequence_no desc);
create table public.joblele_queue_url_aliases (
  apply_key text primary key,
  queue_id uuid not null references public.joblele_sourcing_queue(id)
);
alter table public.joblele_queue_url_aliases enable row level security;
revoke all on table public.joblele_queue_url_aliases from public, anon, authenticated, service_role;
create index joblele_queue_url_alias_owner on public.joblele_queue_url_aliases(queue_id);
create index joblele_queue_company_title on public.joblele_sourcing_queue (lower(company), lower(title));

create function public.joblele_queue_intake(
  p_company text, p_title text, p_location text, p_experience text, p_apply_url text,
  p_requisition text default null, p_posted_date date default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.joblele_sourcing_queue; k text; u text; ids uuid[];
begin
  p_company := btrim(p_company); p_title := btrim(p_title);
  p_requisition := nullif(btrim(p_requisition), ''); p_apply_url := btrim(p_apply_url);
  u := public.joblele_queue_url(p_apply_url);
  if u is null or (p_posted_date is not null and p_posted_date > (now() at time zone 'Asia/Kolkata')::date) then
    return jsonb_build_object('result','invalid');
  end if;
  k := case when p_requisition is not null then regexp_replace(lower(p_company), '[^a-z0-9]', '', 'g') || ':' || lower(p_requisition) end;
  -- Serialize overlapping identity keys in deterministic order. Unique constraints are the final guard.
  perform pg_advisory_xact_lock(locks.lock_id)
  from (
    select distinct hashtextextended(keys.value, 480125) as lock_id
    from unnest(array['joblele:url:' || u, 'joblele:req:' || k]) keys(value)
    where keys.value is not null order by lock_id
  ) locks;
  select array_agg(id) into ids from (
    select id from public.joblele_sourcing_queue where apply_key = u or req_key = k
    union select queue_id from public.joblele_queue_url_aliases where apply_key = u
  ) hits;
  if cardinality(ids) > 1 then return jsonb_build_object('result','identity_conflict'); end if;
  if cardinality(ids) = 1 then
    select * into q from public.joblele_sourcing_queue where id=ids[1] for update;
    if q.req_key is not null and k is not null and q.req_key <> k then
      return jsonb_build_object('result','identity_conflict');
    end if;
    if q.req_key is null and k is not null then
      update public.joblele_sourcing_queue set requisition=p_requisition, updated_at=now() where id=q.id;
    end if;
    insert into public.joblele_queue_url_aliases(apply_key,queue_id) values (u,q.id) on conflict do nothing;
    return jsonb_build_object('result','duplicate','id',q.id,'state',q.state);
  end if;
  insert into public.joblele_sourcing_queue(company,title,location,experience,apply_url,requisition,posted_date)
  values (p_company,p_title,btrim(p_location),btrim(p_experience),p_apply_url,p_requisition,p_posted_date)
  returning * into q;
  return jsonb_build_object('result','added','id',q.id,'state',q.state,'possible_duplicate',
    exists(select 1 from public.joblele_sourcing_queue s where s.id<>q.id and lower(s.company)=lower(q.company) and lower(s.title)=lower(q.title)));
exception when check_violation or not_null_violation then return jsonb_build_object('result','invalid');
end
$$;

create function public.joblele_queue_reserve(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare batch uuid := gen_random_uuid(); matched integer;
begin
  if p_ids is null or cardinality(p_ids) not between 1 and 3
     or cardinality(p_ids) <> (select count(distinct v) from unnest(p_ids) v) then
    return jsonb_build_object('result','invalid');
  end if;
  perform id from public.joblele_sourcing_queue where id=any(p_ids) order by id for update;
  select count(*) into matched from public.joblele_sourcing_queue where id=any(p_ids)
    and (state='verified' or (state='reserved' and reserved_until <= now()));
  if matched<>cardinality(p_ids) then return jsonb_build_object('result','unavailable'); end if;
  update public.joblele_sourcing_queue set state='reserved',batch_id=batch,
    reserved_until=now()+interval '30 minutes',updated_at=now() where id=any(p_ids);
  return jsonb_build_object('result','reserved','batch_id',batch);
end
$$;

create function public.joblele_queue_move(
  p_id uuid, p_action text, p_evidence text default null, p_batch uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare changed uuid;
begin
  p_evidence := nullif(btrim(p_evidence),'');
  if p_action='verify' then
    update public.joblele_sourcing_queue set state='verified',verified_at=now(),updated_at=now()
      where id=p_id and state='collected' returning id into changed;
  elsif p_action='release' then
    update public.joblele_sourcing_queue set state='verified',batch_id=null,reserved_until=null,updated_at=now()
      where id=p_id and state='reserved' and batch_id=p_batch returning id into changed;
  elsif p_action='sent' then
    if p_evidence is null or char_length(p_evidence)>300 then return jsonb_build_object('result','invalid'); end if;
    update public.joblele_sourcing_queue set state='sent_to_muse',sent_at=now(),handoff_receipt=p_evidence,reserved_until=null,updated_at=now()
      where id=p_id and state='reserved' and batch_id=p_batch returning id into changed;
  elsif p_action in ('owner_posted','confirm_post') then
    if (p_action='confirm_post' and p_evidence is null)
      or (p_evidence is not null and p_evidence !~ '^https://(www\.)?(x\.com|twitter\.com)/[A-Za-z0-9_]+/status/[0-9]{1,24}$') then
      return jsonb_build_object('result','invalid');
    end if;
    update public.joblele_sourcing_queue set state='posted',reserved_until=null,publication_recorded_at=now(),
      x_post_url=coalesce(p_evidence,x_post_url),updated_at=now(),
      publication_basis=case when p_action='confirm_post' then 'link_confirmed' else 'owner_reported' end
      where id=p_id and (state<>'posted' or (publication_basis='owner_reported' and p_action='confirm_post'))
      returning id into changed;
  else return jsonb_build_object('result','invalid');
  end if;
  return jsonb_build_object('result',case when changed is null then 'unavailable' else 'saved' end);
end
$$;

revoke all on function public.joblele_queue_url(text) from public, anon, authenticated, service_role;
revoke all on function public.joblele_queue_intake(text,text,text,text,text,text,date) from public, anon, authenticated, service_role;
revoke all on function public.joblele_queue_reserve(uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.joblele_queue_move(uuid,text,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.joblele_queue_intake(text,text,text,text,text,text,date) to service_role;
grant execute on function public.joblele_queue_reserve(uuid[]) to service_role;
grant execute on function public.joblele_queue_move(uuid,text,text,uuid) to service_role;
