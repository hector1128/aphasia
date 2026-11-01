import type { Dispatch, SetStateAction } from "react";
import { BookOpen, Check, ChevronRight, RotateCcw, ShieldCheck, UserRound, Volume2 } from "lucide-react";
import { LEGACY_STORAGE_KEY, STORAGE_KEY, readData, type Data } from "../domain/model";
import type { useCloudSync } from "../services/supabase/useCloudSync";
import { FaceSettings } from "../features/face/FaceSettings";
import { ReminderSettings } from "../features/reminders/ReminderSettings";
import { ReportSettings } from "../features/reports/ReportSettings";
import { SpeechField } from "../shared/ui/SpeechField";

type SettingsProps = {
  data: Data;
  onDataChange: Dispatch<SetStateAction<Data>>;
  identity?: { userId: string; username: string };
  sync: Pick<ReturnType<typeof useCloudSync>, "status" | "sync" | "resolve">;
  name: string;
  onNameChange: (name: string) => void;
  onNotice: (message: string) => void;
  onReset: () => void;
  onTutorial: () => void;
  onSignOut: () => Promise<void>;
};

export function SettingsPage({ data, onDataChange, identity, sync, name, onNameChange, onNotice, onReset, onTutorial, onSignOut }: SettingsProps) {
  return (
    <div className="settings-page">
    <section className="settings-card" aria-labelledby="profile-title">
    <div className="settings-card-heading"><span className="settings-card-icon"><UserRound aria-hidden="true" /></span><h2 id="profile-title">Your profile</h2></div>
    <form
      className="settings-profile-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) {
          onDataChange((prev) => ({ ...prev, name: name.trim() }));
          onNotice("Name saved");
        }
      }}
    >
      <label htmlFor="edit-name">Your name</label>
      <SpeechField
        id="edit-name"
        aria-label="Your name"
        value={name}
        maxLength={40}
        onValueChange={onNameChange}
      />
      <button className="primary" disabled={!name.trim()}>
        Save name <Check />
      </button>
    </form>
    </section>
    <FaceSettings userId={identity?.userId} username={identity?.username ?? data.name} />
    <section className="settings-card read-aloud-settings" aria-labelledby="read-aloud-title">
      <div className="settings-card-heading"><span className="settings-card-icon"><Volume2 aria-hidden="true" /></span><h2 id="read-aloud-title">Read aloud</h2></div>
      <div className="settings-toggle-row"><span>Listen to words on the screen</span>
      <button className="settings-switch" role="switch" aria-label="Read aloud" aria-checked={data.readAloud}
        onClick={() => onDataChange((previous) => ({ ...previous, readAloud: !previous.readAloud }))}>
        <span aria-hidden="true" className="settings-switch-track"><span /></span>{data.readAloud ? "On" : "Off"}
      </button></div>
      <p>Touch: tap to listen, then tap again to choose. Mouse: pause over a label to listen.</p>
    </section>
    <section className="settings-card account-settings" aria-labelledby="account-title">
      <div className="settings-card-heading"><span className="settings-card-icon"><ShieldCheck aria-hidden="true" /></span><h2 id="account-title">Your account</h2></div>
      {identity ? <>
        <p>Signed in as <strong>{identity.username}</strong></p>
        <p className="settings-sync-status" role="status">{sync.status === "saved" ? "Your log is synced." : sync.status === "saving" ? "Saving your changes…" : sync.status === "offline" ? "Changes are saved on this device. Connect to sync." : "Another device changed your log."}</p>
        <div className="settings-actions">
        {sync.status === "offline" && <button className="secondary" onClick={() => void sync.sync()}>Try syncing</button>}
        {sync.status === "conflict" && <>
          <p>Choose which version to keep. Loading the synced log also downloads a backup of this device’s changes.</p>
          <button className="secondary" onClick={() => sync.resolve("cloud")}>Save backup and load synced log</button>
          <button className="secondary" onClick={() => sync.resolve("device")}>Keep this device’s changes</button>
        </>}
        <button className="secondary" disabled={sync.status !== "saved"} onClick={onSignOut}>Sign out</button>
        </div>
      </> : <p>Your log is saved on this browser. Account sign-in is not available on this website yet.</p>}
    </section>
    <section className="settings-card" aria-labelledby="tutorial-settings-title">
      <div className="settings-card-heading"><span className="settings-card-icon"><BookOpen aria-hidden="true" /></span><h2 id="tutorial-settings-title">App tutorial</h2></div>
      <p>Follow a short guide to using My Day. You can skip it at any time.</p>
      <button type="button" className="secondary" onClick={onTutorial}>Show tutorial</button>
    </section>
    <ReminderSettings signedIn={Boolean(identity)} />
    <ReportSettings data={data} onChange={onDataChange} />
    <details className="settings-card settings-data">
      <summary><span className="settings-card-icon"><RotateCcw aria-hidden="true" /></span><h2>Saved data</h2><ChevronRight className="settings-chevron" aria-hidden="true" /></summary>
      <div className="settings-card-content">
        {identity && !Object.keys(data.entries).length && !data.values.length && !Object.keys(data.ratings).length && !data.sleeps.length && !data.mindfulness.length && <button className="secondary" onClick={() => {
          try {
            const previous = readData(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY));
            if (Object.keys(previous.entries).length || previous.values.length || Object.keys(previous.ratings).length || previous.sleeps.length || previous.mindfulness.length) onDataChange({ ...previous, name: data.name });
            else onNotice("No existing browser log to import.");
          } catch { onNotice("Could not read the existing browser log."); }
        }}>Import this browser’s existing log</button>}
    <p>Clear your saved activities, values, and app preferences to start again. Turn off activity reminders above if you want to stop emails.</p>
    <button className="secondary reset-button" onClick={onReset}>
      Start over
    </button>
      </div>
    </details>
    </div>
  );
}
