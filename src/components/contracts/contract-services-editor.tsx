"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ContractServiceLineInput } from "@/lib/validation/contracts";
import type { ServiceOption } from "@/lib/queries/contracts";

export function ContractServicesEditor({
  services,
  options,
  onChange,
}: {
  services: ContractServiceLineInput[];
  options: ServiceOption[];
  onChange: (next: ContractServiceLineInput[]) => void;
}) {
  const optionsById = useMemo(() => {
    const map = new Map<string, ServiceOption>();
    for (const o of options) map.set(o.id, o);
    return map;
  }, [options]);

  const addRow = () => {
    onChange([
      ...services,
      {
        service_id: "",
        starts_at: "",
        ends_at: "",
        notes: "",
      },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<ContractServiceLineInput>) => {
    const next = [...services];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeRow = (idx: number) => {
    onChange(services.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {services.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
          Chưa có dịch vụ nào trong hợp đồng. Bấm “Thêm dịch vụ” để bắt đầu.
        </div>
      )}

      <div className="space-y-3">
        {services.map((line, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="text-xs font-medium text-slate-500">
                  Dịch vụ
                </Label>
                <Select
                  value={line.service_id || undefined}
                  onValueChange={(v) => {
                    if (!v) return;
                    updateRow(idx, { service_id: v });
                  }}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Chọn dịch vụ">
                      {(value: string | null) => {
                        if (!value) return null;
                        const o = optionsById.get(value);
                        if (!o) return value;
                        return o.category ? `${o.name} · ${o.category}` : o.name;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                        {o.category ? ` · ${o.category}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                aria-label="Xoá dòng"
                className={cn(
                  "inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-slate-500",
                  "hover:bg-rose-50 hover:text-rose-600",
                )}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <Label className="text-xs font-medium text-slate-500">
                  Bắt đầu
                </Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={line.starts_at}
                  onChange={(e) =>
                    updateRow(idx, { starts_at: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-500">
                  Kết thúc
                </Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={line.ends_at}
                  onChange={(e) =>
                    updateRow(idx, { ends_at: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-500">
                  Ghi chú
                </Label>
                <Input
                  className="mt-1"
                  value={line.notes}
                  onChange={(e) => updateRow(idx, { notes: e.target.value })}
                  placeholder="Ghi chú riêng cho dịch vụ này"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addRow}>
        <Plus className="mr-2 h-4 w-4" /> Thêm dịch vụ
      </Button>
    </div>
  );
}
