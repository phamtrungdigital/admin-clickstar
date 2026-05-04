-- 0029_ai_integrations.sql
-- Bảng quản lý API keys cho AI providers (Anthropic, OpenAI). Key thật
-- KHÔNG lưu trong cột thường mà đẩy vào supabase_vault — chỉ service-role
-- mới đọc được decrypt; admin UI chỉ thấy mask "sk-•••abc1".
--
-- Flow tạo:
--   1. Server action `createAiIntegrationAction` gọi vault.create_secret(key)
--      → trả về uuid
--   2. Insert row ai_integrations với vault_secret_id = uuid đó
--   3. Khi cần dùng: server lookup `decrypted_secret` từ
--      vault.decrypted_secrets WHERE id = vault_secret_id (service-role)

create table if not exists public.ai_integrations (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null check (provider in ('anthropic', 'openai')),
  /** Model định danh: claude-sonnet-4, claude-haiku, gpt-4o, gpt-4-turbo, ... */
  model           text not null,
  /** UUID trỏ đến vault.secrets — không ai (kể cả admin) đọc plain key. */
  vault_secret_id uuid not null,
  /** Mask hiển thị "sk-•••abc1" để admin nhận diện key trong list mà không
   *  cần decrypt. Lưu khi create + cập nhật khi rotate. */
  key_mask        text not null,
  is_active       boolean not null default true,
  /** Tên gợi nhớ để admin phân biệt nhiều integrations cùng provider
   *  (vd: "Claude Production", "Claude Test"). */
  label           text,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ai_integrations_provider_active_idx
  on public.ai_integrations (provider) where is_active;

drop trigger if exists set_ai_integrations_updated_at on public.ai_integrations;
create trigger set_ai_integrations_updated_at
  before update on public.ai_integrations
  for each row execute function public.set_updated_at();

------------------------------------------------------------------------------
-- RLS: chỉ super_admin / admin
------------------------------------------------------------------------------
alter table public.ai_integrations enable row level security;

drop policy if exists ai_integrations_select_admin on public.ai_integrations;
create policy ai_integrations_select_admin on public.ai_integrations
  for select to authenticated
  using (public.is_internal_admin());

drop policy if exists ai_integrations_modify_admin on public.ai_integrations;
create policy ai_integrations_modify_admin on public.ai_integrations
  for all to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

------------------------------------------------------------------------------
-- Helper: đọc decrypted secret của 1 integration. Security definer, owned
-- by postgres. Caller phải là service_role (server actions / API routes
-- dùng admin client). Internal admin user trên client KHÔNG dùng được —
-- pgsodium key không truy cập được qua role authenticated.
------------------------------------------------------------------------------
create or replace function public.get_ai_integration_secret(integration_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_secret_id uuid;
  v_secret text;
begin
  select vault_secret_id into v_secret_id
  from public.ai_integrations
  where id = integration_id;
  if v_secret_id is null then
    return null;
  end if;
  select decrypted_secret::text into v_secret
  from vault.decrypted_secrets
  where id = v_secret_id;
  return v_secret;
end;
$$;

revoke all on function public.get_ai_integration_secret(uuid) from public, anon, authenticated;
grant execute on function public.get_ai_integration_secret(uuid) to service_role;
