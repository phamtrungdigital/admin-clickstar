"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  Loader2,
  Lock,
  Minus,
  RotateCcw,
  Save,
  Shield,
  ShieldCheck,
  ShieldUser,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  resetPermissionsToDefaultsAction,
  updateRolePermissionsAction,
} from "@/app/(dashboard)/admin/roles/actions";

type AccessLevel = "full" | "manage" | "scoped" | "view" | "none";

const ACCESS_META: Record<
  AccessLevel,
  { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }
> = {
  full: {
    label: "Toàn quyền",
    tone: "bg-violet-50 text-violet-700 ring-violet-200",
    icon: ShieldCheck,
  },
  manage: {
    label: "Tạo / sửa / xoá",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: Check,
  },
  scoped: {
    label: "Theo phân công",
    tone: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: Shield,
  },
  view: {
    label: "Chỉ xem",
    tone: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: Eye,
  },
  none: {
    label: "Không có",
    tone: "bg-slate-50 text-slate-400 ring-slate-200",
    icon: Minus,
  },
};

// Click-cycle order — clicking a cell rotates through these.
const CYCLE: AccessLevel[] = ["none", "view", "scoped", "manage", "full"];

type Role = { key: string; label: string; summary: string };
type Scope = { key: string; label: string };

type Props = {
  internalRoles: Role[];
  customerRoles: Role[];
  scopes: Scope[];
  initialMatrix: Record<string, Record<string, AccessLevel>>;
  customerMatrix: Record<string, Record<string, AccessLevel>>;
  canEdit: boolean;
};

type ChangeSet = Record<string, AccessLevel>; // key = `${role}|${scope}`

function key(role: string, scope: string) {
  return `${role}|${scope}`;
}

