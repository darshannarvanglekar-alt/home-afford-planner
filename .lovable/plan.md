
# HomeAfford — Landing, Auth, Dashboard

Build the foundation of HomeAfford: a clean, trustworthy, mobile-first marketing site with auth and a logged-in dashboard shell.

## Design system
- **Font:** Inter (loaded via Google Fonts in root)
- **Primary:** Indigo `#4F46E5` set as `--primary` in design tokens
- **Style:** White background, soft shadows, rounded-xl cards, smooth hover transitions, subtle indigo accents. Professional, not flashy.
- **Responsive:** Mobile-first; navbar collapses to hamburger on small screens; hero/features/steps stack vertically on mobile.

## Routes

### `/` — Landing page
Single route file with these stacked sections:
1. **Navbar** — "HomeAfford" logo (indigo, bold) left; "Sign In" (outline) + "Start Free" (filled indigo) right. Mobile: hamburger.
2. **Hero** — Pill badge "AI-Powered · India's First Home Affordability Planner", large headline, subheadline, two CTAs (Start Planning / See How It Works), privacy trust line below.
3. **Features** — 3 cards (Cash Flow, Builder Payment, Verdict) with emoji icons, soft shadow, hover lift.
4. **Why HomeAfford** — Heading + 4 checkmark rows.
5. **How It Works** — 3 numbered steps with indigo numbered circles, connecting line on desktop.
6. **Final CTA** — Indigo background block, white heading, white button with indigo text.
7. **Footer** — Logo + tagline, links (Privacy / Terms / Contact), copyright with India flag.

Per-route SEO metadata via `head()`.

### `/auth` — Sign in / Sign up
- Centered card on a soft gradient background, logo at top, heading + subheading.
- **Email + password** form (toggle between Sign In / Sign Up) — primary path with proper error handling and `emailRedirectTo` set to `${window.location.origin}/dashboard`.
- Divider "or continue with".
- Two SSO buttons full-width with brand icons: **Google** and **Apple** (Microsoft omitted — not supported by Lovable Cloud auth; we'll add it if Supabase Integration is connected later).
- Privacy reassurance line at bottom.
- Redirects to `/dashboard` on success; if already signed in, redirects away from `/auth`.

### `/dashboard` — Protected dashboard
- Guarded via TanStack Router `_authenticated` layout: checks Supabase session in `beforeLoad`, redirects to `/auth` if missing.
- **Top navbar:** logo left; right side avatar + first name with dropdown (Profile placeholder, Sign Out).
- **Greeting:** Time-aware "Good morning/afternoon/evening, [First Name] 👋" + subtext.
- **"Start a New Plan" card:** Large, indigo-accented, 🏠 icon, description, "Start New Plan" button (non-functional placeholder for next phase).
- **"My Saved Plans"** section: Queries the `plans` table (will be empty), shows empty-state illustration + message.

## Backend (Lovable Cloud)

Enable Lovable Cloud and configure:

**Auth providers**
- Email + password (enabled, no email confirmation for smoother first-run)
- Google OAuth (enabled)
- Apple OAuth (enabled)
- Leaked password protection (HIBP) enabled

**Database — `profiles` table**
- `id uuid PK` references `auth.users(id)` on delete cascade
- `first_name text`, `last_name text`, `avatar_url text`, `email text`
- `created_at`, `updated_at` timestamps
- RLS: users can select/update only their own row
- Trigger `handle_new_user` on `auth.users` insert: auto-creates a profile row, populating first name + avatar from SSO metadata when present

**Database — `plans` table** (scaffold for next phase)
- `id uuid PK default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `name text not null` (e.g. "3BHK in Whitefield")
- `status text` (draft / complete)
- `verdict text` (safe / stretch / risky / null)
- `data jsonb` (flexible bag for property cost, loan, payment plan, etc.)
- `created_at`, `updated_at`
- RLS: full CRUD restricted to `user_id = auth.uid()`
- Index on `user_id`

## Out of scope (next phases)
- Bank statement upload + parsing
- Plan creation wizard (income, expenses, property, loan, builder schedule)
- Month-by-month cash flow engine and verdict logic
- Profile editing page

