-- The mail store behind /admin/email.
--
-- Run this once in the Supabase SQL editor. The console's service role key is a
-- PostgREST token — it can read and write rows but cannot create tables, so this
-- has to be applied by hand. Until it is, the Email page renders a "not set up
-- yet" state rather than erroring: lib/email-queries.ts treats a missing table
-- (42P01 / PGRST205) as "no mail yet".
--
-- One row per message, inbound and outbound. There is deliberately no
-- `email_threads` table: threads are grouped in memory from `thread_id` so there
-- is no second source of truth to drift.

create table if not exists public.emails (
  id            uuid primary key default gen_random_uuid(),

  -- Assigned by us, not by the mail system. Outbound mail carries it in a
  -- Reply-To plus-address (support+t<32hex>@) so replies come back tagged.
  thread_id     uuid        not null,
  direction     text        not null check (direction in ('inbound', 'outbound')),

  -- Which of our addresses this belongs to (support@, hello@, …). Null when an
  -- inbound message arrived at an address outside EMAIL_MAILBOXES — the MX is a
  -- catch-all, so that can happen.
  mailbox       text,

  from_address  text        not null,
  from_name     text,
  to_addresses  text[]      not null default '{}',
  cc_addresses  text[]      not null default '{}',
  subject       text,
  html          text,
  "text"        text,

  -- RFC 5322 headers, kept for threading. Only ever set on inbound mail: Resend
  -- assigns the Message-ID on our sends and does not return it.
  message_id    text,
  in_reply_to   text,

  -- Resend's own id. Unique so a retried webhook delivery cannot double-insert.
  resend_id     text unique,

  -- [{ id, filename, content_type, size }] — the bytes stay at Resend and are
  -- fetched on demand through /api/email/attachment.
  attachments   jsonb       not null default '[]'::jsonb,

  -- Admin email for outbound mail; null for inbound.
  sent_by       text,

  -- Read state tracks inbound mail only; outbound rows are stamped on insert.
  read_at       timestamptz,

  -- For inbound this is the time the message was received, not the time we
  -- stored it, so ordering survives a webhook backlog.
  created_at    timestamptz not null default now()
);

create index if not exists emails_thread_id_idx  on public.emails (thread_id);
create index if not exists emails_created_at_idx on public.emails (created_at desc);
create index if not exists emails_message_id_idx on public.emails (message_id);

-- Drives the sidebar badge, which runs on every admin page load.
create index if not exists emails_unread_idx
  on public.emails (created_at desc)
  where direction = 'inbound' and read_at is null;

-- Same posture as the other tables: RLS on with no policies, so the anon key
-- reaches nothing. The console talks to this table with the service role key,
-- which bypasses RLS, and every route behind it is gated by requireAdmin().
alter table public.emails enable row level security;
