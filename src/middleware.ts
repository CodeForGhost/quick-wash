import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const GUARDED = ["/customer", "/agent", "/shop", "/admin", "/notifications"];

/**
 * Refreshes the Supabase session on every request and writes the rotated
 * tokens back, which Server Components cannot do themselves. It also bounces
 * signed-out visitors away from the role sections before the page renders -
 * the real role check still happens in AppShell and in row level security.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && GUARDED.some((prefix) => path === prefix || path.startsWith(prefix + "/"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  // Everything except static assets, so the session is refreshed site-wide.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
