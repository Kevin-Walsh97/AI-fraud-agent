export type Channel = "sms" | "email" | "call";
export type Sensitivity = "strict" | "balanced" | "lenient";
export type RiskLevel = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";
export type AuthResult = "pass" | "fail" | "softfail" | "neutral" | "none";

export interface SmsInput {
  channel: "sms";
  id: string;
  from: string;
  body: string;
  receivedAt: string; // ISO timestamp
}

export interface EmailAttachment {
  filename: string;
  mimeType?: string;
}

export interface EmailInput {
  channel: "email";
  id: string;
  from: { name?: string; address: string };
  replyTo?: string;
  subject: string;
  body: string;
  receivedAt: string;
  /** Parsed SPF/DKIM/DMARC results. Use parseAuthenticationResults() for a raw header. */
  auth?: { spf: AuthResult; dkim: AuthResult; dmarc: AuthResult };
  attachments?: EmailAttachment[];
}

export interface CallInput {
  channel: "call";
  id: string;
  from: string;
  callerName?: string;
  receivedAt: string;
  /** Carrier line-type lookup result, when available. */
  lineType?: "mobile" | "landline" | "voip" | "unknown";
  /** STIR/SHAKEN attestation level from the carrier (A = fully verified). */
  attestation?: "A" | "B" | "C" | "none";
}

export type MessageInput = SmsInput | EmailInput | CallInput;

export interface Contact {
  name: string;
  phone?: string;
  email?: string;
}

export interface RecentEvent {
  from: string;
  at: string;
}

export interface ThreatIntel {
  isMaliciousUrl(url: string): boolean;
  isMaliciousDomain(domain: string): boolean;
  numberReputation(phone: string): { reports: number; label?: string } | null;
}

export interface AnalysisContext {
  sensitivity: Sensitivity;
  contacts: Contact[];
  /** Emails, domains (e.g. "@mybank.com") or phone numbers the user trusts. */
  trustedSenders: string[];
  /** Recent inbound events, used for frequency anomalies. */
  recentEvents: RecentEvent[];
  /** The user's own number — used to detect "neighbor spoofing". */
  userPhone?: string;
  threatIntel: ThreatIntel;
}

export type SignalCategory =
  | "urgency"
  | "authority"
  | "sensitive-request"
  | "payment"
  | "threat"
  | "link"
  | "threat-database"
  | "sender"
  | "timing"
  | "authentication"
  | "spoofing"
  | "attachment"
  | "caller"
  | "trust";

export interface Signal {
  id: string;
  category: SignalCategory;
  /** One-line, user-facing reason ("Why flagged"). */
  reason: string;
  /** Supporting evidence, e.g. the matched words or URL. */
  evidence?: string[];
  /** Points added to the score (negative = mitigating). */
  points: number;
}

export interface RiskAssessment {
  messageId: string;
  channel: Channel;
  score: number;
  level: RiskLevel;
  confidence: Confidence;
  shouldAlert: boolean;
  alertThreshold: number;
  headline: string;
  recommendedAction: string;
  signals: Signal[];
  analyzedAt: string;
}
