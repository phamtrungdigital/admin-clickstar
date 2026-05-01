import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/validation/users";

const TONES: Record<string, string> = {
  super_admin: "bg-violet-50 text-violet-700 ring-violet-200",
  admin: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  manager: "bg-blue-50 text-blue-700 ring-blue-200",
  staff: "bg-slate-100 text-slate-700 ring-slate-200",
  support: "bg-amber-50 text-amber-700 ring-amber-200",
  accountant: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const PILL =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

export function RoleBadge({
  role,
  audience,
}: {
  role: string | null | undefined;
  audience?: "internal" | "customer";
}) {
  if (audience === "customer") {
    return (
      <span className={cn(PILL, "bg-rose-50 text-rose-700 ring-rose-200")}>
        Khách hàng
      </span>
    );
  }
  if (!role) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <span className={cn(PILL, TONES[role] ?? TONES.staff)}>
      {roleLabel(role)}
    </span>
  );
}
