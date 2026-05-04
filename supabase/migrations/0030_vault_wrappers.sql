-- 0030_vault_wrappers.sql
-- PostgREST chỉ expose function trong schema `public` qua /rpc. Vault
-- functions sống ở schema `vault` — không gọi được trực tiếp từ
-- supabase-js client. Wrap chúng ở public với security definer + grant
-- chỉ service_role để giữ tính bí mật của plaintext secret.

create or replace function public.vault_create_secret(
  new_secret text,
  new_name text default null,
  new_description text default ''
)
returns uuid
language sql
security definer
set search_path = vault, public, pg_temp
as $$
  select vault.create_secret(new_secret, new_name, new_description);
$$;

create or replace function public.vault_update_secret(
  secret_id uuid,
  new_secret text default null,
  new_name text default null,
  new_description text default null
)
returns void
language sql
security definer
set search_path = vault, public, pg_temp
as $$
  select vault.update_secret(secret_id, new_secret, new_name, new_description);
$$;

create or replace function public.vault_delete_secret(secret_id uuid)
returns void
language sql
security definer
set search_path = vault, public, pg_temp
as $$
  delete from vault.secrets where id = secret_id;
$$;

revoke all on function public.vault_create_secret(text, text, text) from public, anon, authenticated;
revoke all on function public.vault_update_secret(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.vault_delete_secret(uuid) from public, anon, authenticated;

grant execute on function public.vault_create_secret(text, text, text) to service_role;
grant execute on function public.vault_update_secret(uuid, text, text, text) to service_role;
grant execute on function public.vault_delete_secret(uuid) to service_role;
