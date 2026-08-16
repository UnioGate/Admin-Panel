-- Who can open the console.
--
-- Run this once in the Supabase SQL editor, BEFORE removing ADMIN_ALLOWLIST
-- from .env.local. This table replaces that variable outright — there is no
-- env fallback, so if the table does not exist nobody can sign in.
--
-- The seed row is the bootstrap. Without it the table is empty, an empty table
-- admits nobody, and there is no way in to add the first admin. Change the
-- address below if you are setting this up for a different account.

create table if not exists public.admins (
  id         uuid primary key default gen_random_uuid(),
  email      text        not null unique,
  name       text        not null,
  -- Owner is the only role that can change this table, delete enquiries, or
  -- delete mail. lib/data.ts mirrors this list — change one, change the other.
  role       text        not null default 'Admin' check (role in ('Owner', 'Admin', 'Support')),
  created_at timestamptz not null default now(),
  -- Set means the account is suspended: the row stays, the sign-in stops.
  -- Suspending rather than deleting keeps the person's name against everything
  -- they did in the activity log, which a delete would leave pointing at
  -- nobody. Only an Owner can set or clear it.
  suspended_at timestamptz,
  -- Email of the admin who added this row; null for the seed.
  added_by   text
);

-- For consoles created before suspension existed. `if not exists` makes this a
-- no-op on a fresh install, so the whole file stays safe to re-run.
alter table public.admins add column if not exists suspended_at timestamptz;

-- Addresses are compared lowercased everywhere in the app. This stops a row
-- being inserted that the lookup could never match.
--
-- `add constraint` has no `if not exists`, so it is guarded: everything else
-- here is safe to run twice and this should be too.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'admins_email_lowercase'
  ) then
    alter table public.admins
      add constraint admins_email_lowercase check (email = lower(email));
  end if;
end $$;

-- One `values`, then a comma-separated tuple per person. A second `values`
-- keyword is a syntax error. Addresses must be lowercase, or the check
-- constraint above rejects the row.
insert into public.admins (email, name, role)
values
  ('chidileozoemena@gmail.com', 'Chidile Ozoemena', 'Owner')
on conflict (email) do nothing;

-- Same posture as the other tables: RLS on with no policies, so the anon key
-- reaches nothing. Only the service role — server-side, behind requireAdmin() —
-- ever reads or writes this.
alter table public.admins enable row level security;
