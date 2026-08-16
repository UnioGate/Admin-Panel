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

    app/login/page.tsx          Privy sign-in screen
    app/admin/layout.tsx        Sidebar shell + allowlist guard + providers
    app/admin/page.tsx          Overview (stats, 14-day chart, activity)
    app/admin/waitlist/page.tsx Sortable, paginated, selectable table + record drawer
    app/admin/messages/page.tsx Contact inbox
    app/admin/activity/page.tsx Audit log
    app/admin/settings/page.tsx Admin allowlist + Privy config
    app/api/*                   Route handlers (stubbed — wire to Supabase)
    lib/allowlist.ts            Parses the admin allowlist — the one source for who is an admin
    lib/auth.ts                 requireAdmin(): verifies the Privy token, checks the allowlist
    lib/data.ts                 Types + mock data (replace with real queries)
    lib/store.tsx               Client state: hidden records, notes, activity log, toasts
    lib/theme.ts                Design tokens shared with the marketing site
    proxy.ts                    Cookie gate on /admin (was middleware.ts before Next 16)

## Wiring checklist

1. Replace `lib/data.ts` mocks with Supabase queries in the route handlers.
2. Move the allowlist from the environment into a table. Both readers already go through
   `lib/allowlist.ts`, so swap its source and the guard, `requireAdmin()` and the Settings
   page follow. Adding an admin in Settings is session-only until this lands.
3. `app/api/invites/route.ts` — send through your transactional provider and record events.
4. Hiding a record is a soft delete: set `hidden_at`, exclude from reads, purge/anonymise
   after 30 days with a scheduled job.
5. Copy `public/logo/logo.png` from the marketing site if it is not already here.
