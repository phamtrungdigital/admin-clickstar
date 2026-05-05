import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { parseMentions, stripMentionsToPlain } from "@/lib/mentions";
import { notify } from "@/lib/notifications";

export type MentionNotifyContext = {
  /** Người vừa gửi comment — không tự noti chính họ */
  actorId: string;
  actorName: string;
  /** Title hiển thị cho noti, vd: "công việc Code design", "ticket Lỗi login" */
  entityLabel: string;
  /** Loại entity (milestone | task | ticket) — để link mở đúng trang */
  entityType: string;
  entityId: string;
  /** URL khi click noti */
  linkUrl: string;
  /** company_id để scope (có thể null cho ticket nội bộ chưa rõ company) */
  companyId: string | null;
  /** Body comment đã chứa mention — sẽ strip để hiển thị plain trong noti */
  body: string;
  /** Danh sách user_id đã nhận noti chung (PM, AM, assignee...) → tránh
   *  duplicate row. Mention sẽ ưu tiên hơn (title khác) nên những user
   *  này sẽ vẫn nhận noti mention thay vì noti chung. */
  alreadyNotifiedUserIds: Set<string>;
};

/**
 * Notify cho user được @mention trong comment. Trả về set userId đã noti
 * để caller skip không noti trùng (ưu tiên: mention thắng noti chung).
 */
export async function notifyMentions(
  ctx: MentionNotifyContext,
): Promise<Set<string>> {
  const mentions = parseMentions(ctx.body);
  if (mentions.length === 0) return new Set();

  const admin = createAdminClient();
  // Verify mentioned IDs là internal user còn active — tránh insert noti
  // cho ID rác (KH paste vào, user đã xoá...). Cũng load full_name fresh
  // để noti hiển thị tên hiện tại, không dùng snapshot trong body.
  const userIds = Array.from(new Set(mentions.map((m) => m.userId)));
  const { data: validRows } = await admin
    .from("profiles")
    .select("id")
    .in("id", userIds)
    .eq("audience", "internal")
    .eq("is_active", true)
    .is("deleted_at", null);

  const validIds = new Set((validRows ?? []).map((r) => r.id as string));
  validIds.delete(ctx.actorId);

  if (validIds.size === 0) return new Set();

  const preview = stripMentionsToPlain(ctx.body).slice(0, 200);
  const rows = Array.from(validIds).map((uid) => ({
    user_id: uid,
    company_id: ctx.companyId,
    title: `${ctx.actorName} đã nhắc bạn trong ${ctx.entityLabel}`,
    body: preview,
    link_url: ctx.linkUrl,
    entity_type: ctx.entityType,
    entity_id: ctx.entityId,
  }));

  await notify(rows);
  return validIds;
}
