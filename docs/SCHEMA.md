# Database schema — Portal.Clickstar.vn

Source of truth: SQL files in `supabase/migrations/`. This doc explains
**why** the tables and policies are shaped the way they are.

## High-level model

```
auth.users  ─1:1─►  profiles   (audience: internal | customer)
                       │
                       │  customer
                       ▼
                 company_members ─►  companies  ◄─ company_assignments  ◄─ profiles (internal)
                                       │
                                       │ 1:N
                       ┌───────────────┼─────────────────┐
                       ▼               ▼                 ▼
                  contracts         projects          tickets
                       │               │                 │
                       │ N:N           │ 1:N             │ 1:N
                       ▼               ▼                 ▼
                contract_services    tasks         ticket_comments
                       │               │
                       │ 1:N           │ 1:N
                       ▼               ▼
                   services      task_comments

                   documents (FK: company_id, contract_id, project_id, ticket_id)
                   reports   (FK: company_id, contract_id, project_id, document_id)
```

Plus messaging (`email_*`, `zns_*`), `notifications`, `automation_events`, `audit_logs`.

## Why not "users" table?

We use Supabase's managed `auth.users` for auth (password / phone / OTP / OAuth), and add a 1:1 `profiles` table for business identity. This keeps email/password rotation logic inside Supabase Auth and lets us reset/manage users via standard Supabase APIs.

The `audience` column on `profiles` is the **single switch** that flips a user between "internal Clickstar staff" and "customer". An internal user has `internal_role` set; a customer has `internal_role = NULL` and one or more rows in `company_members`.

## Multi-tenancy (the rule customer A can never see customer B's data)

Every customer-facing table carries `company_id`. RLS lets a row through if and only if the current user can access that company:

* **Internal Super Admin / Admin** — sees all (RLS helper returns `null` = wildcard).
* **Other internal staff** — sees only companies in `company_assignments` (per-row helper `current_assigned_companies()`).
* **Customer** — sees only companies in `company_members` (per-row helper `current_customer_companies()`).

The composite helper `accessible_company_ids()` and predicate `can_access_company(uuid)` are reused across every policy. A bug at the helper level would be caught early because every test session that's not internal admin is filtered through the same code path.

## Soft delete

Most tables have `deleted_at`. The app **must** filter `deleted_at IS NULL` in queries; we don't enforce that in RLS to keep policies simpler and to allow admins to undelete.

## Audit columns

Every mutable table has `created_at`, `updated_at`, and most have `created_by`. The `set_updated_at()` trigger (defined in `0001_extensions.sql`) is wired on each table.

## Membership invariants enforced by triggers

* `company_members.user_id` must reference a `profiles.audience = 'customer'`.
* `company_assignments.internal_user_id` must reference a `profiles.audience = 'internal'`.

Triggers `enforce_membership_audience` and `enforce_assignment_audience` raise on violation. This stops a misuse where someone tries to put internal staff into the customer-facing membership join.

## Auth signup flow

`auth.users` insert → trigger `handle_new_user` creates a matching `profiles` row, reading optional `raw_user_meta_data->{audience, internal_role, full_name}`. If audience is `internal` and no role is provided, defaults to `staff`. If the audience is `customer`, `internal_role` is forced to NULL.

The portal does not allow public self-signup; admin staff create users via `supabase.auth.admin.createUser({ user_metadata: { audience: 'customer', full_name: '…' } })` then add them to `company_members`.

## Storage layout

* `documents/companies/<company_id>/<uuid>-<filename>` — gated by `documents` row + RLS on `storage.objects`.
* `avatars/<user_id>/avatar.<ext>` — public bucket, only owner can write.

The Storage RLS policies on the `documents` bucket join `storage.objects.name` against `documents.storage_path`, so a file is only readable if a metadata row exists and the caller has access to its `company_id`. **Always create the `documents` row first, then upload.** Otherwise the file will be unreachable until metadata exists.

## Outbound automation

`automation_events` is an outbox. The app inserts a row when a domain event happens (company created, ticket updated, etc). A worker (n8n's webhook trigger or a separate cron) reads `pending` rows, POSTs to `webhook_url` (or env default), updates `status`/`response_*`/`error_message`, and reschedules `next_retry_at` on failure.

This lets us decouple delivery from the request that triggered it and replay events safely.

## Indexes

We index foreign keys used in RLS predicates, plus filter columns used in list views (`status`, `priority`, `due_at`). Trigram index on `companies.name` for fuzzy search. We do **not** pre-create indexes for every column; add when a slow query shows up.

## Things explicitly NOT in this schema (yet)

* Audit-log triggers — we have the table, but writes happen from the app for now. Trigger-based capture lands in Phase 3 per PRD.
* Materialised views for dashboards — defer until query patterns stabilise.
* Full-text search — `pg_trgm` is enabled for fuzzy match; `tsvector` columns can be added per-table when needed.
* Realtime publications — `supabase_realtime` publication can be added per-table for the live ticket list.
