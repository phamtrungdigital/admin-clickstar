-- 0013_services_pricing.sql
-- Add pricing + billing-cycle metadata to the service catalog so the
-- /services UI can show "Giá (VND)" and "Chu kỳ" columns directly.
-- Defaults are zero-priced + null cycle so existing rows survive.

alter table public.services
  add column if not exists default_price numeric(14,2) not null default 0,
  add column if not exists billing_cycle text;

comment on column public.services.default_price is 'Suggested price in VND used as the default when this service is added to a contract.';
comment on column public.services.billing_cycle is 'Free-text cycle label, e.g. "1 lần", "Hàng tháng", "Hàng quý", "Hàng năm". Stored as text to allow flexibility per service.';

create index if not exists services_billing_cycle_idx on public.services (billing_cycle) where is_active;
