import "server-only";
import { getSupabaseAdmin } from "./supabase/admin";
import { DEV_BYPASS, DEV_STAFF } from "./dev-mode";

/**
 * Staff authentication for every /api/admin/* route.
 *
 * The admin UI signs in through Supabase Auth in the browser and sends the
 * access token as `Authorization: Bearer <jwt>`. Here we verify that token
 * against Supabase (which checks the signature and expiry for us) and then
 * check the staff role. Both halves matter: a valid token for a customer
 * account must not open the kitchen queue.
 */

export type StaffUser = {
  id: string;
  email: string;
  role: "staff" | "admin";
};

const ALLOWED_ROLES = new Set(["staff", "admin"]);

/** Emergency/bootstrap allowlist, e.g. the owner's own account. */
const emailAllowlist = (): Set<string> =>
  new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

export async function getStaffUser(req: Request): Promise<StaffUser | null> {
  // Local test mode: every admin route opens as a fake staff user. See
  // lib/dev-mode.ts for why this cannot be on in a production build.
  if (DEV_BYPASS) return { ...DEV_STAFF };

  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const user = data.user;
  const email = (user.email ?? "").toLowerCase();

  // app_metadata is server-controlled; user_metadata is user-writable and must
  // never be trusted for authorisation.
  const claimedRole = String(
    (user.app_metadata as Record<string, unknown> | null)?.role ?? "",
  ).toLowerCase();

  const role: "staff" | "admin" | null = ALLOWED_ROLES.has(claimedRole)
    ? (claimedRole as "staff" | "admin")
    : emailAllowlist().has(email)
      ? "admin"
      : null;

  if (!role) return null;
  return { id: user.id, email, role };
}

/** Throws a ready-to-return 401/403 Response when the caller is not staff. */
export async function requireStaff(req: Request): Promise<StaffUser> {
  const user = await getStaffUser(req);
  if (!user) {
    throw new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return user;
}

/** Wraps a handler so a thrown Response from requireStaff is returned cleanly. */
export const withStaff =
  <T extends unknown[]>(
    handler: (req: Request, user: StaffUser, ...rest: T) => Promise<Response>,
  ) =>
  async (req: Request, ...rest: T): Promise<Response> => {
    try {
      const user = await requireStaff(req);
      return await handler(req, user, ...rest);
    } catch (e) {
      if (e instanceof Response) return e;
      console.error("[admin] handler error", e);
      return Response.json({ error: "internal_error" }, { status: 500 });
    }
  };
