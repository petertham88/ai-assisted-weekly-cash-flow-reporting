import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes reachable without a session. Everything else redirects to /login.
const PUBLIC_PREFIXES = ["/login", "/signup", "/demo", "/auth"];
const PUBLIC_EXACT = ["/demo_cashflow.csv", "/api/health", "/favicon.ico"];

function isPublic(path: string): boolean {
  if (PUBLIC_EXACT.includes(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured, skip the auth refresh and pass through.
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  try {
    let response = supabaseResponse;
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    // Refresh session + get the current user.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;

    // Auth wall: unauthenticated visitors may only reach public routes.
    if (!user && !isPublic(path)) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 });
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = path === "/" ? "" : `?redirect=${encodeURIComponent(path)}`;
      return NextResponse.redirect(loginUrl);
    }

    // Signed-in users shouldn't sit on the auth screens.
    if (user && (path === "/login" || path === "/signup")) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }

    return response;
  } catch {
    // Never let an auth hiccup crash the entire edge middleware.
    return supabaseResponse;
  }
}
