import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AuthStatus = "allowed" | "anonymous" | "forbidden" | "unavailable";
export type Actor = { id: string; email: string };
export type AuthResult = { status: AuthStatus; actor?: Actor };

export function allowedEmail() {
  const email = process.env.ALLOWED_USER_EMAIL?.trim().toLowerCase();
  return email && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function isAllowedUser(user: User, email: string) {
  return !user.is_anonymous && Boolean(user.email_confirmed_at) && user.email?.toLowerCase() === email;
}

/** Fresh Auth-server identity; never trust cookies, form email, or getSession user. */
export async function verifyActor(client: SupabaseClient): Promise<AuthResult> {
  const email = allowedEmail();
  if (!email) return { status: "unavailable" };
  try {
    const { data, error } = await client.auth.getUser();
    if (error) {
      const anonymous = error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403;
      return { status: anonymous ? "anonymous" : "unavailable" };
    }
    if (!data.user) return { status: "anonymous" };
    if (!isAllowedUser(data.user, email)) return { status: "forbidden" };
    return { status: "allowed", actor: { id: data.user.id, email } };
  } catch { return { status: "unavailable" }; }
}
