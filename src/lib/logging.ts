import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type LogContext = Record<string, unknown>;

/**
 * Self-hosted error logger — ghi vào table public.error_log để admin
 * audit qua /admin/errors. Best-effort, không bao giờ throw (nếu insert
 * fail thì in console.error fallback). Dùng thay cho silent
 * `.catch(() => {})` ở mọi notify chain + background work.
 *
 * Convention category: `<surface>.<event>`. Vd:
 *   - `notify.milestone_comment`
 *   - `notify.task_comment`
 *   - `action.ticket.create`
 *   - `email.ticket_replied`
 */
export async function logError(
  category: string,
  err: unknown,
  context: LogContext = {},
): Promise<void> {
  // Always log to console first — fallback nếu DB write fail
  console.error(`[${category}]`, err, context);

  let message = "(unknown)";
  let stack: string | null = null;
  if (err instanceof Error) {
    message = err.message;
    stack = err.stack ? err.stack.slice(0, 4000) : null;
  } else if (typeof err === "string") {
    message = err;
  } else {
    try {
      message = JSON.stringify(err).slice(0, 1000);
    } catch {
      message = String(err);
    }
  }

  try {
    const admin = createAdminClient();
    const userId = (context.userId as string | undefined) ?? null;
    const requestPath = (context.requestPath as string | undefined) ?? null;
    // Strip duplicate fields đã thành column riêng
    const { userId: _u, requestPath: _p, ...rest } = context as LogContext & {
      userId?: string;
      requestPath?: string;
    };
    void _u;
    void _p;
    await admin.from("error_log").insert({
      category,
      message: message.slice(0, 2000),
      stack,
      context: rest,
      user_id: userId,
      request_path: requestPath,
    });
  } catch (writeErr) {
    console.error("[logging] error_log insert failed", writeErr);
  }
}
