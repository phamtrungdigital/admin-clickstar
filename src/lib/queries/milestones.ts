import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MilestoneRow } from "@/lib/database.types";

export type MilestoneCommentItem = {
  id: string;
  milestone_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: { id: string; full_name: string; avatar_url: string | null } | null;
};

/**
 * Load tất cả comment cho 1 list milestone (1 round-trip), trả về map
 * milestone_id → comments[]. Dùng ở project detail page để hiện comment
 * thread bên trong từng milestone card mà không cần N+1 query.
 */
export async function listCommentsByMilestoneIds(
  milestoneIds: string[],
): Promise<Map<string, MilestoneCommentItem[]>> {
  const result = new Map<string, MilestoneCommentItem[]>();
  if (milestoneIds.length === 0) return result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestone_comments")
    .select(
      `
      id,
      milestone_id,
      body,
      created_at,
      updated_at,
      author:profiles!milestone_comments_author_id_fkey (
        id, full_name, avatar_url
      )
    `,
    )
    .in("milestone_id", milestoneIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const r = row as unknown as MilestoneCommentItem;
    const arr = result.get(r.milestone_id) ?? [];
    arr.push(r);
    result.set(r.milestone_id, arr);
  }
  return result;
}

export async function getMilestoneById(
  id: string,
): Promise<MilestoneRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as MilestoneRow | null;
}

export type MilestoneAttachment = {
  path: string;
  filename: string;
  content_type: string;
  size: number;
};

export type MilestoneLink = {
  url: string;
  label?: string;
};

export type MilestoneCompletionItem = {
  id: string;
  milestone_id: string;
  summary: string;
  attachments: MilestoneAttachment[];
  links: MilestoneLink[];
  completed_at: string;
  undone_at: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
  completed_by: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  reopened_by: {
    id: string;
    full_name: string;
  } | null;
};

/**
 * Lấy completion ACTIVE (chưa undone, chưa reopened) cho 1 milestone.
 * Hiện tối đa 1 row do unique partial index trong migration 0034.
 */
export async function getActiveMilestoneCompletion(
  milestoneId: string,
): Promise<MilestoneCompletionItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestone_completions")
    .select(
      `
      id,
      milestone_id,
      summary,
      attachments,
      links,
      completed_at,
      undone_at,
      reopened_at,
      reopen_reason,
      completed_by:profiles!milestone_completions_completed_by_fkey (
        id, full_name, avatar_url
      ),
      reopened_by:profiles!milestone_completions_reopened_by_fkey (
        id, full_name
      )
    `,
    )
    .eq("milestone_id", milestoneId)
    .is("undone_at", null)
    .is("reopened_at", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as unknown as MilestoneCompletionItem | null;
}

export type CustomerCompletionMeta = {
  milestone_id: string;
  completed_at: string;
  completer_full_name: string | null;
  completer_avatar_url: string | null;
};

/**
 * Customer-safe completion metadata cho milestones của 1 project. Dùng
 * SECURITY DEFINER function (migration 0040) để KHÔNG lộ summary +
 * attachments + links (chỉ internal mới xem chi tiết proof).
 *
 * Trả Map keyed by milestone_id để render trong customer timeline.
 */
export async function listCustomerCompletionMetaByProject(
  projectId: string,
): Promise<Map<string, CustomerCompletionMeta>> {
  const result = new Map<string, CustomerCompletionMeta>();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_customer_milestone_completion_meta",
    { p_project_id: projectId },
  );
  if (error) {
    // Non-fatal — customer view vẫn render milestones, chỉ thiếu badge
    return result;
  }
  for (const row of (data ?? []) as Array<{
    milestone_id: string;
    completed_at: string;
    completer_full_name: string | null;
    completer_avatar_url: string | null;
  }>) {
    result.set(row.milestone_id, {
      milestone_id: row.milestone_id,
      completed_at: row.completed_at,
      completer_full_name: row.completer_full_name,
      completer_avatar_url: row.completer_avatar_url,
    });
  }
  return result;
}

/**
 * Batch: lấy active completion cho nhiều milestones (1 round-trip),
 * trả về Map keyed by milestone_id.
 */
export async function listActiveCompletionsByMilestoneIds(
  milestoneIds: string[],
): Promise<Map<string, MilestoneCompletionItem>> {
  const result = new Map<string, MilestoneCompletionItem>();
  if (milestoneIds.length === 0) return result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestone_completions")
    .select(
      `
      id,
      milestone_id,
      summary,
      attachments,
      links,
      completed_at,
      undone_at,
      reopened_at,
      reopen_reason,
      completed_by:profiles!milestone_completions_completed_by_fkey (
        id, full_name, avatar_url
      ),
      reopened_by:profiles!milestone_completions_reopened_by_fkey (
        id, full_name
      )
    `,
    )
    .in("milestone_id", milestoneIds)
    .is("undone_at", null)
    .is("reopened_at", null);
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as unknown as MilestoneCompletionItem[]) {
    result.set(row.milestone_id, row);
  }
  return result;
}
