import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { SpeechField } from "../../shared/ui/SpeechField";
import { TimeSelect } from "../../shared/ui/TimeSelect";
import { cloud } from "../../services/supabase/cloud";
import { parseReminderPreferences, defaultReminderTimes, normalizeReminderPhone, validReminderTimes, type ReminderChannel, type ReminderTimes, type ReminderPreferences } from "./reminders";

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
  return { preferences: parseReminderPreferences(result.preferences),
    available: "available" in result && result.available === true,
    textAvailable: "textAvailable" in result && result.textAvailable === true };
}

export function ReminderSettings({ signedIn }: { signedIn: boolean }) {
  const [preferences, setPreferences] = useState<ReminderPreferences | null>(null);
  const [channel, setChannel] = useState<"off" | ReminderChannel>("off");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [timeZone, setTimeZone] = useState(browserZone);
  const [times, setTimes] = useState<ReminderTimes>(defaultReminderTimes);
  const [consent, setConsent] = useState(false);
  const [available, setAvailable] = useState(false);
  const [textAvailable, setTextAvailable] = useState(false);
  const [busy, setBusy] = useState(signedIn);
  const [status, setStatus] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    setBusy(true);
    void reminderRequest(undefined, controller.signal).then(({ preferences: pref, available, textAvailable }) => {
      setPreferences(pref); setAvailable(available); setTextAvailable(textAvailable); setTimes(pref.times);
      setChannel(pref.enabled || pref.pending ? pref.channel : "off");
      setEmail(pref.email); setPhone(pref.phone); setTimeZone(pref.email || pref.phone ? pref.timeZone : browserZone());
      setConsent(pref.enabled || pref.pending);
      setStatus(available || textAvailable ? "" : "Reminders need setup. You can still turn existing reminders off.");
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "Could not load reminders.");
    }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [signedIn, refresh]);
  const channelReady = channel === "text" ? textAvailable && Boolean(normalizeReminderPhone(phone)) : available;

  return <section className="settings-card reminder-settings" aria-labelledby="reminders-title">
    <div className="settings-card-heading"><span className="settings-card-icon"><Bell aria-hidden="true" /></span><h2 id="reminders-title">Activity reminders</h2></div>
    <p>Choose a good morning or good night reminder, or a 4 PM reminder if you have not logged an activity.</p>
    {!signedIn ? <p>Sign in to set up reminders.</p> : <>
      <form onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setStatus("");
        try {
          const result = await reminderRequest({ action: "save", enabled: channel !== "off", channel,
            ...(channel === "text" ? { phone } : { email }), timeZone, consent, times });
          setPreferences(result.preferences); setAvailable(result.available); setTextAvailable(result.textAvailable); setTimes(result.preferences.times);
          setStatus(result.preferences.pending
            ? result.preferences.channel === "text" ? "Open the confirmation link in your text messages." : "Check your inbox and confirm your email to start reminders."
            : result.preferences.enabled ? "Activity reminders are on." : "Activity reminders are off.");
        } catch (error) { setStatus(error instanceof Error ? error.message : "Could not save reminders."); }
        finally { setBusy(false); }
      }}>
        <label htmlFor="reminder-channel">Remind me by</label>
        <select id="reminder-channel" value={channel} disabled={busy || !preferences} onChange={(event) => {
          const next = event.target.value;
          setChannel(next === "email" || next === "text" ? next : "off"); setConsent(false);
        }}>
          <option value="off">Off</option>
          <option value="email" disabled={!available}>Email</option>
          <option value="text" disabled={!textAvailable}>{textAvailable ? "Text message" : "Text message (not available yet)"}</option>
        </select>
        {channel !== "off" && <>
          {channel === "email" ? <>
            <label htmlFor="reminder-email">Your email</label>
            <SpeechField id="reminder-email" aria-label="Your email for reminders" type="email" autoComplete="email" maxLength={254} required value={email} disabled={busy} onValueChange={setEmail} />
          </> : <>
            <label htmlFor="reminder-phone">Your mobile number</label>
            <input id="reminder-phone" type="tel" autoComplete="tel" placeholder="+1 (555) 000-0000" maxLength={32}
              required value={phone} disabled={busy} onChange={(event) => { setPhone(event.target.value); setConsent(false); }} />
          </>}
          <label htmlFor="reminder-zone">Your time zone</label>
          <select id="reminder-zone" value={timeZone} disabled={busy} onChange={(event) => setTimeZone(event.target.value)}>
            {zones.map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ").replaceAll("/", " / ")}</option>)}
          </select>
          <fieldset className="reminder-times"><legend>When should we remind you?</legend>
            <div className="reminder-time-choice"><label><input type="checkbox" checked={times.morning !== null} disabled={busy}
              onChange={(event) => setTimes({ ...times, morning: event.target.checked ? 480 : null })} />Good morning</label>
              {times.morning !== null && <TimeSelect label="Morning reminder time" value={times.morning} disabled={busy} onChange={(morning) => setTimes({ ...times, morning })} />}
            </div>
            <div className="reminder-time-choice"><label><input type="checkbox" checked={times.afternoon} disabled={busy}
              onChange={(event) => setTimes({ ...times, afternoon: event.target.checked })} />4 PM, if I haven’t logged an activity</label></div>
            <div className="reminder-time-choice"><label><input type="checkbox" checked={times.evening !== null} disabled={busy}
              onChange={(event) => setTimes({ ...times, evening: event.target.checked ? 1260 : null })} />Good night</label>
              {times.evening !== null && <TimeSelect label="Night reminder time" value={times.evening} disabled={busy} onChange={(evening) => setTimes({ ...times, evening })} />}
            </div>
          </fieldset>
          {!validReminderTimes(times) && <p role="status">Choose at least one reminder.</p>}
          <label className="reminder-consent"><input type="checkbox" checked={consent} required disabled={busy} onChange={(event) => setConsent(event.target.checked)} />
            <span>{channel === "text" ? "Text me" : "Email me"} the reminders selected above in this time zone. I can turn them off at any time.</span></label>
          <p>{channel === "text"
            ? "Confirm your number by text. My Day sends up to three reminders per day, plus a confirmation text. Message and data rates may apply. Reply STOP to opt out or turn reminders off here."
            : "Confirm your email before reminders start. You can turn them off here or from a reminder email."}</p>
        </>}
        <button className="primary" disabled={busy || !preferences || (channel !== "off" && (!channelReady || !consent || !validReminderTimes(times)))}>{busy ? "Please wait…" : "Save reminders"}</button>
      </form>
      {preferences?.pending && <p>Your {preferences.channel === "text" ? "mobile number" : "email"} is waiting for confirmation.</p>}
      {preferences?.enabled && <p>{preferences.channel === "text" ? `Text reminders are on for ${preferences.phone}.` : `Email reminders are on for ${preferences.email}.`}</p>}
      <button type="button" className="secondary" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>Refresh reminder status</button>
    </>}
    {status && <p role="status">{status}</p>}
  </section>;
}
