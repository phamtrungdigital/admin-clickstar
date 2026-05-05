import { cn } from "@/lib/utils";
import type { TicketPriority, TicketStatus } from "@/lib/database.types";
import {
  TICKET_CATEGORY_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
} from "@/lib/validation/tickets";

type TicketCategory = "technical" | "content" | "account" | "other";

const CATEGORY_TONE: Record<TicketCategory, string> = {
  technical: "bg-sky-50 text-sky-700 ring-sky-200",
  content: "bg-pink-50 text-pink-700 ring-pink-200",
  account: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  other: "bg-slate-50 text-slate-600 ring-slate-200",
};

const STATUS_TONE: Record<TicketStatus, string> = {
  new: "bg-blue-50 text-blue-700 ring-blue-200",
  in_progress: "bg-amber-50 text-amber-700 ring-amber-200",
  awaiting_customer: "bg-violet-50 text-violet-700 ring-violet-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

const PRIORITY_TONE: Record<TicketPriority, string> = {
  low: "bg-slate-50 text-slate-600 ring-slate-200",
  medium: "bg-blue-50 text-blue-700 ring-blue-200",
  high: "bg-orange-50 text-orange-700 ring-orange-200",
  urgent: "bg-red-50 text-red-700 ring-red-200",
};

const PILL =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const label =
    TICKET_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
  return <span className={cn(PILL, STATUS_TONE[status])}>{label}</span>;
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  const label =
    TICKET_PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? priority;
  return <span className={cn(PILL, PRIORITY_TONE[priority])}>{label}</span>;
}

export function TicketCategoryBadge({
  category,
}: {
  category: string | null;
}) {
  if (!category) return null;
  const cat = category as TicketCategory;
  const label =
    TICKET_CATEGORY_OPTIONS.find((o) => o.value === cat)?.label ?? category;
  const tone = CATEGORY_TONE[cat] ?? CATEGORY_TONE.other;
  return <span className={cn(PILL, tone)}>{label}</span>;
}
