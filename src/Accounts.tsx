import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { cloud, loadSnapshot, type Snapshot } from "./cloud";
import { usernameAlias } from "./account-identity";
import { emptyData, readData } from "./model";
import { SpeechField } from "./SpeechField";
export type Account = { session: Session; username: string; initial: Snapshot; dirty: boolean };
export const accountCacheKey = (id: string) => `my-day-account-${id}`;
export function readAccountCache(id: string): (Snapshot & { dirty: boolean }) | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(accountCacheKey(id)) || "null");
    if (!value || typeof value !== "object" || !("revision" in value) || !("data" in value) || !("dirty" in value) ||
        typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 0) return null;
    return { revision: value.revision, data: readData(JSON.stringify(value.data)), dirty: value.dirty === true };
  } catch { return null; }
}
export function Accounts({ children }: { children: (account?: Account) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(cloud));
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    void cloud.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setError("Could not restore your sign-in. Please sign in again.");
      setSession(data.session); setLoading(false);
    });
    const { data } = cloud.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); if (!next) setAccount(null); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  const userId = session?.user.id;
  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoading(true); setError("");
    const username = typeof session.user.user_metadata.username === "string" ? session.user.user_metadata.username : "";
    const cache = readAccountCache(session.user.id);
    void loadSnapshot().then((snapshot) => {
      if (!active) return;
      const initial = cache?.dirty ? cache : snapshot ?? { data: { ...emptyData(), name: username }, revision: 0 };
      setAccount({ session, username, initial, dirty: cache?.dirty === true || !snapshot });
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      if (cache) setAccount({ session, username, initial: cache, dirty: cache.dirty });
      else setError("Could not load your log. Check your connection and try again.");
      setLoading(false);
    });
    return () => { active = false; };
    // Token refreshes keep the mounted account and its in-progress draft intact.
  }, [userId, retry]);
  if (!cloud) return children();
  if (loading) return <main className="account-page"><p role="status">Opening your log…</p></main>;
  if (!session) return <Login error={error} />;
  if (!account) return <main className="account-page"><p role="alert">{error}</p><button className="primary" onClick={() => setRetry((v) => v + 1)}>Try again</button><button className="secondary" onClick={() => void cloud?.auth.signOut()}>Sign out</button></main>;
  return children(account);
}
function Login({ error: initialError }: { error: string }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  return <main className="account-page">
    <img className="account-illustration" src="/images/welcome-adult.png" alt="An adult relaxing beside a book and plant" />
    <h1>{creating ? "Create your account" : "Welcome back"}</h1>
    <form onSubmit={async (event) => {
      event.preventDefault(); if (!cloud) return;
      setBusy(true); setError("");
      try {
        const email = await usernameAlias(name);
        if (creating) {
          const { data, error } = await cloud.auth.signUp({ email, password, options: { data: { username: name.trim() } } });
          if (error) throw Error(error.message.toLowerCase().includes("registered") ? "That name is taken. Try your full name or add a number." : error.message);
          if (!data.session) throw Error("Account setup needs attention. Please contact the person setting up My Day.");
        } else {
          const { error } = await cloud.auth.signInWithPassword({ email, password });
          if (error) throw Error("Name or password did not match. Please try again.");
        }
        setPassword("");
      } catch (error) { setError(error instanceof Error ? error.message : "Could not sign in. Try again."); }
      finally { setBusy(false); }
    }}>
      <label htmlFor="account-name">Your name (username)</label>
      <SpeechField id="account-name" aria-label="Your name for sign-in" autoComplete="username" required minLength={2} maxLength={60}
        value={name} onValueChange={setName} disabled={busy} />
      <label htmlFor="account-password">Password</label>
      <input id="account-password" type="password" autoComplete={creating ? "new-password" : "current-password"} required
        minLength={creating ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
      {creating && <p>Choose at least 8 characters. Keep your password somewhere safe.</p>}
      <button className="primary" disabled={busy}>{busy ? "Please wait…" : creating ? "Create account" : "Sign in"}</button>
    </form>
    <button className="secondary" disabled={busy} onClick={() => { setCreating(!creating); setError(""); }}>
      {creating ? "I already have an account" : "Create an account"}</button>
    {error && <p role="alert">{error}</p>}
  </main>;
}
