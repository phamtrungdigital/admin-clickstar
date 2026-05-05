-- 0049_company_soft_delete_cascade.sql
--
-- Anh chốt 2026-05-05: khi soft-delete 1 KH (companies.deleted_at gán
-- timestamp), TẤT CẢ entity con của KH đó cũng phải bị soft-delete để
-- không xuất hiện mồ côi trong list (project/ticket không còn KH liên
-- quan thì vô nghĩa).
--
-- Áp dụng qua trigger AFTER UPDATE thay vì sửa application code: đảm
-- bảo cascade dù xoá qua đâu (UI, SQL admin, future API). 1 timestamp
-- duy nhất cho toàn bộ children → audit + restore consistent.
--
-- Phạm vi cascade: projects, tasks, tickets, contracts, documents.
-- KHÔNG cascade: company_members/assignments/services (join table, sẽ
-- bị xoá orphaned qua cleanup riêng nếu cần). milestones cascade gián
-- tiếp qua projects: app code đã filter milestones theo project hợp lệ.
--
-- Restore: trigger chỉ xử lý chiều xoá. Nếu admin un-delete KH (set
-- deleted_at=null), children không tự restore — cần UI dialog riêng
-- hỏi xem có muốn restore không.

create or replace function public.cascade_company_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  -- Chỉ trigger khi deleted_at chuyển từ NULL → có giá trị (không
  -- trigger khi update các field khác hoặc khi đã deleted rồi).
  if (old.deleted_at is null and new.deleted_at is not null) then
    update public.projects
      set deleted_at = new.deleted_at
      where company_id = new.id and deleted_at is null;

    update public.tasks
      set deleted_at = new.deleted_at
      where company_id = new.id and deleted_at is null;

    update public.tickets
      set deleted_at = new.deleted_at
      where company_id = new.id and deleted_at is null;

    update public.contracts
      set deleted_at = new.deleted_at
      where company_id = new.id and deleted_at is null;

    update public.documents
      set deleted_at = new.deleted_at
      where company_id = new.id and deleted_at is null;
  end if;
  return new;
end;
$function$;

drop trigger if exists cascade_soft_delete_on_companies on public.companies;
create trigger cascade_soft_delete_on_companies
  after update of deleted_at on public.companies
  for each row execute function public.cascade_company_soft_delete();

comment on function public.cascade_company_soft_delete is
  'Khi companies.deleted_at gán → cascade soft-delete projects/tasks/tickets/contracts/documents của KH đó. Chỉ chạy khi deleted_at chuyển từ NULL → NOT NULL.';
