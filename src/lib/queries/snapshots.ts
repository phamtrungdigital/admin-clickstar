import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Json,
  MilestoneRow,
  ProjectRow,
  SnapshotRow,
  TaskRow,
} from "@/lib/database.types";

export type SnapshotListItem = SnapshotRow & {
  created_by_profile: { id: string; full_name: string } | null;
  approved_by_profile: { id: string; full_name: string } | null;
};

export async function listSnapshotsForProject(
  projectId: string,
): Promise<SnapshotListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("snapshots")
    .select(
      `
      *,
      created_by_profile:profiles!snapshots_created_by_fkey ( id, full_name ),
      approved_by_profile:profiles!snapshots_approved_by_fkey ( id, full_name )
      `,
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown) as SnapshotListItem[];
}

export async function getSnapshotById(
  id: string,
): Promise<SnapshotListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("snapshots")
    .select(
      `
      *,
      created_by_profile:profiles!snapshots_created_by_fkey ( id, full_name ),
      approved_by_profile:profiles!snapshots_approved_by_fkey ( id, full_name )
      `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as SnapshotListItem | null) ?? null;
}

/**
 * Latest snapshot a customer is allowed to read for a given project.
 * RLS already filters; we just take the freshest approved/auto_published.
 * Returns null if no snapshot has been published yet.
 */
export async function getLatestPublishedSnapshot(
  projectId: string,
): Promise<SnapshotRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("snapshots")
    .select("*")
    .eq("project_id", projectId)
    .in("status", ["approved", "auto_published"])
    .order("approved_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SnapshotRow | null) ?? null;
}

/**
 * Capture the customer-visible slice of a project as a frozen JSON payload.
 * Caller is responsible for inserting the snapshot row — this function only
 * builds the payload. Reads through the user-cookie supabase client so RLS
 * applies (we never capture rows the caller couldn't already see).
 *
 * Customer-visible slice (PRD §10):
 * - Project: name, status, starts_at, ends_at, progress_percent
 * - Milestones: full list with status + progress
 * - Tasks: ONLY tasks where is_visible_to_customer = true (customer-safe)
 *   with title, status, due_at, milestone_id, is_extra
 * - We DO NOT capture comments, audit log, internal-only tasks, or PM names
 */
export type SnapshotPayload = {
  captured_at: string;
  project: Pick<
    ProjectRow,
    "id" | "name" | "status" | "starts_at" | "ends_at" | "progress_percent"
  >;
  milestones: Array<
    Pick<
      MilestoneRow,
      | "id"
      | "code"
      | "title"
      | "description"
      | "sort_order"
      | "starts_at"
      | "ends_at"
      | "status"
      | "progress_percent"
      | "deliverable_required"
    >
  >;
  tasks: Array<
    Pick<
      TaskRow,
      | "id"
      | "title"
      | "status"
      | "due_at"
      | "milestone_id"
      | "is_extra"
      | "extra_source"
    >
  >;
};

export async function buildSnapshotPayload(
  projectId: string,
): Promise<SnapshotPayload | null> {
  const supabase = await createClient();
  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("id, name, status, starts_at, ends_at, progress_percent")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!project) return null;

  const { data: milestones, error: mErr } = await supabase
    .from("milestones")
    .select(
      "id, code, title, description, sort_order, starts_at, ends_at, status, progress_percent, deliverable_required",
    )
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (mErr) throw new Error(mErr.message);

  const { data: tasks, error: tErr } = await supabase
    .from("tasks")
    .select("id, title, status, due_at, milestone_id, is_extra, extra_source")
    .eq("project_id", projectId)
    .eq("is_visible_to_customer", true)
    .is("deleted_at", null)
    .order("due_at", { ascending: true, nullsFirst: false });
  if (tErr) throw new Error(tErr.message);

  return {
    captured_at: new Date().toISOString(),
    project: project as SnapshotPayload["project"],
    milestones: (milestones ?? []) as SnapshotPayload["milestones"],
    tasks: (tasks ?? []) as SnapshotPayload["tasks"],
  };
}

/**
 * Type guard for safely reading the captured payload back out of a Json column.
 */
export function readSnapshotPayload(value: Json): SnapshotPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.captured_at !== "string" ||
    typeof v.project !== "object" ||
    !Array.isArray(v.milestones) ||
    !Array.isArray(v.tasks)
  ) {
    return null;
  }
  return value as unknown as SnapshotPayload;
}
