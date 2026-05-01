"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  Flag,
  ListChecks,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  deleteChecklistItemAction,
  deleteMilestoneAction,
  deleteTemplateTaskAction,
  upsertChecklistItemAction,
  upsertMilestoneAction,
  upsertTemplateTaskAction,
} from "@/app/(dashboard)/templates/actions";
import type { TemplateDetail } from "@/lib/queries/templates";

type Milestone = TemplateDetail["milestones"][number];
type Task = TemplateDetail["tasks"][number];
type ChecklistItem = Task["checklist"][number];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
  { value: "urgent", label: "Khẩn cấp" },
] as const;

export function TemplateEditor({
  template,
  canManage,
}: {
  template: TemplateDetail;
  canManage: boolean;
}) {
  return (
    <div className="space-y-6">
      <MilestonesSection template={template} canManage={canManage} />
      <TasksSection template={template} canManage={canManage} />
    </div>
  );
}

// ---------- Milestones ----------

function MilestonesSection({
  template,
  canManage,
}: {
  template: TemplateDetail;
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            <Flag className="mr-1.5 inline h-4 w-4 text-blue-600" />
            Milestones ({template.milestones.length})
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Cột mốc lớn để khách theo dõi (PRD §5).
          </p>
        </div>
        {canManage && !adding && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAdding(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Thêm milestone
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {template.milestones.map((m) => (
          <MilestoneRow
            key={m.id}
            templateId={template.id}
            milestone={m}
            canManage={canManage}
            templateDuration={template.duration_days ?? 30}
          />
        ))}
        {adding && canManage && (
          <MilestoneEditor
            templateId={template.id}
            templateDuration={template.duration_days ?? 30}
            sortOrder={template.milestones.length}
            onClose={() => setAdding(false)}
          />
        )}
        {template.milestones.length === 0 && !adding && (
          <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
            Chưa có milestone nào.{" "}
            {canManage ? "Bấm \"Thêm milestone\" để bắt đầu." : ""}
          </p>
        )}
      </div>
    </section>
  );
}

function MilestoneRow({
  templateId,
  milestone,
  canManage,
  templateDuration,
}: {
  templateId: string;
  milestone: Milestone;
  canManage: boolean;
  templateDuration: number;
}) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <MilestoneEditor
        templateId={templateId}
        milestone={milestone}
        templateDuration={templateDuration}
        sortOrder={milestone.sort_order}
        onClose={() => setEditing(false)}
      />
    );
  }

  const onDelete = () => {
    if (!window.confirm(`Xoá milestone "${milestone.title}"?`)) return;
    startTransition(async () => {
      const r = await deleteMilestoneAction(templateId, milestone.id);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Đã xoá milestone");
      router.refresh();
    });
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {milestone.code && (
            <span className="font-mono text-xs text-slate-500">
              {milestone.code}
            </span>
          )}
          <span className="text-sm font-semibold text-slate-900">
            {milestone.title}
          </span>
          {milestone.deliverable_required && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
              Có deliverable
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Bắt đầu ngày {milestone.offset_start_days} → kết thúc ngày{" "}
          {milestone.offset_end_days}
          {milestone.description && ` · ${milestone.description}`}
        </p>
      </div>
      {canManage && (
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            disabled={isPending}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={isPending}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function MilestoneEditor({
  templateId,
  milestone,
  sortOrder,
  templateDuration,
  onClose,
}: {
  templateId: string;
  milestone?: Milestone;
  sortOrder: number;
  templateDuration: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState(milestone?.code ?? "");
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [offsetStart, setOffsetStart] = useState(
    milestone?.offset_start_days ?? 0,
  );
  const [offsetEnd, setOffsetEnd] = useState(
    milestone?.offset_end_days ?? Math.min(30, templateDuration),
  );
  const [deliverable, setDeliverable] = useState(
    milestone?.deliverable_required ?? false,
  );

  const onSave = () => {
    startTransition(async () => {
      const r = await upsertMilestoneAction(templateId, {
        id: milestone?.id,
        code,
        title,
        description,
        sort_order: sortOrder,
        offset_start_days: offsetStart,
        offset_end_days: offsetEnd,
        deliverable_required: deliverable,
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(milestone ? "Đã cập nhật milestone" : "Đã thêm milestone");
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <div className="grid gap-3 md:grid-cols-12">
        <div className="md:col-span-2">
          <Label className="text-xs text-slate-500">Mã</Label>
          <Input
            className="mt-1"
            placeholder="M1"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="md:col-span-10">
          <Label className="text-xs text-slate-500">Tiêu đề *</Label>
          <Input
            className="mt-1"
            placeholder="VD: Audit Website"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <Label className="text-xs text-slate-500">Bắt đầu (ngày thứ)</Label>
          <Input
            className="mt-1"
            type="number"
            min={0}
            max={3650}
            value={offsetStart}
            onChange={(e) => setOffsetStart(e.target.valueAsNumber || 0)}
          />
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs text-slate-500">Kết thúc (ngày thứ)</Label>
          <Input
            className="mt-1"
            type="number"
            min={0}
            max={3650}
            value={offsetEnd}
            onChange={(e) => setOffsetEnd(e.target.valueAsNumber || 0)}
          />
        </div>
        <div className="flex items-center gap-2 md:col-span-6">
          <Checkbox
            id={`del-${milestone?.id ?? "new"}`}
            checked={deliverable}
            onCheckedChange={(c) => setDeliverable(c === true)}
          />
          <Label
            htmlFor={`del-${milestone?.id ?? "new"}`}
            className="text-sm text-slate-700"
          >
            Có sản phẩm bàn giao (deliverable)
          </Label>
        </div>
      </div>
      <div>
        <Label className="text-xs text-slate-500">Mô tả</Label>
        <Textarea
          className="mt-1"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          <X className="mr-1 h-3 w-3" /> Huỷ
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={isPending || !title.trim()}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Check className="mr-1 h-3 w-3" /> Lưu
        </Button>
      </div>
    </div>
  );
}

// ---------- Tasks ----------

function TasksSection({
  template,
  canManage,
}: {
  template: TemplateDetail;
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  // Group tasks by milestone
  const grouped = new Map<string | null, Task[]>();
  for (const t of template.tasks) {
    const key = t.template_milestone_id;
    const arr = grouped.get(key) ?? [];
    arr.push(t);
    grouped.set(key, arr);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            <ListChecks className="mr-1.5 inline h-4 w-4 text-blue-600" />
            Tasks ({template.tasks.length})
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Đơn vị thực thi nhỏ nhất, có offset deadline tính từ ngày bắt đầu.
          </p>
        </div>
        {canManage && !adding && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAdding(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Thêm task
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {template.milestones.map((m) => {
          const tasks = grouped.get(m.id) ?? [];
          return (
            <TaskGroup
              key={m.id}
              templateId={template.id}
              groupLabel={`${m.code ? `${m.code} · ` : ""}${m.title}`}
              tasks={tasks}
              milestones={template.milestones}
              canManage={canManage}
            />
          );
        })}
        <TaskGroup
          templateId={template.id}
          groupLabel="Chưa gán milestone"
          tasks={grouped.get(null) ?? []}
          milestones={template.milestones}
          canManage={canManage}
          dimWhenEmpty
        />

        {adding && canManage && (
          <TaskEditor
            templateId={template.id}
            milestones={template.milestones}
            sortOrder={template.tasks.length}
            onClose={() => setAdding(false)}
          />
        )}
        {template.tasks.length === 0 && !adding && (
          <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
            Chưa có task nào.{" "}
            {canManage ? "Bấm \"Thêm task\" để bắt đầu." : ""}
          </p>
        )}
      </div>
    </section>
  );
}

function TaskGroup({
  templateId,
  groupLabel,
  tasks,
  milestones,
  canManage,
  dimWhenEmpty,
}: {
  templateId: string;
  groupLabel: string;
  tasks: Task[];
  milestones: Milestone[];
  canManage: boolean;
  dimWhenEmpty?: boolean;
}) {
  if (tasks.length === 0 && dimWhenEmpty) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {groupLabel}
      </p>
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            templateId={templateId}
            task={t}
            milestones={milestones}
            canManage={canManage}
          />
        ))}
        {tasks.length === 0 && (
          <p className="text-xs italic text-slate-400">Chưa có task</p>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  templateId,
  task,
  milestones,
  canManage,
}: {
  templateId: string;
  task: Task;
  milestones: Milestone[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <TaskEditor
        templateId={templateId}
        task={task}
        milestones={milestones}
        sortOrder={task.sort_order}
        onClose={() => setEditing(false)}
      />
    );
  }

  const onDelete = () => {
    if (!window.confirm(`Xoá task "${task.title}"?`)) return;
    startTransition(async () => {
      const r = await deleteTemplateTaskAction(templateId, task.id);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Đã xoá task");
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start gap-3 p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-900">
              {task.title}
            </span>
            <PriorityBadge value={task.priority} />
            {task.is_visible_to_customer ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <Eye className="h-2.5 w-2.5" /> KH thấy
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                <EyeOff className="h-2.5 w-2.5" /> Nội bộ
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Bắt đầu ngày {task.offset_days} · Kéo dài {task.duration_days} ngày
            {task.default_role && ` · Vai trò: ${task.default_role}`}
            {task.checklist.length > 0 &&
              ` · ${task.checklist.length} checklist items`}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
          {canManage && (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
                disabled={isPending}
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onDelete}
                disabled={isPending}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/40 p-3">
          {task.description && (
            <p className="mb-3 text-xs text-slate-600">{task.description}</p>
          )}
          <ChecklistEditor
            templateId={templateId}
            taskId={task.id}
            items={task.checklist}
            canManage={canManage}
          />
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ value }: { value: Task["priority"] }) {
  const tone =
    value === "urgent"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : value === "high"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : value === "low"
          ? "bg-slate-100 text-slate-600 ring-slate-200"
          : "bg-blue-50 text-blue-700 ring-blue-200";
  const label = PRIORITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        tone,
      )}
    >
      {label}
    </span>
  );
}

function TaskEditor({
  templateId,
  task,
  milestones,
  sortOrder,
  onClose,
}: {
  templateId: string;
  task?: Task;
  milestones: Milestone[];
  sortOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [milestoneId, setMilestoneId] = useState<string | null>(
    task?.template_milestone_id ?? null,
  );
  const [defaultRole, setDefaultRole] = useState(task?.default_role ?? "");
  const [offsetDays, setOffsetDays] = useState(task?.offset_days ?? 0);
  const [duration, setDuration] = useState(task?.duration_days ?? 1);
  const [priority, setPriority] = useState(task?.priority ?? "medium");
  const [visible, setVisible] = useState(task?.is_visible_to_customer ?? false);

  const onSave = () => {
    startTransition(async () => {
      const r = await upsertTemplateTaskAction(templateId, {
        id: task?.id,
        template_milestone_id: milestoneId,
        title,
        description,
        sort_order: sortOrder,
        default_role: defaultRole,
        offset_days: offsetDays,
        duration_days: duration,
        priority,
        is_visible_to_customer: visible,
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(task ? "Đã cập nhật task" : "Đã thêm task");
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <div>
        <Label className="text-xs text-slate-500">Tiêu đề *</Label>
        <Input
          className="mt-1"
          placeholder="VD: Phân tích từ khoá đối thủ"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs text-slate-500">Mô tả</Label>
        <Textarea
          className="mt-1"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-12">
        <div className="md:col-span-5">
          <Label className="text-xs text-slate-500">Milestone</Label>
          <Select
            value={milestoneId ?? "none"}
            onValueChange={(v) => setMilestoneId(v === "none" ? null : v)}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue>
                {(value: string | null) => {
                  if (!value || value === "none") return "Không gán milestone";
                  const m = milestones.find((m) => m.id === value);
                  return m
                    ? `${m.code ? `${m.code} · ` : ""}${m.title}`
                    : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Không gán milestone</SelectItem>
              {milestones.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.code ? `${m.code} · ` : ""}
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs text-slate-500">Vai trò mặc định</Label>
          <Input
            className="mt-1"
            placeholder="VD: seo, content, dev"
            value={defaultRole}
            onChange={(e) => setDefaultRole(e.target.value)}
          />
        </div>
        <div className="md:col-span-4">
          <Label className="text-xs text-slate-500">Độ ưu tiên</Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as Task["priority"])}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue>
                {(value: string | null) =>
                  PRIORITY_OPTIONS.find((o) => o.value === value)?.label ?? "—"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <Label className="text-xs text-slate-500">
            Bắt đầu (ngày thứ)
          </Label>
          <Input
            className="mt-1"
            type="number"
            min={0}
            value={offsetDays}
            onChange={(e) => setOffsetDays(e.target.valueAsNumber || 0)}
          />
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs text-slate-500">Kéo dài (ngày)</Label>
          <Input
            className="mt-1"
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.valueAsNumber || 1)}
          />
        </div>
        <div className="flex items-center gap-2 md:col-span-6">
          <Checkbox
            id={`vis-${task?.id ?? "new"}`}
            checked={visible}
            onCheckedChange={(c) => setVisible(c === true)}
          />
          <Label
            htmlFor={`vis-${task?.id ?? "new"}`}
            className="text-sm text-slate-700"
          >
            Khách hàng thấy task này (theo snapshot)
          </Label>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          <X className="mr-1 h-3 w-3" /> Huỷ
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={isPending || !title.trim()}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Check className="mr-1 h-3 w-3" /> Lưu
        </Button>
      </div>
    </div>
  );
}

// ---------- Checklist ----------

function ChecklistEditor({
  templateId,
  taskId,
  items,
  canManage,
}: {
  templateId: string;
  taskId: string;
  items: ChecklistItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const onAdd = () => {
    if (!content.trim()) return;
    startTransition(async () => {
      const r = await upsertChecklistItemAction(templateId, taskId, {
        content,
        sort_order: items.length,
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setContent("");
      router.refresh();
    });
  };

  const onDelete = (id: string) => {
    startTransition(async () => {
      const r = await deleteChecklistItemAction(templateId, id);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Checklist mặc định ({items.length})
      </p>
      {items.length === 0 && (
        <p className="text-xs italic text-slate-400">
          Chưa có checklist mặc định.
        </p>
      )}
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-white px-3 py-1.5"
          >
            <span className="text-sm text-slate-700">{item.content}</span>
            {canManage && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onDelete(item.id)}
                disabled={isPending}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <div className="flex gap-2">
          <Input
            placeholder="Thêm 1 đầu việc..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            disabled={isPending}
          />
          <Button
            type="button"
            size="sm"
            onClick={onAdd}
            disabled={isPending || !content.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
