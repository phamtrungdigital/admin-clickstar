import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { UserForm } from "@/components/admin/user-form";
import { getUserById } from "@/lib/queries/users";

export const metadata = { title: "Sửa tài khoản | Portal.Clickstar.vn" };

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserById(id).catch(() => null);
  if (!user) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={`Chỉnh sửa: ${user.full_name || "tài khoản"}`}
        breadcrumb={[
          { label: "Trang chủ", href: "/dashboard" },
          { label: "Quản trị hệ thống" },
          { label: "Người dùng", href: "/admin/users" },
          { label: user.full_name || "Chi tiết", href: `/admin/users/${user.id}` },
          { label: "Chỉnh sửa" },
        ]}
      />
      <UserForm
        mode="edit"
        userId={user.id}
        defaultValues={{
          email: user.email ?? "",
          full_name: user.full_name ?? "",
          phone: user.phone ?? "",
          audience: user.audience,
          internal_role: user.internal_role,
          is_active: user.is_active,
          password: "",
        }}
      />
    </div>
  );
}
