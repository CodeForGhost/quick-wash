/** Reads the two public Supabase settings, failing loudly if they are missing. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill in the ` +
        `project URL and anon key from Supabase -> Settings -> API.`,
    );
  }
  return value;
}

export const SUPABASE_URL = () => required("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY");

/**
 * Sign-in is by mobile number, but Supabase Auth is email-based. Each account
 * carries a synthetic address derived from the phone, so the number stays the
 * only credential anyone types. Nothing is ever sent to it.
 */
export const AUTH_EMAIL_DOMAIN = "quickwash.local";

export function phoneToAuthEmail(phone: string): string {
  return `${phone}@${AUTH_EMAIL_DOMAIN}`;
}
