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
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
} from "@/lib/validation/tickets";

export function TicketFilters() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialStatus = searchParams.get("status") ?? "open";
  const initialPriority = searchParams.get("priority") ?? "all";
  return (
    <TicketFiltersImpl
      key={`${initialQ}|${initialStatus}|${initialPriority}`}
      initialQ={initialQ}
      initialStatus={initialStatus}
      initialPriority={initialPriority}
    />
  );
}

function TicketFiltersImpl({
  initialQ,
  initialStatus,
  initialPriority,
}: {
  initialQ: string;
  initialStatus: string;
  initialPriority: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState(initialPriority);

  const apply = (next: {
    q?: string;
    status?: string | null;
    priority?: string | null;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    const q = next.q ?? search;
    const s = next.status ?? status;
    const p = next.priority ?? priority;
    if (q) params.set("q", q);
    else params.delete("q");
    if (s && s !== "all") params.set("status", s);
    else params.delete("status");
    if (p && p !== "all") params.set("priority", p);
    else params.delete("priority");
    params.delete("page");
    startTransition(() => router.push(`/tickets?${params.toString()}`));
  };

  const reset = () => {
    setSearch("");
    setStatus("open");
    setPriority("all");
    startTransition(() => router.push("/tickets"));
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
            placeholder="Tìm theo tiêu đề, mã ticket..."
            className="pl-9"
          />
        </div>
      </div>
      <div className="sm:w-48">
        <label className="text-xs font-medium text-slate-500">Trạng thái</label>
        <Select value={status} onValueChange={(v) => apply({ status: v })}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue>
              {(value: string | null) => {
                if (value === "open") return "Đang mở";
                if (!value || value === "all") return "Tất cả trạng thái";
                return (
                  TICKET_STATUS_OPTIONS.find((o) => o.value === value)?.label ??
                  value
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Đang mở</SelectItem>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {TICKET_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:w-44">
        <label className="text-xs font-medium text-slate-500">Mức ưu tiên</label>
        <Select value={priority} onValueChange={(v) => apply({ priority: v })}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue>
              {(value: string | null) => {
                if (!value || value === "all") return "Tất cả mức";
                return (
                  TICKET_PRIORITY_OPTIONS.find((o) => o.value === value)?.label ??
                  value
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả mức</SelectItem>
            {TICKET_PRIORITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
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
