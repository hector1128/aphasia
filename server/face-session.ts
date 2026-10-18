import { createClient } from "@supabase/supabase-js";
import { cloudConfig } from "../src/cloud-config.js";

export type FaceSession = { userId: string; access_token: string; refresh_token: string };

// Call ONLY after a fresh, single-use login proof from the private face service.
export async function createFaceSession(config: Record<string, string | undefined>, userId: string,
  fetcher: typeof fetch = fetch): Promise<FaceSession> {
  const secret = config.SUPABASE_SECRET_KEY || config.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw Error("Face sign-in is not configured.");
  const url = config.SUPABASE_URL || cloudConfig.url;
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: {
    fetch: ((input, init) => fetcher(input, { ...init, signal: AbortSignal.timeout(10000), redirect: "error" })) as typeof fetch,
  } };
  const admin = createClient(url, secret, options);
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const user = data.user;
  if (error || !user || user.id !== userId || !user.email || !user.email_confirmed_at ||
      user.factors?.some((factor) => factor.status === "verified")) throw Error("Use password sign-in.");
  // generateLink does not send email. The one-time token stays entirely server-side.
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (link.error || link.data.user.id !== userId || !link.data.properties.hashed_token) throw Error("Could not create sign-in.");
  const client = createClient(url, config.SUPABASE_PUBLISHABLE_KEY || cloudConfig.publishableKey, options);
  const verified = await client.auth.verifyOtp({ type: "email", token_hash: link.data.properties.hashed_token });
  const session = verified.data.session;
  if (verified.error || !session || verified.data.user?.id !== userId || session.user.id !== userId) {
    if (session) await admin.auth.admin.signOut(session.access_token, "local");
    throw Error("Could not confirm sign-in.");
  }
  return { userId, access_token: session.access_token, refresh_token: session.refresh_token };
}
