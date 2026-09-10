import type { JWK } from "@supabase/supabase-js";

/**
 * The project's public signing keys, fetched once per server process.
 *
 * getClaims() verifies the access token's ES256 signature locally, which is
 * what makes reading the session free instead of a call to the Auth API. It
 * can only do that if it has the key: left to itself it caches the JWK set on
 * the client instance, and this app builds a fresh client per request, so it
 * would fetch the set every time and we would have swapped one network call
 * for another. Hence a cache that outlives the request.
 *
 * Never throws. A project still on the legacy shared secret has no JWK set at
 * all, and a fetch can fail; either way this returns undefined and getClaims()
 * falls back to asking the Auth API, which is exactly what the code did
 * before. Slower, never wrong.
 */

/** Matches auth-js's own JWKS_TTL. */
const TTL_MS = 10 * 60 * 1000;

let keys: { keys: JWK[] } | undefined;
let fetchedAt = 0;
let inFlight: Promise<{ keys: JWK[] } | undefined> | null = null;

export async function signingKeys(
  url: string,
  anonKey: string,
): Promise<{ keys: JWK[] } | undefined> {
  if (keys && Date.now() - fetchedAt < TTL_MS) return keys;

  // A cold start under load would otherwise fetch the set once per request.
  inFlight ??= load(url, anonKey).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function load(url: string, anonKey: string): Promise<{ keys: JWK[] } | undefined> {
  try {
    const response = await fetch(`${url}/auth/v1/.well-known/jwks.json`, {
      headers: { apikey: anonKey },
      cache: "no-store",
    });
    if (!response.ok) return undefined;

    const body = (await response.json()) as { keys?: JWK[] };
    if (!body.keys?.length) return undefined; // legacy HS256 project

    keys = { keys: body.keys };
    fetchedAt = Date.now();
    return keys;
  } catch {
    return undefined;
  }
}
