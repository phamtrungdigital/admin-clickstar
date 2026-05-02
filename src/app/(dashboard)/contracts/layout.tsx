import { requireContractAccess } from "@/lib/auth/guards";

/**
 * Page-level guard for /contracts/*. Hợp đồng có thông tin tài chính
 * nhạy cảm (giá trị, VAT) — chỉ super_admin / admin / manager / accountant
 * (và customer xem hợp đồng của họ). Staff / support bị redirect về
 * /dashboard ngay khi gõ URL trực tiếp.
 *
 * Mirrors `ROLES_CONTRACT` ở src/components/dashboard/nav-config.ts.
 */
export default async function ContractsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireContractAccess();
  return <>{children}</>;
}
