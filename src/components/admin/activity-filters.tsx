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

const ACTION_OPTIONS = [
  { value: "all", label: "Tất cả hành động" },
  { value: "create", label: "Tạo" },
  { value: "update", label: "Cập nhật" },
  { value: "delete", label: "Xoá" },
  { value: "activate", label: "Kích hoạt" },
  { value: "deactivate", label: "Vô hiệu hoá" },
];

const ENTITY_OPTIONS = [
  { value: "all", label: "Tất cả đối tượng" },
  { value: "profile", label: "Người dùng" },
  { value: "company", label: "Khách hàng" },
  { value: "contract", label: "Hợp đồng" },
  { value: "service", label: "Dịch vụ" },
  { value: "task", label: "Công việc" },
  { value: "ticket", label: "Ticket" },
  { value: "role_permission", label: "Phân quyền" },
];

export function ActivityFilters() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialAction = searchParams.get("action") ?? "all";
  const initialEntity = searchParams.get("entity_type") ?? "all";
  return (
    <ActivityFiltersImpl
      key={`${initialQ}|${initialAction}|${initialEntity}`}
      initialQ={initialQ}
      initialAction={initialAction}
      initialEntity={initialEntity}
    />
  );
}

function ActivityFiltersImpl({
  initialQ,
  initialAction,
  initialEntity,
}: {
  initialQ: string;
  initialAction: string;
  initialEntity: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(initialQ);
  const [action, setAction] = useState(initialAction);
  const [entity, setEntity] = useState(initialEntity);

  const apply = (next: { q?: string; action?: string; entity?: string }) => {
    const p = new URLSearchParams(searchParams.toString());
    const q = next.q ?? search;
    const a = next.action ?? action;
    const e = next.entity ?? entity;
    if (q) p.set("q", q);
    else p.delete("q");
    if (a !== "all") p.set("action", a);
    else p.delete("action");
    if (e !== "all") p.set("entity_type", e);
    else p.delete("entity_type");
    p.delete("page");
    startTransition(() => router.push(`/admin/activity?${p.toString()}`));
  };

  const reset = () => {
    setSearch("");
    setAction("all");
    setEntity("all");
    startTransition(() => router.push("/admin/activity"));
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
            placeholder="Từ khoá hành động hoặc đối tượng..."
            className="pl-9"
          />
        </div>
      </div>
      <div className="sm:w-52">
        <label className="text-xs font-medium text-slate-500">Hành động</label>
        <Select value={action} onValueChange={(v) => apply({ action: v ?? "all" })}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue>
              {(value: string | null) =>
                ACTION_OPTIONS.find((o) => o.value === value)?.label ?? "Tất cả"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:w-52">
        <label className="text-xs font-medium text-slate-500">Đối tượng</label>
        <Select value={entity} onValueChange={(v) => apply({ entity: v ?? "all" })}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue>
              {(value: string | null) =>
                ENTITY_OPTIONS.find((o) => o.value === value)?.label ?? "Tất cả"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ENTITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
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
