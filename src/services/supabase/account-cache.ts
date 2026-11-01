import type { Session } from "@supabase/supabase-js";
import type { Snapshot } from "./cloud";
import { readData } from "../../domain/model";

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