export function PermissionsMatrix({
  internalRoles,
  customerRoles,
  scopes,
  initialMatrix,
  customerMatrix,
  canEdit,
}: Props) {
  const router = useRouter();
  const [matrix, setMatrix] = useState(initialMatrix);
  const [changes, setChanges] = useState<ChangeSet>({});
  const [isPending, startTransition] = useTransition();

  const dirtyCount = Object.keys(changes).length;

  const cycle = (role: string, scope: string) => {
    if (!canEdit) return;
    setMatrix((prev) => {
      const cur = prev[role]?.[scope] ?? "none";
      const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      const k = key(role, scope);
      setChanges((c) => {
        const out = { ...c };
        // If it cycles back to the original initial value, drop the change.
        if (initialMatrix[role]?.[scope] === next) {
          delete out[k];
        } else {
          out[k] = next;
        }
        return out;
      });
      return {
        ...prev,
        [role]: { ...prev[role], [scope]: next },
      };
    });
  };

  const save = () => {
    if (dirtyCount === 0) return;
    const payload = Object.entries(changes).map(([k, level]) => {
      const [role, scope] = k.split("|");
      return { role, scope, level };
    });
    startTransition(async () => {
      const result = await updateRolePermissionsAction(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Đã cập nhật ${result.data?.applied ?? 0} ô phân quyền`);
      setChanges({});
      router.refresh();
    });
  };

  const discard = () => {
    setMatrix(initialMatrix);
    setChanges({});
  };

  const reset = () => {
    if (
      !window.confirm(
        "Đặt lại toàn bộ phân quyền về mặc định theo PRD §3? Thao tác này lưu vào nhật ký.",
      )
    )
      return;
    startTransition(async () => {
      const result = await resetPermissionsToDefaultsAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã reset về mặc định");
      setChanges({});
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Legend />

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 px-4">
          <p className="text-sm text-slate-600">
            {dirtyCount > 0 ? (
              <>
                <strong>{dirtyCount}</strong> ô đang được thay đổi — bấm{" "}
                <strong>Lưu</strong> để áp dụng.
              </>
            ) : (
              "Click vào từng ô để cycle qua 5 mức truy cập."
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reset}
              disabled={isPending}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reset mặc định
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={discard}
              disabled={isPending || dirtyCount === 0}
            >
              Huỷ thay đổi
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={isPending || dirtyCount === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Lưu ({dirtyCount})
            </Button>
          </div>
        </div>
      )}

      {!canEdit && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-600">
          Bạn đang xem ở chế độ chỉ đọc — chỉ <strong>Super Admin</strong> mới
          chỉnh được phân quyền.
        </div>
      )}

      <Section
        title="Nội bộ Clickstar"
        icon={ShieldUser}
        roles={internalRoles}
        scopes={scopes}
        matrix={matrix}
        editable={canEdit}
        changes={changes}
        onCellClick={cycle}
      />

      <Section
        title="Khách hàng"
        icon={Lock}
        roles={customerRoles}
        scopes={scopes}
        matrix={customerMatrix}
        editable={false}
        changes={{}}
        onCellClick={() => {}}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
        <p className="font-semibold">Lưu ý</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
          <li>
            Mọi thay đổi được ghi vào{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px]">
              audit_logs
            </code>{" "}
            (action <code>update</code>, entity_type{" "}
            <code>role_permission</code>) — anh có thể truy ngược ai đổi gì lúc
            nào.
          </li>
          <li>
            RLS Postgres vẫn là <strong>hard wall</strong> chống lộ data giữa
            các khách hàng. Bảng này chỉ kiểm soát nút bấm + actions ở app
            level.
          </li>
          <li>
            Phân quyền của khách hàng (Owner / Marketing Manager / Viewer) hiện
            là cố định theo PRD — chưa cho chỉnh từ UI vì RLS phức tạp hơn nhóm
            nội bộ.
          </li>
        </ul>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Chú thích mức truy cập
      </p>
      <div className="flex flex-wrap gap-3">
        {(["full", "manage", "scoped", "view", "none"] as AccessLevel[]).map(
          (level) => {
            const meta = ACCESS_META[level];
            const Icon = meta.icon;
            return (
              <div
                key={level}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                  meta.tone,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  roles,
  scopes,
  matrix,
  editable,
  changes,
  onCellClick,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
  scopes: Scope[];
  matrix: Record<string, Record<string, AccessLevel>>;
  editable: boolean;
  changes: ChangeSet;
  onCellClick: (role: string, scope: string) => void;
}) {
  const dirtyKeys = useMemo(() => new Set(Object.keys(changes)), [changes]);
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-blue-600" />
        {title}
      </h2>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">
                  Vai trò
                </th>
                {scopes.map((s) => (
                  <th
                    key={s.key}
                    className="whitespace-nowrap px-3 py-3 text-center font-semibold text-slate-700"
                  >
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((role) => (
                <tr key={role.key} className="align-top">
                  <td className="sticky left-0 z-10 bg-white px-4 py-4">
                    <div className="min-w-[180px]">
                      <p className="font-medium text-slate-900">{role.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {role.summary}
                      </p>
                    </div>
                  </td>
                  {scopes.map((s) => {
                    const level = matrix[role.key]?.[s.key] ?? "none";
                    const dirty = dirtyKeys.has(key(role.key, s.key));
                    return (
                      <td
                        key={s.key}
                        className={cn(
                          "px-3 py-4 text-center",
                          dirty && "bg-amber-50",
                        )}
                      >
                        <CellButton
                          level={level}
                          editable={editable}
                          dirty={dirty}
                          onClick={() => onCellClick(role.key, s.key)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CellButton({
  level,
  editable,
  dirty,
  onClick,
}: {
  level: AccessLevel;
  editable: boolean;
  dirty: boolean;
  onClick: () => void;
}) {
  const meta = ACCESS_META[level];
  const Icon = meta.icon;
  const className = cn(
    "inline-flex items-center justify-center rounded-md p-1.5 ring-1 ring-inset transition-shadow",
    meta.tone,
    editable && "cursor-pointer hover:ring-2",
    dirty && "ring-2 ring-amber-400",
    !editable && "cursor-default",
  );
  if (!editable) {
    return (
      <span title={meta.label} className={className}>
        <Icon className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <button
      type="button"
      title={`${meta.label} — click để đổi`}
      onClick={onClick}
      className={className}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
