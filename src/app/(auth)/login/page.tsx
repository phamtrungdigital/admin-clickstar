import type { Metadata } from "next";
import {
  Activity,
  BarChart3,
  Cpu,
  Globe,
  Headphones,
  Headset,
  Network,
  Settings2,
  Shield,
  ShieldCheck,
} from "lucide-react";

import { ClickstarLogo } from "@/components/clickstar-logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Đăng nhập | Portal.Clickstar.vn",
  description:
    "Cổng quản trị vận hành dịch vụ và chăm sóc khách hàng của Clickstar.",
};

const features = [
  {
    icon: Cpu,
    title: "AI thông minh",
    description: "Ứng dụng trí tuệ nhân tạo để tối ưu vận hành.",
  },
  {
    icon: Network,
    title: "Hệ thống toàn diện",
    description: "Quản trị tập trung, kết nối mọi quy trình.",
  },
  {
    icon: Headset,
    title: "Chăm sóc khách hàng",
    description: "Hỗ trợ nhanh chóng, đa kênh, trải nghiệm vượt trội.",
  },
  {
    icon: BarChart3,
    title: "Báo cáo & phân tích",
    description: "Dữ liệu trực quan, phân tích sâu, ra quyết định chính xác.",
  },
  {
    icon: Shield,
    title: "Bảo mật vượt trội",
    description: "Bảo vệ dữ liệu toàn diện với tiêu chuẩn cao nhất.",
  },
  {
    icon: Settings2,
    title: "Tự động hóa",
    description: "Tối ưu quy trình, tiết kiệm thời gian, nâng cao hiệu suất.",
  },
];

export default function LoginPage() {
  return (
    <div className="grid h-svh lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel />
      <div className="flex flex-col justify-center px-6 py-6 sm:px-10 lg:px-12 lg:py-8">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
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
            <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">Đăng nhập</h1>
            <p className="text-sm text-slate-500">
              Chào mừng bạn quay trở lại Portal.Clickstar.vn
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
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0052CC] via-[#0066E6] to-[#008CFF] text-white lg:flex lg:flex-col lg:px-10 lg:py-7 xl:px-14 xl:py-9">
      {/* dot pattern */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* cyan glow accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-cyan-400/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl"
      />

      <div className="relative z-10 flex flex-1 flex-col gap-5">
        <ClickstarLogo variant="light" size="md" />

        <div className="space-y-3">
          <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            Quản trị hiệu quả
            <br />
            Vận hành <span className="text-cyan-300">bứt phá</span>
          </h2>
          <div className="h-1 w-12 rounded-full bg-cyan-300/80" />
          <p className="max-w-md text-sm leading-relaxed text-blue-50/90">
            Nền tảng quản trị và chăm sóc khách hàng cho nội bộ Clickstar và khách hàng đã ký hợp đồng.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-white/15 pt-4 text-xs text-blue-50/80 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Clickstar. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-3">
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

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/[0.08] p-3.5 backdrop-blur-md transition-colors hover:bg-white/[0.12]">
      <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/25">
        <Icon className="h-4.5 w-4.5 text-cyan-200" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-semibold leading-tight">{title}</p>
      <p className="mt-1 text-[11px] leading-snug text-blue-50/75">
        {description}
      </p>
    </div>
  );
}
