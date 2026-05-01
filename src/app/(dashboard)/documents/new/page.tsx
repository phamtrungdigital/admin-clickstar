import { PageHeader } from "@/components/dashboard/page-header";
import {
  DocumentUploadForm,
  type CompanyOption,
  type ContractOption,
  type ProjectOption,
} from "@/components/documents/document-upload-form";
import { createClient } from "@/lib/supabase/server";
import { requireInternalPage } from "@/lib/auth/guards";

export const metadata = { title: "Upload tài liệu | Portal.Clickstar.vn" };

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; project?: string; contract?: string }>;
}) {
  await requireInternalPage();
  const sp = await searchParams;
  const [companies, projects, contracts] = await Promise.all([
    loadCompanies(),
    loadProjects(),
    loadContracts(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Upload tài liệu"
        description="Chọn khách hàng, gắn dự án/hợp đồng nếu cần, sau đó upload file lên Storage."
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Tài liệu", href: "/documents" },
          { label: "Upload" },
        ]}
      />
      <DocumentUploadForm
        companies={companies}
        projects={projects}
        contracts={contracts}
        defaultValues={{
          company_id: sp.company ?? "",
          project_id: sp.project ?? null,
          contract_id: sp.contract ?? null,
        }}
      />
    </div>
  );
}

async function loadCompanies(): Promise<CompanyOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");
  return ((data ?? []) as Array<{ id: string; name: string }>).map((r) => ({
    id: r.id,
    name: r.name,
  }));
}

async function loadProjects(): Promise<ProjectOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, company_id")
    .is("deleted_at", null)
    .order("name");
  return ((data ?? []) as Array<{
    id: string;
    name: string;
    company_id: string;
  }>).map((r) => ({ id: r.id, name: r.name, company_id: r.company_id }));
}

async function loadContracts(): Promise<ContractOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contracts")
    .select("id, code, company_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<{
    id: string;
    code: string | null;
    company_id: string;
  }>).map((r) => ({ id: r.id, code: r.code, company_id: r.company_id }));
}
