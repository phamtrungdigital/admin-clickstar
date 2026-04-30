-- 0001_extensions.sql
-- Required Postgres extensions for Portal.Clickstar.vn

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- Generic updated_at trigger function reused by every table
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
