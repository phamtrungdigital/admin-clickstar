import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TicketCommentRow } from "@/lib/database.types";

export type TicketCommentItem = TicketCommentRow & {
  author: {
    id: string;
    full_name: string;
    audience: string | null;
    internal_role: string | null;
  } | null;
};

/**
 * List comments của 1 ticket, oldest → newest. RLS đã filter:
 * - Internal staff: thấy tất cả (public + internal note)
 * - Customer: chỉ thấy comments có is_internal=false
 */
export async function listTicketComments(
  ticketId: string,
): Promise<TicketCommentItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ticket_comments")
    .select(
      `
      *,
      author:profiles!ticket_comments_author_id_fkey (
        id,
        full_name,
        audience,
        internal_role
      )
      `,
    )
    .eq("ticket_id", ticketId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown) as TicketCommentItem[];
}
