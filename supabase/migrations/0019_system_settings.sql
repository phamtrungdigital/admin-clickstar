-- 0019_system_settings.sql
-- Key-value store for system-wide configuration. Flexible enough to add
-- new settings without a schema change — just insert a new key.
--
-- Read: anyone authenticated (settings affect UI defaults).
-- Write: super_admin only.

create table if not exists public.system_settings (
  key          text primary key,
  value        jsonb not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id) on delete set null
);

drop trigger if exists set_system_settings_updated_at on public.system_settings;
create trigger set_system_settings_updated_at
  before update on public.system_settings
  for each row execute function public.set_updated_at();

alter table public.system_settings enable row level security;

drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select on public.system_settings
  for select to authenticated
  using (true);

drop policy if exists system_settings_modify_super_admin on public.system_settings;
create policy system_settings_modify_super_admin on public.system_settings
  for all to authenticated
  using (public.current_internal_role() = 'super_admin')
  with check (public.current_internal_role() = 'super_admin');

-- Seed defaults — JSON-encoded values so we can store strings, numbers, booleans.
insert into public.system_settings (key, value) values
  ('org.name',              '"Clickstar"'::jsonb),
  ('org.tagline',           '"Giải pháp Digital & Automation toàn diện"'::jsonb),
  ('org.address',           '""'::jsonb),
  ('org.tax_code',          '""'::jsonb),
  ('org.support_email',     '"support@clickstar.vn"'::jsonb),
  ('business.default_vat',  '8'::jsonb),
  ('business.default_currency', '"VND"'::jsonb),
  ('notifications.email_enabled', 'true'::jsonb),
  ('notifications.zns_enabled',   'false'::jsonb)
on conflict (key) do nothing;
