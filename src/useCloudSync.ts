import { useEffect, useRef, useState } from "react";
import { type Data } from "./model";
import { type Account, accountCacheKey } from "./Accounts";
import { loadSnapshot, saveSnapshot, type Snapshot } from "./cloud";
export type SyncStatus = "saved" | "saving" | "offline" | "conflict";
export function useCloudSync(account: Account | undefined, data: Data, onRemote: (data: Data) => void) {
  const latest = useRef(data);
  latest.current = data;
  const state = useRef({ revision: account?.initial.revision ?? 0,
    saved: account?.dirty ? "" : JSON.stringify(data), busy: false, conflict: null as Snapshot | null });
  const [status, setStatus] = useState<SyncStatus>(account?.dirty ? "saving" : "saved");
  const active = useRef(true);
  const [localError, setLocalError] = useState(false);
  const cache = () => {
    if (!account) return;
    try {
      localStorage.setItem(accountCacheKey(account.session.user.id), JSON.stringify({
        data: latest.current, revision: state.current.revision,
        dirty: JSON.stringify(latest.current) !== state.current.saved,
      }));
      setLocalError(false);
    } catch { setLocalError(true); }
  };
  const sync = async () => {
    if (!account || state.current.busy || state.current.conflict) return false;
    state.current.busy = true;
    try {
      const remote = await loadSnapshot();
      if (!active.current) return false;
      const dirty = JSON.stringify(latest.current) !== state.current.saved;
      if ((remote?.revision ?? 0) !== state.current.revision) {
        if (!remote) throw Error("Synced log is unavailable.");
        if (dirty && JSON.stringify(remote.data) !== JSON.stringify(latest.current)) {
          state.current.conflict = remote; setStatus("conflict"); return false;
        }
        if (remote) {
          state.current.revision = remote.revision;
          state.current.saved = JSON.stringify(remote.data);
          latest.current = remote.data;
          onRemote(remote.data);
        }
      } else if (dirty) {
        setStatus("saving");
        const pending = latest.current;
        const revision = await saveSnapshot(pending, state.current.revision);
        if (!active.current) return false;
        state.current.revision = revision;
        state.current.saved = JSON.stringify(pending);
      }
      cache();
      const complete = JSON.stringify(latest.current) === state.current.saved;
      setStatus(complete ? "saved" : "saving");
      return complete;
    } catch { if (active.current) setStatus("offline"); return false; }
    finally { state.current.busy = false; }
  };
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => {
    if (!account) return;
    active.current = true;
    const refresh = () => { void syncRef.current(); };
    const interval = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => { active.current = false; clearInterval(interval); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [account]);
  useEffect(() => {
    if (!account) return;
    cache();
    if (JSON.stringify(data) !== state.current.saved && !state.current.conflict) setStatus("saving");
    const timer = setTimeout(() => { void syncRef.current(); }, 650);
    return () => clearTimeout(timer);
  }, [account, data]);
  const resolve = (choice: "cloud" | "device") => {
    const remote = state.current.conflict;
    if (!remote) return;
    if (choice === "cloud") {
      const url = URL.createObjectURL(new Blob([JSON.stringify(latest.current, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "my-day-unsynced-backup.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      latest.current = remote.data;
      onRemote(remote.data);
    }
    state.current.revision = remote.revision;
    state.current.saved = JSON.stringify(remote.data);
    state.current.conflict = null;
    cache();
    setStatus(choice === "cloud" ? "saved" : "saving");
    if (choice === "device") void syncRef.current();
  };
  return { status, sync, resolve, localError };
}
