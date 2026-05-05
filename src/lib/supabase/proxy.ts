import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  // Favicon / app icons must be reachable to anonymous browsers (e.g. when
  // showing the login page or before iOS's add-to-home-screen request).
  "/icon",
  "/apple-icon",
  // TEMP debug endpoint — remove after diagnosing notify chain
  "/api/debug",
];

// Routes a `customer` audience may visit. Anything else (e.g. /contracts,
// /customers, /admin/*, /email) is bounced back to /dashboard. Listing only
// the *roots* — `/services/anything` is implicitly internal-only because
// only `/services` itself is whitelisted.
const CUSTOMER_ALLOWED_EXACT = new Set([
  "/dashboard",
  "/services",
  "/contracts",
  "/projects",
  "/tickets",
  "/documents",
  "/notifications",
  "/settings",
]);

function isCustomerAllowed(pathname: string): boolean {
  if (CUSTOMER_ALLOWED_EXACT.has(pathname)) return true;
  // Allow nested ticket routes — customers create + view their own tickets.
  if (pathname.startsWith("/tickets/new")) return true;
  if (/^\/tickets\/[^/]+$/.test(pathname)) return true;
  // Allow read-only contract detail (no /new, no /edit).
  if (/^\/contracts\/[^/]+$/.test(pathname)) return true;
  // Allow project detail (read-only, snapshot-fed).
  if (/^\/projects\/[^/]+$/.test(pathname)) return true;
  return false;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Audience gate: bounce customers back to /dashboard when they visit a
  // route outside their whitelist. Internal users see everything (subject
  // to internal_role checks done deeper in pages/actions).
  if (
    user &&
    !isPublic &&
    pathname !== "/" &&
    pathname !== "/dashboard" &&
    !isCustomerAllowed(pathname)
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("audience")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.audience === "customer") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
