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
