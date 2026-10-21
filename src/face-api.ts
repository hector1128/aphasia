import { cloud } from "./cloud";

export const FACE_CONSENT_VERSION = "face-trial-v1";
export type FaceStatus = { available: boolean; enrolled: boolean; registered: boolean; signInAvailable?: boolean };
export type FaceChallenge = { challengeId: string; message: string };

async function request<T>(path: string, body: object, signal?: AbortSignal): Promise<T> {
  const session = path === "/api/face" && cloud ? (await cloud.auth.getSession()).data.session : null;
  if (path === "/api/face" && !session) throw Error("Please sign in again.");
  const response = await fetch(path, {
    method: "POST", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(55000)]) : AbortSignal.timeout(55000),
    headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify(body),
  });
  let result;
  try { result = await response.json(); }
  catch { throw Error("Face verification is unavailable. You can keep using your password."); }
  if (!response.ok) throw Error(result.error || "Could not check your face. Please try again.");
  return result as T;
}
export const faceRequest = <T,>(body: object, signal?: AbortSignal) => request<T>("/api/face", body, signal);
export const faceLoginRequest = <T,>(body: object, signal?: AbortSignal) => request<T>("/api/face-login", body, signal);
