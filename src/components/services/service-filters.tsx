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

const STATUS_OPTIONS = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "active", label: "Đang cung cấp" },
  { value: "paused", label: "Tạm ngưng" },
];

export function ServiceFilters({
  categories,
  hideStatus = false,
}: {
  categories: string[];
  hideStatus?: boolean;
}) {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialStatus = searchParams.get("status") ?? "all";
  const initialCategory = searchParams.get("category") ?? "all";
  return (
    <ServiceFiltersImpl
      key={`${initialQ}|${initialStatus}|${initialCategory}`}
      categories={categories}
      initialQ={initialQ}
      initialStatus={initialStatus}
      initialCategory={initialCategory}
      hideStatus={hideStatus}
    />
  );
}

function ServiceFiltersImpl({
  categories,
  initialQ,
  initialStatus,
  initialCategory,
  hideStatus,
}: {
  categories: string[];
  initialQ: string;
  initialStatus: string;
  initialCategory: string;
  hideStatus: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [category, setCategory] = useState(initialCategory);

  const apply = (next: { q?: string; status?: string | null; category?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    const q = next.q ?? search;
    const s = next.status ?? status;
    const c = next.category ?? category;
    if (q) params.set("q", q);
    else params.delete("q");
    if (s && s !== "all") params.set("status", s);
    else params.delete("status");
    if (c && c !== "all") params.set("category", c);
    else params.delete("category");
    params.delete("page");
    startTransition(() => router.push(`/services?${params.toString()}`));
  };

  const reset = () => {
    setSearch("");
    setStatus("all");
    setCategory("all");
    startTransition(() => router.push("/services"));
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
            placeholder="Tìm theo tên, mã, danh mục..."
            className="pl-9"
          />
        </div>
      </div>
      <div className="sm:w-44">
        <label className="text-xs font-medium text-slate-500">Danh mục</label>
        <Select value={category} onValueChange={(v) => apply({ category: v })}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue>
              {(value: string | null) =>
                !value || value === "all" ? "Tất cả danh mục" : value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả danh mục</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!hideStatus && (
        <div className="sm:w-44">
          <label className="text-xs font-medium text-slate-500">Trạng thái</label>
          <Select value={status} onValueChange={(v) => apply({ status: v })}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue>
                {(value: string | null) =>
                  STATUS_OPTIONS.find((o) => o.value === value)?.label ?? "—"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button type="button" onClick={() => apply({})}>
        Áp dụng
      </Button>
      <Button type="button" variant="outline" onClick={reset}>
        <RotateCcw className="mr-2 h-4 w-4" /> Đặt lại
      </Button>
    </div>
  );
}
