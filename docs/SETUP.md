# Setup — Portal.Clickstar.vn

## Prerequisites

* Node.js 24.x (see `package.json` engines if added)
* npm 11.x
* A Supabase project — currently `kdzorsvjefcmmtefvbrx`
* Vercel CLI for env management (optional, you can also use the dashboard)

## 1. Local install

```bash
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY at minimum.
npm run dev
```

The app expects port 3003 by default (see `.claude/launch.json` at workspace root).

## 2. Run the database migrations

> Order matters. Run them in numeric order. Each file is idempotent (uses `IF NOT EXISTS` / `OR REPLACE`) so re-running is safe, but you should still apply them once each in sequence.

### Option A — Supabase SQL Editor (recommended for first-time setup)

1. Open https://supabase.com/dashboard/project/kdzorsvjefcmmtefvbrx/sql/new
2. For each file in `supabase/migrations/` (alphabetical = numeric order):
   * Copy the entire file contents.
   * Paste into the SQL Editor.
   * Click **Run**.
   * Confirm "Success. No rows returned" or the row count of created objects.
3. After all files run, sanity-check:

   ```sql
   select schemaname, tablename, rowsecurity
   from pg_tables
   where schemaname = 'public'
   order by tablename;
   ```

   Every table should have `rowsecurity = true`.

### Option B — Supabase CLI

```bash
# one-time
brew install supabase/tap/supabase
supabase login

# from repo root
supabase link --project-ref kdzorsvjefcmmtefvbrx
supabase db push
```

The CLI applies files from `supabase/migrations/` in order and tracks state. **Don't mix Option A and Option B** for the same project — pick one and stick with it. If you've used Option A first, you'll need to populate `supabase_migrations.schema_migrations` manually before switching to the CLI.

## 3. Required env vars

| Var | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | All envs | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All envs | Public key for browser + server clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (Production / Preview) | Bypasses RLS — only for trusted server actions (admin user create, automation worker) |
| `RESEND_API_KEY` | Server only | Phase 2 (email) |
| `RESEND_FROM_EMAIL` | Server only | Default `From:` |
| `ZNS_API_BASE_URL`, `ZNS_API_KEY`, `ZNS_OA_ID` | Server only | Phase 3 (ZNS) |
| `N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_SECRET` | Server only | Phase 3 (automation) |
| `NEXT_PUBLIC_APP_URL` | All envs | Used in email templates and OAuth redirects |

Never check `.env.local` into git. Vercel CLI:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production --value "$URL" --yes --scope=trungstphams-projects
vercel env add NEXT_PUBLIC_SUPABASE_URL preview dev --value "$URL" --yes --scope=trungstphams-projects
vercel env add NEXT_PUBLIC_SUPABASE_URL development --value "$URL" --yes --scope=trungstphams-projects
```

## 4. Bootstrap the first super admin

After migrations succeed, create the first internal user. This must be done by hand because RLS prevents anyone from seeing the empty profile table without an existing internal admin to vouch for them.

In Supabase Dashboard → Authentication → Users → **Add user** → fill email + password → check "Auto Confirm User". Then in SQL Editor:

```sql
update public.profiles
set audience = 'internal',
    internal_role = 'super_admin',
    full_name = 'Pham Trung'
where id = (select id from auth.users where email = 'you@clickstar.vn');
```

From there, every subsequent user (internal or customer) can be created from the app's user-management UI (Phase B+).

## 5. Verifying RLS

After bootstrap, log in as the super admin and run:

```sql
-- Should return your profile id
select public.auth_user_id();

-- Should return true
select public.is_super_admin();

-- Should return null (wildcard = all companies)
select public.accessible_company_ids();
```

Then create a customer user, log in as them, and confirm the same queries return their `company_members` companies (not null).

## 6. Branch / deploy workflow

* **`dev`** is the default working branch. All feature work commits here.
* Vercel auto-deploys every `dev` push to a Preview URL.
* Once a preview is verified, merge `dev` → `main`. **Never push directly to `main`.**
* Production (`portal.clickstar.vn`) follows `main`.

`vercel.json` pins `framework=nextjs` + `regions=sin1`. Do not remove.

## 7. Useful commands

```bash
npm run dev           # dev server on port 3003
npm run build         # production build
npm run lint
git checkout dev      # ALWAYS work here

# When env vars change, redeploy preview to pick them up
vercel redeploy <url> --scope=trungstphams-projects
```
