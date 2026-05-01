import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "./current-user";
import type { ProfileRow } from "@/lib/database.types";

export type AudienceGuardResult =
  | { ok: true; profile: ProfileRow }
  | { ok: false; message: string };

const UNAUTHORIZED_MSG = "Bạn không có quyền thực hiện thao tác này.";

export function isInternal(profile: ProfileRow | null): profile is ProfileRow {
  return profile?.audience === "internal";
}

/**
 * For Server Actions: returns the profile when the caller is internal,
 * otherwise an `{ ok: false, message }` shape that actions can return
 * directly. Customers see the same shape as a validation error so the
 * UI can `toast.error(message)` without special-casing.
 */
export async function requireInternalAction(): Promise<AudienceGuardResult> {
  const { profile } = await getCurrentUser();
  if (!isInternal(profile)) {
    return { ok: false, message: UNAUTHORIZED_MSG };
  }
  return { ok: true, profile };
}

/**
 * For Server Components / Pages: redirects customers to /dashboard so they
 * never reach internal-only routes via direct URL. Returns the profile to
 * the caller for further checks (e.g. internal_role gating).
 */
export async function requireInternalPage(): Promise<ProfileRow> {
  const { profile } = await getCurrentUser();
  if (!isInternal(profile)) {
    redirect("/dashboard");
  }
  return profile;
}
