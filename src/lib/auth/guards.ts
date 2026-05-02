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

/** Manager-or-above internal roles: have authority to assign Account
 *  Managers, override AM picks made by lower-tier staff, and edit
 *  cross-team data. Staff / support / accountant cannot. */
export function canManageCustomers(
  profile: ProfileRow | null,
): profile is ProfileRow {
  if (!isInternal(profile)) return false;
  return (
    profile.internal_role === "super_admin"
    || profile.internal_role === "admin"
    || profile.internal_role === "manager"
  );
}

/** Contracts contain financial info (value, VAT) — anh re-confirm
 *  2026-05-02: HĐ ít + chất, anh tự quản lý. Internal chỉ super_admin /
 *  admin xem được. Customer luôn xem HĐ của họ. Manager / staff / support
 *  / accountant đều không thấy. Mirrors ROLES_CONTRACT in nav-config.ts. */
export function canSeeContracts(profile: ProfileRow | null): boolean {
  if (!profile) return false;
  if (profile.audience === "customer") return true;
  if (!isInternal(profile)) return false;
  return (
    profile.internal_role === "super_admin"
    || profile.internal_role === "admin"
  );
}

/** Page-level guard for /contracts/* — fail fast (redirect /dashboard)
 *  instead of letting RLS return empty rows that would confuse the user. */
export async function requireContractAccess(): Promise<ProfileRow> {
  const { profile } = await getCurrentUser();
  if (!canSeeContracts(profile)) {
    redirect("/dashboard");
  }
  return profile!;
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
