import type { Channel, RiskLevel } from "../engine";

export type UserAction = "reported" | "dismissed" | "spam" | "blocked" | "answered" | "declined";

/** What leaves the device when the user opts in: no content, no raw sender. */
export interface FeedbackPayload {
  senderHash: string;
  channel: Channel;
  score: number;
  level: RiskLevel;
  signalIds: string[];
  action: UserAction;
  appVersion: string;
  sentAt: string;
}

export async function hashSender(sender: string): Promise<string> {
  const normalized = sender.trim().toLowerCase().replace(/[\s()-]/g, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Positive feedback means the user agreed it was a scam. */
export const confirmsScam = (a: UserAction) => a === "reported" || a === "spam" || a === "blocked" || a === "declined";
