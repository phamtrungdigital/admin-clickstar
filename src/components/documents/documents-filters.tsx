"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_KINDS,
  DOCUMENT_VISIBILITIES,
  DOCUMENT_VISIBILITY_LABEL,
} from "@/lib/validation/documents";
import type { DocumentKind, DocumentVisibility } from "@/lib/database.types";
import type { DocumentScope } from "@/lib/queries/documents";

const SCOPE_LABEL: Record<DocumentScope, string> = {
  all: "Tất cả phạm vi",
  internal_only: "Chỉ Nội bộ Clickstar",
  customer: "Theo khách hàng",
};

export function DocumentsFilters({
  search,
  kind,
  visibility,
  scope,
  canManage,
}: {
  search: string;
  kind: DocumentKind | "all";
  visibility: DocumentVisibility | "all";
  scope: DocumentScope;
  canManage: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Keyed by `search` so the input resets to the URL value on navigation
  // without violating the no-setState-in-effect rule.
  const [q, setQ] = useState(search);

  const buildHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "all" || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    const qs = next.toString();
    return qs ? `/documents?${qs}` : "/documents";
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildHref({ q: q.trim() || undefined }));
  };

  const onClear = () => {
    setQ("");
    router.push("/documents");
  };

  const hasFilter =
    q || kind !== "all" || visibility !== "all" || scope !== "all";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <form onSubmit={submitSearch} className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên tài liệu..."
          className="pl-9"
        />
      </form>

      <Select
        value={kind}
        onValueChange={(v) => router.push(buildHref({ kind: v ?? undefined }))}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue>
            {(value: string | null) =>
              !value || value === "all"
                ? "Tất cả loại"
                : DOCUMENT_KIND_LABEL[value as DocumentKind]
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả loại</SelectItem>
          {DOCUMENT_KINDS.map((k) => (
            <SelectItem key={k} value={k}>
              {DOCUMENT_KIND_LABEL[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {canManage && (
        <Select
          value={scope}
          onValueChange={(v) =>
            router.push(buildHref({ scope: v ?? undefined }))
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue>
              {(value: string | null) =>
                !value || value === "all"
                  ? "Tất cả phạm vi"
                  : SCOPE_LABEL[value as DocumentScope]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả phạm vi</SelectItem>
            <SelectItem value="internal_only">Chỉ Nội bộ Clickstar</SelectItem>
            <SelectItem value="customer">Theo khách hàng</SelectItem>
          </SelectContent>
        </Select>
      )}

      {canManage && (
        <Select
          value={visibility}
          onValueChange={(v) =>
            router.push(buildHref({ visibility: v ?? undefined }))
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue>
              {(value: string | null) =>
                !value || value === "all"
                  ? "Tất cả quyền"
                  : DOCUMENT_VISIBILITY_LABEL[value as DocumentVisibility]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả quyền</SelectItem>
            {DOCUMENT_VISIBILITIES.map((v) => (
              <SelectItem key={v} value={v}>
                {DOCUMENT_VISIBILITY_LABEL[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilter && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1.5 h-3.5 w-3.5" /> Xoá lọc
        </Button>
      )}
    </div>
  );
}
