"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { forkTemplateAction } from "@/app/(dashboard)/projects/actions";

export type TemplateOption = {
  id: string;
  name: string;
  industry: string | null;
  duration_days: number | null;
  version: number;
};

export type StaffOption = {
  id: string;
  full_name: string;
};

export function ForkTemplateButton({
  contractId,
  contractName,
  templates,
  staff,
}: {
  contractId: string;
  contractName: string;
  templates: TemplateOption[];
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState<string>("");
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [pmId, setPmId] = useState<string>("");

  const onTemplateChange = (id: string | null) => {
    if (!id) return;
    setTemplateId(id);
    if (!name) {
      const t = templates.find((x) => x.id === id);
      if (t) setName(`${t.name} — ${contractName}`);
    }
  };

  const onSubmit = () => {
    if (!templateId) {
      toast.error("Chọn template");
      return;
    }
    startTransition(async () => {
      const result = await forkTemplateAction({
        contract_id: contractId,
        template_id: templateId,
        name,
        starts_at: startsAt,
        pm_id: pmId || null,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã tạo dự án từ template");
      setOpen(false);
      router.refresh();
      if (result.data?.id) {
        router.push(`/projects/${result.data.id}`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="px-4"
          >
            <Plus className="mr-2 h-4 w-4" />
            Tạo dự án từ template
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo dự án từ template</DialogTitle>
          <DialogDescription>
            Hệ thống fork template (clone độc lập) thành dự án mới của hợp
            đồng này — milestones + tasks + checklist được tạo sẵn theo offset
            đã định trong template.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium text-slate-700">Template *</Label>
            <Select value={templateId} onValueChange={onTemplateChange}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue placeholder="Chọn template">
                  {(value: string | null) => {
                    if (!value) return null;
                    const t = templates.find((x) => x.id === value);
                    return t
                      ? `${t.name}${t.industry ? ` · ${t.industry}` : ""} · v${t.version}`
                      : value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 && (
                  <SelectItem value="empty" disabled>
                    Chưa có template nào đang dùng
                  </SelectItem>
                )}
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.industry ? ` · ${t.industry}` : ""} · v{t.version}
                    {t.duration_days ? ` · ${t.duration_days}d` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">Tên dự án *</Label>
            <Input
              className="mt-1.5"
              placeholder="VD: SEO website abc.com"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-sm font-medium text-slate-700">Ngày bắt đầu *</Label>
              <Input
                className="mt-1.5"
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">PM phụ trách</Label>
              <Select
                value={pmId || "none"}
                onValueChange={(v) => setPmId(!v || v === "none" ? "" : v)}
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue placeholder="(chưa gán)">
                    {(value: string | null) => {
                      if (!value || value === "none") return "(chưa gán)";
                      const p = staff.find((s) => s.id === value);
                      return p?.full_name ?? value;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(chưa gán)</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isPending || !templateId || !name.trim()}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tạo dự án
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
