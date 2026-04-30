import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Cài đặt | Portal.Clickstar.vn" };

export default function Page() {
  return (
    <ComingSoon
      title="Cài đặt cá nhân"
      description="Hồ sơ, mật khẩu, thông báo, ngôn ngữ."
      breadcrumb={[{ label: "Trang chủ", href: "/dashboard" }, { label: "Cài đặt" }]}
      phase="2"
    />
  );
}
