import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseEnv } from "./src/lib/supabase/env";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Recreate the response to ensure the new cookies are included.
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
          try {
            request.cookies.set(name, value);
          } catch {
            // request.cookies may be read-only in some runtimes.
          }
        }
      },
    },
  });

  // Refreshes the session cookie if needed.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
