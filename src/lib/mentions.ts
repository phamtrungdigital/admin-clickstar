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
