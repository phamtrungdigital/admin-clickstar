import type { Metadata } from "next";
import {
  BarChart3,
  Globe,
  Headphones,
  MessageCircle,
  ShieldCheck,
  Users,
  Activity,
} from "lucide-react";

import { ClickstarLogo } from "@/components/clickstar-logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Đăng nhập | Admin.Clickstar.vn",
  description:
    "Cổng quản trị vận hành dịch vụ và chăm sóc khách hàng của Clickstar.",
};

const features = [
  {
    icon: Users,
    title: "Quản trị tập trung",
    description:
      "Quản lý khách hàng, hợp đồng, dự án, công việc và tài liệu trên một nền tảng duy nhất.",
  },
  {
    icon: MessageCircle,
    title: "Chăm sóc toàn diện",
    description: "Tương tác & chăm sóc khách hàng qua Email, ZNS, Ticket và Automation.",
  },
  {
    icon: BarChart3,
    title: "Báo cáo thông minh",
    description: "Theo dõi hiệu quả, tiến độ và doanh thu theo thời gian thực.",
  },
  {
    icon: ShieldCheck,
    title: "Bảo mật tuyệt đối",
    description: "Phân quyền chặt chẽ, bảo mật dữ liệu và an toàn thông tin.",
  },
];

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <BrandPanel />
      <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6">
          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Globe className="h-4 w-4 text-slate-500" />
              Tiếng Việt
            </button>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900">Đăng nhập</h1>
            <p className="text-sm text-slate-500">
              Chào mừng bạn quay trở lại Admin.Clickstar.vn
            </p>
          </div>

          <LoginForm />

          <p className="text-center text-xs text-slate-500">
            Bằng cách đăng nhập, bạn đồng ý với{" "}
            <a href="#" className="font-medium text-blue-600 hover:underline">
              Điều khoản sử dụng
            </a>{" "}
            và{" "}
            <a href="#" className="font-medium text-blue-600 hover:underline">
              Chính sách bảo mật
            </a>{" "}
            của Clickstar.
          </p>
        </div>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-blue-600 to-blue-800 text-white lg:flex lg:flex-col lg:px-12 lg:py-10">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col gap-10">
        <ClickstarLogo variant="light" />

        <div className="space-y-4">
          <h2 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Quản trị hiệu quả
            <br />
            Vận hành <span className="text-blue-200">bứt phá</span>
          </h2>
          <div className="h-1 w-16 rounded-full bg-blue-300/80" />
          <p className="max-w-md text-sm leading-relaxed text-blue-50/90">
            Nền tảng quản trị và chăm sóc khách hàng chuyên nghiệp dành cho nội bộ
            Clickstar và khách hàng.
          </p>
        </div>

        <ul className="space-y-3">
          {features.map((f) => (
            <li
              key={f.title}
              className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/20">
                <f.icon className="h-4 w-4" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs leading-relaxed text-blue-50/80">
                  {f.description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-col gap-4 border-t border-white/15 pt-5 text-xs text-blue-50/80 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Clickstar. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Bảo mật dữ liệu
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Hoạt động ổn định
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5" /> Hỗ trợ 24/7
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
