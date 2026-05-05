// Mention parser shared giữa server (notification) + client (render).
//
// Storage format trong body: `@[Tên Hiển Thị](uuid)`
// - Tên là snapshot tại thời điểm tag → vẫn đọc được nếu user đổi tên sau
// - UUID là source of truth để route notification, không phụ thuộc tên
//
// Pattern không cố gắng tự generate format phức tạp như Notion / Slack —
// chỉ markdown-style để parse đơn giản trên cả 2 phía.

export const MENTION_REGEX = /@\[([^\]]+)\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/g;

export type ParsedMention = {
  /** Display name tại thời điểm mention (có thể stale) */
  name: string;
  /** profiles.id — source of truth cho noti routing */
  userId: string;
};

/** Trả về danh sách mention đã dedup theo userId, theo thứ tự xuất hiện. */
export function parseMentions(body: string): ParsedMention[] {
  const seen = new Set<string>();
  const out: ParsedMention[] = [];
  for (const match of body.matchAll(MENTION_REGEX)) {
    const name = match[1];
    const userId = match[2];
    if (seen.has(userId)) continue;
    seen.add(userId);
    out.push({ name, userId });
  }
  return out;
}

/** Thay tất cả mention bằng `@Tên` để render plain text (email, noti body…). */
export function stripMentionsToPlain(body: string): string {
  return body.replace(MENTION_REGEX, (_, name) => `@${name}`);
}

/**
 * Convert display text "@Tên" → storage format "@[Tên](uuid)".
 *
 * mentions Map keyed by display name → userId. Longer names được replace
 * trước để tránh "@Phạm" match nhầm bên trong "@Phạm Văn A". Sau khi
 * thay markup `@[Phạm Văn A](uuid)` thì substring `@Phạm` không còn xuất
 * hiện (do có `[` chen vào sau `@`), nên tên ngắn hơn replace sau không
 * đụng vào markup đã tạo.
 */
export function serializeMentions(
  displayText: string,
  mentions: Map<string, string>,
): string {
  if (mentions.size === 0) return displayText;
  const names = Array.from(mentions.keys()).sort(
    (a, b) => b.length - a.length,
  );
  let result = displayText;
  for (const name of names) {
    const userId = mentions.get(name);
    if (!userId) continue;
    result = result.split(`@${name}`).join(`@[${name}](${userId})`);
  }
  return result;
}

/**
 * Inverse của serializeMentions — convert storage `@[Tên](uuid)` về
 * display `@Tên` cho việc edit comment, kèm Map mention để re-serialize
 * khi save. Dùng khi user bấm "Sửa" trên 1 comment đã có mention.
 */
export function deserializeMentions(storedBody: string): {
  displayValue: string;
  mentions: Map<string, string>;
} {
  const mentions = new Map<string, string>();
  for (const m of parseMentions(storedBody)) {
    mentions.set(m.name, m.userId);
  }
  return {
    displayValue: stripMentionsToPlain(storedBody),
    mentions,
  };
}

/** Window cho phép user edit comment sau khi gửi (giống Slack). */
export const COMMENT_EDIT_WINDOW_MINUTES = 5;

/** Trả về true nếu comment vẫn trong window 5 phút. */
export function isWithinEditWindow(createdAt: string | Date): boolean {
  const t = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return Date.now() - t.getTime() < COMMENT_EDIT_WINDOW_MINUTES * 60 * 1000;
}

/** Tách body thành segments để render React. Mỗi segment là text hoặc mention. */
export type CommentSegment =
  | { type: "text"; text: string }
  | { type: "mention"; name: string; userId: string };

export function tokenizeComment(body: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(MENTION_REGEX)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: "text", text: body.slice(lastIndex, start) });
    }
    segments.push({ type: "mention", name: match[1], userId: match[2] });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < body.length) {
    segments.push({ type: "text", text: body.slice(lastIndex) });
  }
  return segments;
}
