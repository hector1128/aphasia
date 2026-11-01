export function normalizeUsername(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
// Supabase Auth uses an internal, non-deliverable alias. The person signs in with their name.
export async function usernameAlias(name: string): Promise<string> {
  const normalized = normalizeUsername(name);
  if (normalized.length < 2 || normalized.length > 60 || /[\p{Cc}]/u.test(normalized)) throw Error("Enter a name between 2 and 60 characters.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hash}@accounts.myday.invalid`;
}
