"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUDIENCE_OPTIONS,
  INTERNAL_ROLE_OPTIONS,
} from "@/lib/validation/users";

export function UserFilters() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialAudience = searchParams.get("audience") ?? "all";
  const initialRole = searchParams.get("role") ?? "all";
  const initialActive = searchParams.get("active") ?? "active";
  return (
    <UserFiltersImpl
      key={`${initialQ}|${initialAudience}|${initialRole}|${initialActive}`}
      initialQ={initialQ}
      initialAudience={initialAudience}
      initialRole={initialRole}
      initialActive={initialActive}
    />
  );
}

function UserFiltersImpl({
  initialQ,
  initialAudience,
  initialRole,
  initialActive,
}: {
  initialQ: string;
  initialAudience: string;
  initialRole: string;
  initialActive: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(initialQ);
  const [audience, setAudience] = useState(initialAudience);
  const [role, setRole] = useState(initialRole);
  const [active, setActive] = useState(initialActive);

  const apply = (next: {
    q?: string;
    audience?: string;
    role?: string;
    active?: string;
  }) => {
    const p = new URLSearchParams(searchParams.toString());
    const q = next.q ?? search;
    const a = next.audience ?? audience;
    const r = next.role ?? role;
    const ac = next.active ?? active;
    if (q) p.set("q", q);
    else p.delete("q");
    if (a !== "all") p.set("audience", a);
    else p.delete("audience");
    if (r !== "all") p.set("role", r);
    else p.delete("role");
    if (ac !== "active") p.set("active", ac);
    else p.delete("active");
    p.delete("page");
    startTransition(() => router.push(`/admin/users?${p.toString()}`));
  };

  const reset = () => {
    setSearch("");
    setAudience("all");
    setRole("all");
    setActive("active");
    startTransition(() => router.push("/admin/users"));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="text-xs font-medium text-slate-500">Tìm kiếm</label>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply({});
            }}
            placeholder="Tìm theo tên..."
            className="pl-9"
          />
        </div>
      </div>
      <div className="sm:w-44">
        <label className="text-xs font-medium text-slate-500">Đối tượng</label>
        <Select value={audience} onValueChange={(v) => apply({ audience: v ?? "all" })}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue>
              {(value: string | null) => {
                if (!value || value === "all") return "Tất cả";
                return (
                  AUDIENCE_OPTIONS.find((o) => o.value === value)?.label ?? value
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {AUDIENCE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:w-52">
        <label className="text-xs font-medium text-slate-500">Vai trò</label>
        <Select value={role} onValueChange={(v) => apply({ role: v ?? "all" })}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue>
              {(value: string | null) => {
                if (!value || value === "all") return "Tất cả vai trò";
                return (
                  INTERNAL_ROLE_OPTIONS.find((o) => o.value === value)?.label ??
                  value
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả vai trò</SelectItem>
            {INTERNAL_ROLE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:w-44">
        <label className="text-xs font-medium text-slate-500">Trạng thái</label>
        <Select value={active} onValueChange={(v) => apply({ active: v ?? "active" })}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue>
              {(value: string | null) => {
                if (value === "active") return "Đang hoạt động";
                if (value === "inactive") return "Đã vô hiệu hoá";
                return "Tất cả";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Đang hoạt động</SelectItem>
            <SelectItem value="inactive">Đã vô hiệu hoá</SelectItem>
            <SelectItem value="all">Tất cả</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="button" onClick={() => apply({})}>
        Áp dụng
      </Button>
      <Button type="button" variant="outline" onClick={reset}>
        <RotateCcw className="mr-2 h-4 w-4" /> Đặt lại
      </Button>
    </div>
  );
}
