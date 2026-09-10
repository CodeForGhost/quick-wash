import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { signingKeys } from "@/lib/supabase/jwks";

const GUARDED = ["/customer", "/agent", "/shop", "/admin", "/notifications"];

/**
 * Refreshes the Supabase session on every page request and writes the rotated
 * tokens back, which Server Components cannot do themselves. It also bounces
 * signed-out visitors away from the role sections before the page renders -
 * the real role check still happens in AppShell and in row level security.
 *
 * getClaims() rather than getUser(): it verifies the token's signature against
 * the project's public key locally, so a navigation no longer waits on the
 * Auth API. The refresh still happens - reading the session is what triggers
 * it - and a forged or expired token still fails.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Without keys the app cannot authenticate anyone; let the page render and
  // report the missing configuration rather than redirect-looping here.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims(undefined, {
    jwks: await signingKeys(url, key),
  });

  const path = request.nextUrl.pathname;
  if (!data?.claims && GUARDED.some((prefix) => path === prefix || path.startsWith(prefix + "/"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  /*
   * Pages, not API routes. A route handler authenticates itself through
   * requireUser() and can write a rotated cookie of its own, so running this
   * in front of one only added a second check to every call the app makes.
   */
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
