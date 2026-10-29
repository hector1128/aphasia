import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { SpeechField } from "./SpeechField";
import { cloud } from "./cloud";
import { parseReminderPreferences, type ReminderPreferences } from "./reminders";

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const zones = [...new Set(["UTC", browserZone(), ...Intl.supportedValuesOf("timeZone")])].sort();
async function reminderRequest(body?: object, signal?: AbortSignal) {
  const session = cloud ? (await cloud.auth.getSession()).data.session : null;
  if (!session) throw Error("Sign in to manage reminders.");
  const response = await fetch("/api/reminders", { method: body ? "POST" : "GET", signal,
    headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) }).catch(() => { throw Error("Could not reach reminders. Please try again."); });
  const result: unknown = await response.json().catch(() => { throw Error("Could not read reminder settings. Please try again."); });
  if (!result || typeof result !== "object") throw Error("Could not read reminder settings.");
  if (!response.ok) throw Error("error" in result && typeof result.error === "string" ? result.error : "Could not update reminders.");
  if (!("preferences" in result)) throw Error("Could not read reminder settings.");
  return { preferences: parseReminderPreferences(result.preferences), available: "available" in result && result.available === true };
}

export function ReminderSettings({ signedIn }: { signedIn: boolean }) {
  const [preferences, setPreferences] = useState<ReminderPreferences | null>(null);
  const [channel, setChannel] = useState<"off" | "email">("off");
  const [email, setEmail] = useState("");
  const [timeZone, setTimeZone] = useState(browserZone);
  const [consent, setConsent] = useState(false);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(signedIn);
  const [status, setStatus] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    setBusy(true);
    void reminderRequest(undefined, controller.signal).then(({ preferences: pref, available }) => {
      setPreferences(pref); setAvailable(available);
      setChannel(pref.enabled || pref.pending ? "email" : "off");
      setEmail(pref.email); setTimeZone(pref.email ? pref.timeZone : browserZone());
      setConsent(pref.enabled || pref.pending);
      setStatus(available ? "" : "Email reminders need setup. You can still turn existing reminders off.");
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "Could not load reminders.");
    }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [signedIn, refresh]);

  return <section className="settings-card reminder-settings" aria-labelledby="reminders-title">
    <div className="settings-card-heading"><span className="settings-card-icon"><Bell aria-hidden="true" /></span><h2 id="reminders-title">Activity reminders</h2></div>
    <p>If you have not logged an activity by 4 PM, we can remind you to add one.</p>
    {!signedIn ? <p>Sign in to set up reminders.</p> : <>
      <form onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setStatus("");
        try {
          const result = await reminderRequest({ action: "save", enabled: channel === "email", email, timeZone, consent });
          setPreferences(result.preferences); setAvailable(result.available);
          setStatus(result.preferences.pending ? "Check your inbox and confirm your email to start reminders."
            : result.preferences.enabled ? "Email reminders are on." : "Email reminders are off.");
        } catch (error) { setStatus(error instanceof Error ? error.message : "Could not save reminders."); }
        finally { setBusy(false); }
      }}>
        <label htmlFor="reminder-channel">Remind me by</label>
        <select id="reminder-channel" value={channel} disabled={busy || !preferences} onChange={(event) => { setChannel(event.target.value === "email" ? "email" : "off"); if (event.target.value === "off") setConsent(false); }}>
          <option value="off">Off</option>
          <option value="email" disabled={!available}>Email</option>
          <option value="text" disabled>Text message — coming later</option>
        </select>
        {channel === "email" && <>
          <label htmlFor="reminder-email">Your email</label>
          <SpeechField id="reminder-email" aria-label="Your email for reminders" type="email" autoComplete="email" maxLength={254} required value={email} disabled={busy} onValueChange={setEmail} />
          <label htmlFor="reminder-zone">Your time zone</label>
          <select id="reminder-zone" value={timeZone} disabled={busy} onChange={(event) => setTimeZone(event.target.value)}>
            {zones.map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ").replaceAll("/", " / ")}</option>)}
          </select>
          <label className="reminder-consent"><input type="checkbox" checked={consent} required disabled={busy} onChange={(event) => setConsent(event.target.checked)} />
            <span>Email me a daily reminder at 4 PM in this time zone if I have not logged an activity.</span></label>
          <p>Confirm your email before reminders start. You can turn them off here or from a reminder email.</p>
        </>}
        <button className="primary" disabled={busy || !preferences || (channel === "email" && (!available || !consent))}>{busy ? "Please wait…" : "Save reminders"}</button>
      </form>
      {preferences?.pending && <p>Your email is waiting for confirmation.</p>}
      {preferences?.enabled && <p>Email reminders are on for {preferences.email}.</p>}
      <button type="button" className="secondary" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>Refresh reminder status</button>
    </>}
    {status && <p role="status">{status}</p>}
  </section>;
}
