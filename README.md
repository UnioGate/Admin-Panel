# UnioGate Admin

Next.js (App Router) console for the UnioGate waitlist and contact inbox. Auth is Privy; only
allowlisted emails/wallets can open it.

## Run

    npm install
    cp .env.example .env.local   # Privy, Supabase, Resend
    # run sql/admins.sql in the Supabase SQL editor
    npm run dev

Nobody can open the console until they are in the `admins` table. That table *is* the
allowlist — there is no environment variable and no fallback, so a missing or empty table
admits nobody. `sql/admins.sql` seeds the first Owner; without that seed there would be no
way in to add anyone. After that, admins are managed from Settings and take effect on the
next request.

## Structure

    app/login/page.tsx          Sign-in screen — our own UI on Privy's headless hooks
    app/providers.tsx           PrivyProvider config (the modal is unused)
    app/admin/layout.tsx        Sidebar shell + allowlist guard + providers
    app/admin/page.tsx          Overview (stats, 14-day chart, activity)
    app/admin/waitlist/page.tsx Sortable, paginated, selectable table + record drawer
    app/admin/email/page.tsx    Shared mailboxes — read and reply as support@, hello@, partners@
    app/admin/messages/page.tsx Contact inbox
    app/admin/activity/page.tsx Audit log
    app/admin/settings/page.tsx Admin allowlist + mailboxes + Privy config
    app/api/*                   Route handlers (invites is still a stub)
    app/api/email/inbound/      Resend webhook — the only route not behind requireAdmin()
    components/*                Client halves of the pages above (tables, inbox, drawer, chart)
    lib/admins.ts               The allowlist table — the one source for who is an admin
    lib/mailboxes.ts            The mailboxes table — which addresses exist and who holds them
    lib/auth.ts                 requireAdmin(): verifies the Privy token, looks up the admin
    lib/supabase.ts             Service-role client — server-only, throws if imported client-side
    lib/queries.ts              Every read and write against Supabase
    lib/resend.ts               Resend client + the verified sending domain
    lib/email.ts                Pure address/subject/threading helpers
    lib/email-queries.ts        Reads and writes against `emails`, and thread resolution
    lib/data.ts                 Shared row types
    lib/format.ts               Date/subject helpers — run server-side so hydration matches
    lib/store.tsx               Client state: session notes, admins, toasts
    lib/theme.ts                Design tokens shared with the marketing site
    app/globals.css             Base styles + every responsive rule — see Layout
    sql/admins.sql              Migration for the allowlist — run this first, it seeds the Owner
    sql/emails.sql              Migration for the mail store — run by hand, see Email
    sql/mailboxes.sql           Migration for the addresses — run after admins.sql, see Mailboxes
    proxy.ts                    Cookie gate on /admin (was middleware.ts before Next 16)

Pages are server components: they call `lib/queries.ts` directly and hand rows to a client
child. Writes go through the route handlers, which re-check `requireAdmin()`, then
`router.refresh()` re-runs the server component.

## Layout

Components are styled with inline `style={{}}`, which cannot express a media query — and
which beats any stylesheet rule. So responsiveness lives in `app/globals.css` as a small set
of named classes, and a property only reflows if it has been **removed from the inline style
and moved into the class**. Leave a `gridTemplateColumns` or a `fontSize` inline and the
media query below it is dead code.

Breakpoints are the marketing site's (Tailwind's defaults): **1024px** and **768px**. They are
`max-width` queries, because the desktop layout is the base and mobile is the override.

    .shell / .sidebar / .topbar   Sidebar is a grid column above 1024px, an off-canvas
                                  drawer below it, opened from the topbar hamburger
    .page-pad / .page-header      40px side padding → 16px
    .page-title / .login-title    38px → 28px, 64px → 38px
    .stat-grid                    4 → 2 → 1 column (the last at 520px)
    .split-main / .two-pane       Two panes → stacked; the list pane gets a capped
    .two-pane-wide                height so it does not bury the item you opened
    .settings-grid / .admin-row   Four-column rows fold to two lines
    .activity-row                 Grid areas, so the timestamp moves without the DOM
                                  order changing
    .drawer / .drawer-narrow      Fixed widths → full-bleed
    .login-nav / .login-mark      The login navbar, stepped down the way the marketing
    .login-logo / .login-chip     site's does: 90% wide → 95%, and smaller type
    .segmented                    The email folder tabs: content-width → full-width, so
                                  the three targets are big enough to hit on a phone
    .scroll-x / .stack-sm         Wide content scrolls in its own box; toolbars stack
    .hide-sm                      Drops the decorative date from the page header

Wide tables keep `overflow-x: auto` on their wrapper: they scroll sideways inside the card
rather than making the page do it.

## Data

Six tables in Supabase, read with the service role key (RLS is bypassed, so the key is
server-only and every caller sits behind `requireAdmin()`):

    admins            id, email, name, role, suspended_at, created_at, added_by
    mailboxes         id, address, label, assigned_to, suspended_at, created_at, created_by
    waitlist          id, email, created_at, unsubscribed, hidden_at
    contact_messages  id, created_at, name, email, message, topic, business, volume,
                      status, handled_at, notes
    admin_activity    id, created_at, actor, action, target, kind
    emails            see sql/emails.sql — one row per message, inbound and outbound

`contact_messages.status` is pinned by a check constraint
(`contact_messages_status_vals`) to `new | in_progress | replied | spam`. `MESSAGE_STATUSES`
in `lib/data.ts` mirrors it — change one and you must change the other, or writes fail with
`23514`. `handled_at` is set for the terminal states only.

Deleting an enquiry is Owner only and permanent — there is no soft delete for
`contact_messages` as there is for waitlist rows. The role comes from the server-only
allowlist, so `app/api/messages/route.ts` enforces it; hiding the button is only a courtesy.

## Access

`admins` is the allowlist. `requireAdmin()` verifies the Privy cookie, looks the email up in
that table, and returns the row's role — one indexed read per request, which is what buys you
an allowlist editable at runtime instead of one baked into a deploy.

Nothing about access is decided in the browser. The layout resolves the session server-side
and hands it down; `AuthGuard` and the Sidebar render from that rather than re-deriving a
verdict from a client-side copy of the list. The list only reaches the browser for someone
already through the gate, and `NEXT_PUBLIC_ADMIN_ALLOWLIST` is gone — nothing about who is an
admin ships in the bundle.

The login page no longer pre-checks the address. It is public and pre-auth, so checking would
mean either shipping the list or exposing an "is this person an admin?" endpoint — an
enumeration oracle either way. Anyone can request a code; only an allowlisted address gets
past `requireAdmin()` afterwards.

Only an Owner can change the list, enforced in `app/api/admins/route.ts` rather than by hiding
buttons, and every add, role change, suspension and removal is written to `admin_activity`.

**Suspend and remove are different things.** Suspending sets `suspended_at`; the row stays, so
the person's name still resolves against everything they did in the activity log, but
`requireAdmin()` returns null and they cannot sign in. Removing deletes the row. Suspension is
checked in one place — `lib/auth.ts`, not at the door of each route — so there is a single
place it can be got wrong.

Removing someone also **suspends and detaches every mailbox that was theirs**. Deleting those
would take months of conversations with them; leaving them assigned would point at a person who
no longer exists; and making them shared would silently open one person's mail to every admin
the moment they leave. An Owner reassigns them deliberately.

Four things are refused outright: removing your own access, suspending your own access (you
would lock yourself out of the console that undoes it), and removing, demoting or suspending
the last Owner — any of which leaves a console nobody can administer, recoverable only by
editing the table by hand. Suspended Owners do not count toward that last check: an Owner who
cannot sign in is no use for administering anything.

`waitlist` has no rank column — position is signup order, computed from `created_at`. The
console only shows what these columns hold; source, wallet and referral data would have to be
captured by the marketing site's signup form first.

## Email

`/admin/email` reads and replies for every address on the sending domain that you hold: the
shared ones, plus any assigned to you personally. See **Mailboxes** below for who gets what.

Setup, in order. Steps 1–4 are outside this repo and only you can do them.

1. **Resend → Domains → uniogate.com → enable Receiving.** It gives you an MX record for the
   root domain.
2. **Add that MX at Namecheap** (the domain is on `registrar-servers.com`), host `@`. The root
   currently has *no* MX at all, which is why mail to support@uniogate.com bounces today even
   though the marketing site invites replies. Nothing else claims the root, so there is no
   conflict to resolve. Leave the existing `send.uniogate.com` MX alone — that one is SES
   bounce feedback, not inbound mail.
   While you are in there, the root also has no SPF or DMARC. Worth adding:
   `@ TXT "v=spf1 include:amazonses.com ~all"` and
   `_dmarc TXT "v=DMARC1; p=none; rua=mailto:support@uniogate.com"`.
3. **Resend → Webhooks → add endpoint** `https://<deployed-host>/api/email/inbound`, event
   `email.received`. Copy the `whsec_…` signing secret.
4. **Run `sql/emails.sql` and `sql/mailboxes.sql`** in the Supabase SQL editor. Run
   `sql/admins.sql` again too if you set the console up before mailboxes existed — it gained a
   `suspended_at` column and the whole file is safe to re-run.
5. Fill in `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` and `EMAIL_DOMAIN` in `.env.local` and
   restart. There is no `EMAIL_MAILBOXES` any more — delete it if you have it.

The page states its own status: it says so if Resend is unconfigured or the table is missing,
rather than failing.

### Mailboxes

An Owner creates addresses on the domain from Settings — no DNS change and no redeploy, because
Resend already sends as any local part on a verified domain. `chidile@uniogate.com` is one
click. They used to live in `EMAIL_MAILBOXES`; they now live in the `mailboxes` table, for the
same reason the allowlist moved out of the environment.

Each address is either **shared** (`assigned_to` null — every admin can read it and send as it,
which is what `support@`, `hello@` and `partners@` are) or **assigned to one admin**, who is
then the only person other than an Owner who can touch it. An Owner sees everything; that is
what administering the domain means.

Assignment decides three separate things, and all three are settled on the server:

    /admin/email          Which addresses appear at all, and which are offered as a `From`
    /api/email/send       Whether this session may send as the `from` it posted
    /api/mailboxes GET    Which rows the browser is even told about

The last one matters. Filtering in the browser would have shipped the full list of who holds
which address to everyone, so the scoping happens in the route handler and in the server
components, never in the client.

**Suspending** a mailbox stops it sending and keeps everything else: it still receives, its old
mail is still readable, and it still appears in the mailbox filter. **Deleting** removes the
address; its conversations stay, because `emails.mailbox` is plain text rather than a reference
to this table — a thread should survive the address it came through.

Two rules on new addresses, both enforced by a check constraint as well as by the API:

- It must be on `EMAIL_DOMAIN`. Resend cannot send as anything else, so an address elsewhere
  would be created here and then fail at the point of use.
- No `+` in the local part. Outbound mail carries the thread id as `local+t<id>@`, and a
  literal `+` would make a real address and a routing address impossible to tell apart.

Only an Owner can create, assign, suspend or delete, enforced in `app/api/mailboxes/route.ts`;
every one of those writes lands in the activity log. A relabel does not — it is cosmetic, and
the log is only worth reading if everything in it matters.

### Folders

**All · Inbox · Sent**, with the mailbox filter on a separate row because the two are
independent — "support@, sent" is a reasonable thing to ask for.

A thread is in Inbox if any message on it came in, and in Sent if any message on it went out,
so a conversation that ran both ways is in **both**. That is what every mail client does, and
it is the point: an outbox that hid the replies would tear conversations in half. Splitting by
folder is a view, not a partition.

Sent would otherwise be a list of things you cannot tell apart, so threads carry their state:

    Awaiting reply   We spoke last — nobody has come back yet
    Replied          We started it and they answered

The counts on the tabs are taken after the mailbox filter, so they describe what you would
actually get if you clicked them, and the subtitle totals conversations, unread and awaiting.

### How threading works

Resend assigns the Message-ID on our outbound mail and does not hand it back, so a reply to
something we sent has nothing on our side to match against. Instead every message we send
carries a `Reply-To` with the thread id encoded as a plus-address —
`support+t<32hex>@uniogate.com`. The catch-all MX delivers that exactly like `support@`, and
the token comes back to us in the recipient list. `resolveThread()` in `lib/email-queries.ts`
tries that first, then `In-Reply-To` against a stored Message-ID, then same-subject
same-correspondent within 30 days, then starts a new thread. Only the last is a guess, which
is why it is last.

### Two things done deliberately

Inbound HTML is never rendered — it is untrusted markup from strangers and injecting it would
run on the same origin as the admin session, so the console shows the text part (or a stripped
version of the HTML). Attachments are proxied through `/api/email/attachment` and served
`content-disposition: attachment`, so Resend's signed URLs never reach the page and nothing
opens inline on this origin.

Deleting a conversation is Owner only and permanent, same as enquiries.

## Wiring checklist

1. ~~Replace the mocks with Supabase queries.~~ Done.
2. ~~Move the allowlist from the environment into a table.~~ Done — see Access.
   ~~Same for the mailbox list.~~ Done — see Mailboxes.
3. `app/api/invites/route.ts` — send through your transactional provider and record events.
4. Hiding a record is a soft delete — the console sets `hidden_at` and excludes the row from
   stats and exports, but nothing purges it. Add a scheduled job to anonymise after 30 days.
   The record drawer's internal note is also session-only; `waitlist` has no notes column.
5. Copy `public/logo/logo.png` from the marketing site if it is not already here.
