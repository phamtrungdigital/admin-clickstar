import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/database.types";

export type CurrentUser = {
  id: string;
  email: string;
  profile: ProfileRow | null;
};

/**
 * Server-only: load the authenticated user + profile.
 * Redirects to /login if not signed in. If Supabase is unconfigured the
 * proxy already redirects, so this function assumes env is present.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    profile: profile ?? null,
  };
}
