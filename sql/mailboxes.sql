-- Addresses the console can send and receive as, and who each one belongs to.
--
-- Run this in the Supabase SQL editor. Run sql/admins.sql again first if you
-- set the console up before this file existed — it gained a `suspended_at`
-- column that this feature depends on, and it is safe to re-run.
--
-- This replaces the EMAIL_MAILBOXES environment variable outright. There is no
-- env fallback, for the same reason the allowlist has none: two sources would
-- eventually disagree and the winner would be whichever the reader happened to
-- check. Remove EMAIL_MAILBOXES from .env.local once this has run.

create table if not exists public.mailboxes (
  id          uuid primary key default gen_random_uuid(),
  -- Full address, lowercase. Must be on the domain Resend has verified —
  -- an address anywhere else cannot send, so the API refuses to create one.
  address     text        not null unique,
  label       text        not null default '',
  -- The admin this address belongs to, by email. Null means shared: every
  -- admin can read and send as it, which is what support@ and hello@ are.
  --
  -- Deliberately not a foreign key. Deleting an admin should not cascade into
  -- a mailbox that has months of mail behind it; the API suspends and detaches
  -- it instead, which keeps the history and closes the access.
  assigned_to text,
  -- Suspended: still receives, still readable, cannot send. Suspending rather
  -- than deleting keeps the conversations attached to a real address.
  suspended_at timestamptz,
  created_at  timestamptz not null default now(),
  created_by  text
);

-- Addresses are compared lowercased everywhere in the app, and a `+` in the
-- local part would collide with the `+t<thread>` reply token that holds
-- conversations together. Both are rejected at the door.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mailboxes_address_shape'
  ) then
    alter table public.mailboxes
      add constraint mailboxes_address_shape
      check (address = lower(address) and address !~ '\+' and address ~ '^[^@[:space:]]+@[^@[:space:]]+$');
  end if;
end $$;

-- Looking a mailbox up by owner happens on every email page load.
create index if not exists mailboxes_assigned_to_idx on public.mailboxes (assigned_to);

-- The three shared addresses the console started with, so nothing that already
-- works stops working when EMAIL_MAILBOXES goes away. No assignee: these belong
-- to the team, not to a person. Per-person addresses are added from Settings.
insert into public.mailboxes (address, label)
values
  ('support@uniogate.com',  'Support'),
  ('hello@uniogate.com',    'General'),
  ('partners@uniogate.com', 'Partnerships')
on conflict (address) do nothing;

-- Same posture as every other table: RLS on with no policies, so the anon key
-- reaches nothing. Only the service role — server-side, behind requireAdmin() —
-- ever reads or writes this.
alter table public.mailboxes enable row level security;
