-- 0050_fix_profiles_update_self_recursion.sql
--
-- Bug 2026-05-05: User update profile qua /settings → toast lỗi
-- "infinite recursion detected in policy for relation 'profiles'".
--
-- Root cause: policy profiles_update_self có WITH CHECK chứa subquery
-- `SELECT audience FROM profiles WHERE id = auth.uid()`. Subquery này
-- chạy với user perm (không SECURITY DEFINER), kích hoạt RLS profiles
-- SELECT policies — Postgres detect recursion vì đang trong evaluation
-- của profiles UPDATE policy lại query profiles → fail.
--
-- Intent ban đầu: ngăn user tự đổi audience của mình. Cách fix tốt
-- hơn: dùng BEFORE UPDATE trigger (chạy ngoài policy chain), không
-- phải subquery trong policy.

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Trigger defense-in-depth: ngăn user tự đổi audience của chính mình.
-- auth.uid() trả null khi service_role gọi → trigger bỏ qua, admin có
-- thể đổi audience qua app/SQL nếu thật sự cần.
create or replace function public.prevent_self_audience_change()
returns trigger
language plpgsql
security invoker
as $$
begin
  if auth.uid() = new.id
     and old.audience is distinct from new.audience then
    raise exception 'Không được tự đổi audience của chính mình'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_self_audience_change on public.profiles;
create trigger prevent_self_audience_change
  before update on public.profiles
  for each row execute function public.prevent_self_audience_change();

comment on function public.prevent_self_audience_change is
  'Ngăn user UPDATE chính mình mà đổi audience. Thay thế cho subquery trong WITH CHECK của policy profiles_update_self (gây infinite recursion).';
