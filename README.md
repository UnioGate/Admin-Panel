# UnioGate Admin

Next.js (App Router) console for the UnioGate waitlist and contact inbox. Auth is Privy; only
allowlisted emails/wallets can open it.

## Run

    npm install
    cp .env.example .env.local   # fill in NEXT_PUBLIC_PRIVY_APP_ID + PRIVY_APP_SECRET
    npm run dev

## Structure

    app/login/page.tsx          Privy sign-in screen
    app/admin/layout.tsx        Sidebar shell + allowlist guard + providers
    app/admin/page.tsx          Overview (stats, 14-day chart, activity)
    app/admin/waitlist/page.tsx Sortable, paginated, selectable table + record drawer
    app/admin/messages/page.tsx Contact inbox
    app/admin/activity/page.tsx Audit log
    app/admin/settings/page.tsx Admin allowlist + Privy config
    app/api/*                   Route handlers (stubbed — wire to Supabase)
    lib/data.ts                 Types + mock data (replace with real queries)
    lib/store.tsx               Client state: hidden records, notes, activity log, toasts
    lib/theme.ts                Design tokens shared with the marketing site
    middleware.ts               Cookie gate on /admin

## Wiring checklist

1. Replace `lib/data.ts` mocks with Supabase queries in the route handlers.
2. Move the allowlist out of `lib/data.ts` into a table; `middleware.ts` and
   `components/AuthGuard.tsx` both read it.
3. `app/api/invites/route.ts` — send through your transactional provider and record events.
4. Hiding a record is a soft delete: set `hidden_at`, exclude from reads, purge/anonymise
   after 30 days with a scheduled job.
5. Copy `public/logo/logo.png` from the marketing site if it is not already here.
