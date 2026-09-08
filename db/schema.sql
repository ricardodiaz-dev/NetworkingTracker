-- Secure Networking Tracker — database schema
--
-- Run this in the Neon SQL Editor AFTER enabling Managed Better Auth and the Data API,
-- so that the `auth` schema (and `auth.user_id()`) and the `authenticated` role exist.
--
-- Ownership model: every row carries a text `user_id` that defaults to auth.user_id().
-- The client never sends user_id; Postgres fills it from the verified JWT. RLS then
-- restricts every operation to rows where auth.user_id() = user_id.

create table if not exists contacts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    text        not null default (auth.user_id()),

  name       text        not null,
  company    text,
  role       text,
  met_at     text,
  notes      text,
  priority   text        not null default 'medium',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Backstop for the API-layer Zod validation. Even a direct Data API call cannot
  -- write a blank name or an out-of-range priority.
  constraint contacts_name_not_blank check (length(btrim(name)) > 0),
  constraint contacts_name_max_len   check (length(name) <= 120),
  constraint contacts_priority_valid check (priority in ('high', 'medium', 'low')),

  -- Alphabetical ordering of priority would give high, low, medium. This stored column
  -- lets ORDER BY produce the meaningful high -> medium -> low sequence instead.
  priority_rank int generated always as (
    case priority when 'high' then 1 when 'medium' then 2 else 3 end
  ) stored
);

create index if not exists contacts_user_id_idx    on contacts (user_id);
create index if not exists contacts_created_at_idx on contacts (user_id, created_at desc);

-- Keep updated_at honest even if a row is changed outside the API layer.
create or replace function set_updated_at() returns trigger
  language plpgsql
  as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contacts_set_updated_at on contacts;
create trigger contacts_set_updated_at
  before update on contacts
  for each row execute function set_updated_at();


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table contacts enable row level security;

-- Belt and braces: without this, a future table owner would bypass RLS silently.
alter table contacts force row level security;

drop policy if exists contacts_select on contacts;
drop policy if exists contacts_insert on contacts;
drop policy if exists contacts_update on contacts;
drop policy if exists contacts_delete on contacts;

create policy contacts_select on contacts
  for select to authenticated
  using (auth.user_id() = user_id);

create policy contacts_insert on contacts
  for insert to authenticated
  with check (auth.user_id() = user_id);

-- USING decides which rows may be targeted; WITH CHECK decides what they may become.
-- Both are required: WITH CHECK is what stops a user from re-assigning one of their
-- rows to somebody else by updating user_id.
create policy contacts_update on contacts
  for update to authenticated
  using (auth.user_id() = user_id)
  with check (auth.user_id() = user_id);

create policy contacts_delete on contacts
  for delete to authenticated
  using (auth.user_id() = user_id);


-- ---------------------------------------------------------------------------
-- Grants
--
-- RLS narrows access but grants are what open the door at all. The Data API maps an
-- authenticated JWT to the `authenticated` role, so that role needs table privileges.
-- `anonymous` (no Authorization header) is deliberately granted nothing.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on contacts to authenticated;

revoke all on contacts from anonymous;
