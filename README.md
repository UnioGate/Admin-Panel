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
    app/admin/settings/page.tsx Admin allowlist + Privy config
    app/api/*                   Route handlers (invites is still a stub)
    app/api/email/inbound/      Resend webhook — the only route not behind requireAdmin()
    components/*                Client halves of the pages above (tables, inbox, drawer, chart)
    lib/admins.ts               The allowlist table — the one source for who is an admin
    lib/auth.ts                 requireAdmin(): verifies the Privy token, looks up the admin
    lib/supabase.ts             Service-role client — server-only, throws if imported client-side
    lib/queries.ts              Every read and write against Supabase
    lib/resend.ts               Resend client + the list of addresses we may send as
    lib/email.ts                Pure address/subject/threading helpers
    lib/email-queries.ts        Reads and writes against `emails`, and thread resolution
    lib/data.ts                 Shared row types
    lib/format.ts               Date/subject helpers — run server-side so hydration matches
    lib/store.tsx               Client state: session notes, admins, toasts
    lib/theme.ts                Design tokens shared with the marketing site
    sql/admins.sql              Migration for the allowlist — run this first, it seeds the Owner
    sql/emails.sql              Migration for the mail store — run by hand, see Email
    proxy.ts                    Cookie gate on /admin (was middleware.ts before Next 16)

Pages are server components: they call `lib/queries.ts` directly and hand rows to a client
child. Writes go through the route handlers, which re-check `requireAdmin()`, then
`router.refresh()` re-runs the server component.

## Data

Five tables in Supabase, read with the service role key (RLS is bypassed, so the key is
server-only and every caller sits behind `requireAdmin()`):

    admins            id, email, name, role, created_at, added_by
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
buttons, and every add, role change and removal is written to `admin_activity`. Two things are
refused outright: removing your own access, and removing or demoting the last Owner — either
would leave a console nobody can administer, recoverable only by editing the table by hand.

`waitlist` has no rank column — position is signup order, computed from `created_at`. The
console only shows what these columns hold; source, wallet and referral data would have to be
captured by the marketing site's signup form first.

## Email

`/admin/email` is a shared mailbox for the addresses on the sending domain: read what comes
in to support@, hello@ and partners@, reply as them, or compose from scratch. Any address on
the domain can be added — `chidile@uniogate.com` is just another entry in `EMAIL_MAILBOXES`.

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
4. **Run `sql/emails.sql`** in the Supabase SQL editor.
5. Fill in `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_DOMAIN` and `EMAIL_MAILBOXES` in
   `.env.local` and restart.

The page states its own status: it says so if Resend is unconfigured or the table is missing,
rather than failing.

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
3. `app/api/invites/route.ts` — send through your transactional provider and record events.
4. Hiding a record is a soft delete — the console sets `hidden_at` and excludes the row from
   stats and exports, but nothing purges it. Add a scheduled job to anonymise after 30 days.
   The record drawer's internal note is also session-only; `waitlist` has no notes column.
5. Copy `public/logo/logo.png` from the marketing site if it is not already here.
