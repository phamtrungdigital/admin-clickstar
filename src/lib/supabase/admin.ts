import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for trusted server-side operations that need to bypass
 * RLS — e.g. inserting notifications (the notifications table only allows
 * service-role inserts per migration 0008/0011 by design).
 *
 * NEVER import this in client components or expose it to the browser.
 * Use the regular `createClient` from `./server` for normal queries that
 * should respect the user's RLS context.
 *
 * Untyped on purpose: the codebase's `Database` type doesn't model Views/
 * Functions/Enums in the shape `@supabase/supabase-js` expects, so passing
 * it as a generic resolves to `never`. Untyped is safer here than a wrong
 * generic, and we narrow at the call site (e.g. notifications.ts).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
