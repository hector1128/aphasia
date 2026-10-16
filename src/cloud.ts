import { cloudConfig } from "./cloud-config";
import { createClient } from "@supabase/supabase-js";
import { type Data, readData } from "./model";
const url = import.meta.env?.VITE_SUPABASE_URL || cloudConfig.url;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || cloudConfig.publishableKey;
export const cloud = url && key ? createClient(url, key) : null;
export type Snapshot = { data: Data; revision: number };
export function parseSnapshot(row: unknown): Snapshot {
  if (!row || typeof row !== "object" || !("revision" in row) || !("data" in row) ||
      typeof row.revision !== "number" || !Number.isSafeInteger(row.revision) || row.revision < 1 ||
      !row.data || typeof row.data !== "object" || !("version" in row.data) || row.data.version !== 2 ||
      !("name" in row.data) || typeof row.data.name !== "string" || !("entries" in row.data))
    throw Error("The synced log could not be read.");
  return { revision: row.revision, data: readData(JSON.stringify(row.data)) };
}
export async function loadSnapshot(): Promise<Snapshot | null> {
  if (!cloud) throw Error("Account setup is not complete.");
  const { data, error } = await cloud.from("patient_logs").select("data,revision").maybeSingle();
  if (error) throw error;
  return data ? parseSnapshot(data) : null;
}
export async function saveSnapshot(data: Data, revision: number): Promise<number> {
  if (!cloud) throw Error("Account setup is not complete.");
  const { data: next, error } = await cloud.rpc("save_my_day", { document_data: data, expected_revision: revision });
  if (error) throw error;
  if (typeof next !== "number" || !Number.isSafeInteger(next) || next <= revision) throw Error("Save was not confirmed.");
  return next;
}
