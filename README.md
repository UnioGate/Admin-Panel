# UnioGate Admin

Next.js (App Router) console for the UnioGate waitlist and contact inbox. Auth is Privy; only
allowlisted emails/wallets can open it.

## Run

    npm install
    cp .env.example .env.local   # Privy app id/secret + the admin allowlist
    npm run dev

Nobody can open the console until you are on the allowlist. Set `ADMIN_ALLOWLIST` and
`NEXT_PUBLIC_ADMIN_ALLOWLIST` to the same value and restart — env changes are not
hot-reloaded. An unset allowlist admits nobody rather than falling back to a default.

## Structure

    app/login/page.tsx          Sign-in screen — our own UI on Privy's headless hooks
    app/providers.tsx           PrivyProvider config (the modal is unused)
    app/admin/layout.tsx        Sidebar shell + allowlist guard + providers
    app/admin/page.tsx          Overview (stats, 14-day chart, activity)
    app/admin/waitlist/page.tsx Sortable, paginated, selectable table + record drawer
    app/admin/messages/page.tsx Contact inbox
    app/admin/activity/page.tsx Audit log
    app/admin/settings/page.tsx Admin allowlist + Privy config
    app/api/*                   Route handlers (invites is still a stub)
    components/*                Client halves of the pages above (tables, inbox, drawer, chart)
    lib/allowlist.ts            Parses the admin allowlist — the one source for who is an admin
    lib/auth.ts                 requireAdmin(): verifies the Privy token, checks the allowlist
    lib/supabase.ts             Service-role client — server-only, throws if imported client-side
    lib/queries.ts              Every read and write against Supabase
    lib/data.ts                 Shared row types
    lib/format.ts               Date/subject helpers — run server-side so hydration matches
    lib/store.tsx               Client state: session notes, admins, toasts
    lib/theme.ts                Design tokens shared with the marketing site
    proxy.ts                    Cookie gate on /admin (was middleware.ts before Next 16)

Pages are server components: they call `lib/queries.ts` directly and hand rows to a client
child. Writes go through the route handlers, which re-check `requireAdmin()`, then
`router.refresh()` re-runs the server component.

## Data

Three tables in Supabase, read with the service role key (RLS is bypassed, so the key is
server-only and every caller sits behind `requireAdmin()`):

    waitlist          id, email, created_at, unsubscribed, hidden_at
    contact_messages  id, created_at, name, email, message, topic, business, volume,
                      status, handled_at, notes
    admin_activity    id, created_at, actor, action, target, kind

`contact_messages.status` is pinned by a check constraint
(`contact_messages_status_vals`) to `new | in_progress | replied | spam`. `MESSAGE_STATUSES`
in `lib/data.ts` mirrors it — change one and you must change the other, or writes fail with
`23514`. `handled_at` is set for the terminal states only.

Deleting an enquiry is Owner only and permanent — there is no soft delete for
`contact_messages` as there is for waitlist rows. The role comes from the server-only
allowlist, so `app/api/messages/route.ts` enforces it; hiding the button is only a courtesy.

`waitlist` has no rank column — position is signup order, computed from `created_at`. The
console only shows what these columns hold; source, wallet and referral data would have to be
captured by the marketing site's signup form first.

## Wiring checklist

1. ~~Replace the mocks with Supabase queries.~~ Done.
2. Move the allowlist from the environment into a table. Both readers already go through
   `lib/allowlist.ts`, so swap its source and the guard, `requireAdmin()` and the Settings
   page follow. Adding an admin in Settings is session-only until this lands.
3. `app/api/invites/route.ts` — send through your transactional provider and record events.
4. Hiding a record is a soft delete — the console sets `hidden_at` and excludes the row from
   stats and exports, but nothing purges it. Add a scheduled job to anonymise after 30 days.
   The record drawer's internal note is also session-only; `waitlist` has no notes column.
5. Copy `public/logo/logo.png` from the marketing site if it is not already here.
