"use client";

import { Fragment } from "react";

import { tokenizeComment } from "@/lib/mentions";
import { cn } from "@/lib/utils";

type Props = {
  body: string;
  /** Highlight mention trỏ đến currentUser (nền vàng nhạt) */
  currentUserId?: string | null;
  className?: string;
};

/**
 * Render comment body — biến `@[Tên](uuid)` thành blue chip. Giữ nguyên
 * whitespace + xuống dòng (whitespace-pre-wrap). Mention trỏ đến chính
 * user đang đăng nhập sẽ được highlight nền vàng để dễ nhận biết.
 */
export function CommentBody({ body, currentUserId, className }: Props) {
  const segments = tokenizeComment(body);
  return (
    <p className={cn("whitespace-pre-wrap", className)}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <Fragment key={i}>{seg.text}</Fragment>;
        }
        const isMe = currentUserId && seg.userId === currentUserId;
        return (
          <span
            key={i}
            className={cn(
              "mx-0.5 inline-flex items-center rounded px-1 font-medium",
              isMe
                ? "bg-amber-100 text-amber-900"
                : "bg-blue-50 text-blue-700",
            )}
          >
            @{seg.name}
          </span>
        );
      })}
    </p>
  );
}
