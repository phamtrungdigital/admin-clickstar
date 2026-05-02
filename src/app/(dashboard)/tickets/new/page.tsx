import { redirect } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { TicketForm } from "@/components/tickets/ticket-form";
import { listActiveCompaniesForSelect } from "@/lib/queries/contracts";
import { listInternalStaff } from "@/lib/queries/customers";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Thêm ticket | Portal.Clickstar.vn" };

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const sp = await searchParams;
  const { profile } = await getCurrentUser();
  if (!profile) redirect("/login");
  // Note: avoid `!isInternal(profile)` here — TS narrows the negation of a
  // type predicate to `never` (since profile is already known non-null),
  // breaking later property access. Use the audience field directly.
  const isCustomerCaller = profile.audience === "customer";

  // Customer flow: chỉ load company của KH (qua company_members) — server
  // ép company_id ở action layer; ở đây chỉ cần ID để pre-fill hidden input.
  if (isCustomerCaller) {
    const supabase = await createClient();
    const { data: membership } = await supabase
      .from("company_members")
      .select(
        "company_id, company:companies!company_members_company_id_fkey ( id, name, code )",
      )
      .eq("user_id", profile.id)
      .limit(1)
      .maybeSingle();
    const company =
      (
        membership as
          | {
              company?:
                | { id: string; name: string; code: string | null }
                | null;
            }
          | null
      )?.company ?? null;
    if (!company) {
      redirect("/dashboard");
    }

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="Tạo ticket hỗ trợ"
          description="Mô tả vấn đề bạn đang gặp. Đội Clickstar sẽ phản hồi sớm nhất có thể."
          breadcrumb={[
            { label: "Trang chủ", href: "/dashboard" },
            { label: "Ticket", href: "/tickets" },
            { label: "Tạo ticket" },
          ]}
        />
        <TicketForm
          mode="create"
          companies={[company]}
          staff={[]}
          audience="customer"
          defaultValues={{ company_id: company.id }}
        />
      </div>
    );
  }

  // Internal flow: full form như cũ.
  const [companies, staff] = await Promise.all([
    listActiveCompaniesForSelect().catch(() => []),
    listInternalStaff().catch(() => []),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Thêm ticket"
        description="Ghi nhận yêu cầu hỗ trợ mới từ khách hàng."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Ticket", href: "/tickets" },
          { label: "Thêm ticket" },
        ]}
      />
      <TicketForm
        mode="create"
        companies={companies}
        staff={staff}
        audience="internal"
        defaultValues={sp.company ? { company_id: sp.company } : undefined}
      />
    </div>
  );
}
