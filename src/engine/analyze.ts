import { analyzeAttachment } from "./emailAuth";
import { detectLookalike, isOfficialDomain, registrableDomain, BRANDS } from "./domains";
import { isLikelyVoip } from "./threatIntel";
import { isNeighborSpoof, isOneRingAreaCode, isShortCode, isValidNanp, normalizePhone, samePhone } from "./phone";
import {
  detectAuthority,
  detectPaymentPressure,
  detectSensitiveRequest,
  detectThreats,
  detectUrgency,
} from "./text";
import type {
  AnalysisContext,
  CallInput,
  Channel,
  Confidence,
  EmailInput,
  MessageInput,
  RiskAssessment,
  RiskLevel,
  Sensitivity,
  Signal,
  SmsInput,
} from "./types";
import { analyzeUrl, extractUrls } from "./urls";

/** Alerts show when score > threshold. "balanced" matches the spec's default of 40. */
export const ALERT_THRESHOLDS: Record<Sensitivity, number> = {
  strict: 30,
  balanced: 40,
  lenient: 60,
};

export function levelFor(score: number): RiskLevel {
  if (score > 60) return "high";
  if (score > 30) return "medium";
  return "low";
}

const FREEMAIL = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "icloud.com", "proton.me", "protonmail.com", "gmx.com", "mail.com"];

const cap = (n: number, max: number) => Math.min(n, max);
const scaled = (base: number, step: number, count: number, max: number) => cap(base + step * (count - 1), max);

// ---------------------------------------------------------------------------
// Shared content checks (SMS body, email subject + body)
// ---------------------------------------------------------------------------

function contentSignals(text: string, opts: { authorityVerified?: boolean } = {}): Signal[] {
  const out: Signal[] = [];

  const urgency = detectUrgency(text).matches;
  if (urgency.length) {
    out.push({
      id: "urgency",
      category: "urgency",
      reason: "Uses urgent, pressuring language",
      evidence: urgency,
      points: scaled(15, 5, urgency.length, 25),
    });
  }

  const authority = detectAuthority(text).matches;
  if (authority.length && !opts.authorityVerified) {
    out.push({
      id: "authority",
      category: "authority",
      reason: "Claims to be from a bank, agency or well-known company",
      evidence: authority,
      points: authority.length > 1 ? 20 : 15,
    });
  }

  const sensitive = detectSensitiveRequest(text).matches;
  if (sensitive.length) {
    out.push({
      id: "sensitive-request",
      category: "sensitive-request",
      reason: "Asks for passwords, codes, or personal/financial details",
      evidence: sensitive,
      points: scaled(25, 5, sensitive.length, 35),
    });
  }

  const payment = detectPaymentPressure(text).matches;
  if (payment.length) {
    out.push({
      id: "payment",
      category: "payment",
      reason: "Requests payment by gift card, crypto, wire or payment app",
      evidence: payment,
      points: 20,
    });
  }

  const threats = detectThreats(text).matches;
  if (threats.length) {
    out.push({
      id: "threats",
      category: "threat",
      reason: "Threatens arrest, fines or legal action",
      evidence: threats,
      points: 15,
    });
  }

  return out;
}

function linkSignals(text: string, ctx: AnalysisContext): Signal[] {
  const findings = extractUrls(text).map((u) => analyzeUrl(u, ctx.threatIntel));
  const out: Signal[] = [];

  const risky = findings.filter((f) => f.issues.length > 0);
  if (risky.length) {
    const issueCount = risky.reduce((n, f) => n + f.issues.length, 0);
    out.push({
      id: "suspicious-link",
      category: "link",
      reason: risky.some((f) => f.lookalikeBrand)
        ? "Contains a link to a look-alike website"
        : risky.some((f) => f.shortened)
          ? "Contains a shortened link that hides where it goes"
          : "Contains a suspicious link",
      evidence: risky.map((f) => `${f.url} — ${f.issues.join("; ")}`),
      points: scaled(15, 5, issueCount, 25),
    });
  }

  const known = findings.filter((f) => f.inThreatDb);
  if (known.length) {
    out.push({
      id: "threat-db-link",
      category: "threat-database",
      reason: "Links to a site listed in phishing/malware threat databases",
      evidence: known.map((f) => f.url),
      points: known.length > 1 ? 30 : 25,
    });
  }
  return out;
}

function timingSignals(from: string, receivedAt: string, ctx: AnalysisContext, same: (a: string, b: string) => boolean): Signal[] {
  const out: Signal[] = [];
  const at = new Date(receivedAt);
  const hour = at.getHours();
  if (hour >= 0 && hour < 5) {
    out.push({
      id: "odd-hour",
      category: "timing",
      reason: "Arrived in the middle of the night",
      evidence: [at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })],
      points: 10,
    });
  }
  const windowMs = 15 * 60 * 1000;
  const burst = ctx.recentEvents.filter((e) => {
    const dt = at.getTime() - new Date(e.at).getTime();
    return dt >= 0 && dt <= windowMs && same(e.from, from);
  }).length;
  if (burst >= 2) {
    out.push({
      id: "high-frequency",
      category: "timing",
      reason: "Same sender contacted you repeatedly in a short time",
      evidence: [`${burst + 1} times in 15 minutes`],
      points: 10,
    });
  }
  return out;
}

function isTrusted(ctx: AnalysisContext, value: string): boolean {
  const v = value.toLowerCase().trim();
  return ctx.trustedSenders.some((t) => {
    const tl = t.toLowerCase().trim();
    if (!tl) return false;
    if (tl.startsWith("@")) return v.endsWith(tl);
    if (/\d/.test(tl) && /\d/.test(v) && !tl.includes("@")) return samePhone(tl, v);
    return tl === v;
  });
}

// ---------------------------------------------------------------------------
// Channel analyzers
// ---------------------------------------------------------------------------

function analyzeSms(msg: SmsInput, ctx: AnalysisContext): Signal[] {
  const signals = [...contentSignals(msg.body), ...linkSignals(msg.body, ctx)];

  const contact = ctx.contacts.find((c) => c.phone && samePhone(c.phone, msg.from));
  const trusted = isTrusted(ctx, msg.from);
  if (!contact && !trusted) {
    signals.push({
      id: "unknown-sender",
      category: "sender",
      reason: isShortCode(msg.from) ? "Sent from a short code not in your trusted list" : "Sender isn't in your contacts",
      evidence: [msg.from],
      points: isShortCode(msg.from) ? 10 : 15,
    });
  }
  if (!isShortCode(msg.from) && /^\+?\d/.test(msg.from) && !isValidNanp(normalizePhone(msg.from)) && normalizePhone(msg.from).startsWith("+1")) {
    signals.push({
      id: "invalid-number",
      category: "spoofing",
      reason: "Sender number isn't a valid phone number (likely spoofed)",
      evidence: [msg.from],
      points: 15,
    });
  }
  signals.push(...timingSignals(msg.from, msg.receivedAt, ctx, samePhone));
  if (contact || trusted) {
    signals.push(trustCredit(contact ? `Sender is in your contacts (${contact.name})` : "Sender is on your trusted list", signals));
  }
  return signals;
}

function analyzeEmail(msg: EmailInput, ctx: AnalysisContext): Signal[] {
  const signals: Signal[] = [];
  const address = msg.from.address.toLowerCase();
  const senderDomain = address.split("@")[1] ?? "";
  const senderReg = registrableDomain(senderDomain);
  // Free webmail domains belong to a brand, but anyone can send from them.
  const officialBrand = FREEMAIL.includes(senderReg) ? null : isOfficialDomain(senderDomain);
  const auth = msg.auth ?? { spf: "none", dkim: "none", dmarc: "none" };
  const authPassed = auth.dmarc === "pass" || (auth.spf === "pass" && auth.dkim === "pass");

  // Domain authentication
  const bad = (r: string) => r === "fail" || r === "softfail";
  if (bad(auth.dmarc)) {
    signals.push({
      id: "dmarc-fail",
      category: "authentication",
      reason: "Failed DMARC — the sender's domain did not authorize this email",
      evidence: [`SPF=${auth.spf}`, `DKIM=${auth.dkim}`, `DMARC=${auth.dmarc}`],
      points: 30,
    });
  } else if (bad(auth.spf) || bad(auth.dkim)) {
    signals.push({
      id: "auth-fail",
      category: "authentication",
      reason: "Failed sender authentication (SPF/DKIM)",
      evidence: [`SPF=${auth.spf}`, `DKIM=${auth.dkim}`, `DMARC=${auth.dmarc}`],
      points: 20,
    });
  } else if (auth.spf === "none" && auth.dkim === "none" && auth.dmarc === "none") {
    signals.push({
      id: "auth-missing",
      category: "authentication",
      reason: "Sender domain has no email authentication",
      points: 10,
    });
  }

  // Domain spoofing
  const look = detectLookalike(senderDomain);
  const nameBrand = brandInDisplayName(msg.from.name);
  if (look) {
    signals.push({
      id: "lookalike-domain",
      category: "spoofing",
      reason: `Sender domain imitates ${look.brand}`,
      evidence: [`${senderReg} ${look.reason}`],
      points: 35,
    });
  } else if (nameBrand && nameBrand !== officialBrand) {
    signals.push({
      id: "display-name-spoof",
      category: "spoofing",
      reason: `Display name says "${msg.from.name}" but the email comes from ${senderDomain}`,
      evidence: [msg.from.address],
      points: FREEMAIL.includes(senderReg) ? 30 : 25,
    });
  }

  // Contextual anomaly
  if (msg.replyTo) {
    const replyReg = registrableDomain(msg.replyTo.split("@")[1] ?? "");
    if (replyReg && replyReg !== senderReg) {
      signals.push({
        id: "reply-to-mismatch",
        category: "sender",
        reason: "Replies would go to a different address than the sender",
        evidence: [`From: ${msg.from.address}`, `Reply-To: ${msg.replyTo}`],
        points: 15,
      });
    }
  }

  const text = `${msg.subject}\n${msg.body}`;
  const authorityVerified = !!officialBrand && authPassed;
  const content = contentSignals(text, { authorityVerified });
  signals.push(...content);
  if (FREEMAIL.includes(senderReg) && (nameBrand || content.some((s) => s.category === "authority"))) {
    signals.push({
      id: "freemail-authority",
      category: "sender",
      reason: "Claims to be an organization but uses a free personal email account",
      evidence: [msg.from.address],
      points: 15,
    });
  }

  // Links — ignore links on the sender's own verified domain.
  const links = linkSignals(text, ctx);
  if (!authorityVerified) signals.push(...links);
  else signals.push(...links.filter((s) => s.category === "threat-database"));

  // Attachments
  const attFindings = (msg.attachments ?? []).map((a) => analyzeAttachment(a.filename)).filter((f) => f !== null);
  if (attFindings.length) {
    const high = attFindings.some((f) => f.severity === "high");
    signals.push({
      id: "attachment",
      category: "attachment",
      reason: high ? "Has a dangerous attachment that could install malware" : "Has an attachment type often used in attacks",
      evidence: attFindings.map((f) => `${f.filename} ${f.issue}`),
      points: high ? (attFindings.length > 1 ? 40 : 35) : 20,
    });
  }

  if (ctx.threatIntel.isMaliciousDomain(senderDomain)) {
    signals.push({
      id: "threat-db-sender",
      category: "threat-database",
      reason: "Sender domain is on a known phishing list",
      evidence: [senderDomain],
      points: 30,
    });
  }

  const trusted = isTrusted(ctx, address) || ctx.contacts.some((c) => c.email?.toLowerCase() === address);
  if (trusted && authPassed) signals.push(trustCredit("Sender is on your trusted list and passed authentication", signals));

  return signals;
}

function analyzeCall(call: CallInput, ctx: AnalysisContext): Signal[] {
  const signals: Signal[] = [];
  const number = normalizePhone(call.from);
  const contact = ctx.contacts.find((c) => c.phone && samePhone(c.phone, call.from));
  const trusted = isTrusted(ctx, call.from);

  const rep = ctx.threatIntel.numberReputation(number);
  if (rep && rep.reports > 0) {
    signals.push({
      id: "number-reputation",
      category: "threat-database",
      reason: `Reported ${rep.reports} times${rep.label ? ` as "${rep.label}"` : " as a scam"}`,
      evidence: [number],
      points: rep.reports >= 50 ? 40 : rep.reports >= 5 ? 25 : 10,
    });
  }

  if (call.lineType === "voip" || (call.lineType === undefined && isLikelyVoip(number))) {
    signals.push({
      id: "voip",
      category: "caller",
      reason: "Call is coming from an internet (VoIP) number",
      points: 15,
    });
  }

  if (!contact && !trusted && (call.attestation === "C" || call.attestation === "none")) {
    signals.push({
      id: "unverified-caller-id",
      category: "spoofing",
      reason: "Carrier could not verify this caller ID (possible spoofing)",
      evidence: [`STIR/SHAKEN attestation: ${call.attestation}`],
      points: 15,
    });
  }
  if (!contact && isNeighborSpoof(number, ctx.userPhone)) {
    signals.push({
      id: "neighbor-spoof",
      category: "spoofing",
      reason: "Number mimics your own area code and prefix (neighbor spoofing)",
      evidence: [number],
      points: 20,
    });
  }
  if (number.startsWith("+1") && !isValidNanp(number)) {
    signals.push({
      id: "invalid-number",
      category: "spoofing",
      reason: "Caller ID isn't a valid phone number (likely spoofed)",
      evidence: [call.from],
      points: 20,
    });
  }
  if (isOneRingAreaCode(number)) {
    signals.push({
      id: "one-ring",
      category: "caller",
      reason: "Area code is linked to premium-rate \"one-ring\" callback scams",
      evidence: [number.slice(2, 5)],
      points: 25,
    });
  }
  if (call.callerName && detectAuthority(call.callerName).matches.length && call.attestation !== "A") {
    signals.push({
      id: "caller-name-authority",
      category: "authority",
      reason: `Caller ID name claims "${call.callerName}" but isn't verified`,
      points: 15,
    });
  }
  if (!contact && !trusted) {
    signals.push({ id: "unknown-caller", category: "sender", reason: "Caller isn't in your contacts", points: 10 });
  }
  signals.push(...timingSignals(call.from, call.receivedAt, ctx, samePhone));
  if (contact || trusted) {
    signals.push(trustCredit(contact ? `Caller is in your contacts (${contact.name})` : "Caller is on your trusted list", signals));
  }
  return signals;
}

function brandInDisplayName(name?: string): string | null {
  if (!name) return null;
  const n = name.toLowerCase().replace(/[^a-z]/g, "");
  for (const brand of Object.keys(BRANDS)) if (brand.length >= 4 && n.includes(brand)) return brand;
  const agency = name.match(/\b(irs|internal revenue|social security|medicare|fbi|usps|fedex|ups|dhl|hmrc)\b/i);
  return agency ? agency[0].toLowerCase() : null;
}

/** A trusted sender lowers the score, but not when there's evidence it was spoofed. */
function trustCredit(reason: string, existing: Signal[]): Signal {
  const compromised = existing.some((s) => ["spoofing", "authentication", "threat-database"].includes(s.category));
  return { id: "trusted", category: "trust", reason: compromised ? `${reason} — but spoofing indicators override this` : reason, points: compromised ? 0 : -25 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyze(input: MessageInput, ctx: AnalysisContext): RiskAssessment {
  const signals =
    input.channel === "sms" ? analyzeSms(input, ctx) : input.channel === "email" ? analyzeEmail(input, ctx) : analyzeCall(input, ctx);

  const raw = signals.reduce((n, s) => n + s.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const level = levelFor(score);
  const threshold = ALERT_THRESHOLDS[ctx.sensitivity];
  const positive = signals.filter((s) => s.points > 0).sort((a, b) => b.points - a.points);

  return {
    messageId: input.id,
    channel: input.channel,
    score,
    level,
    confidence: confidenceFor(level, positive),
    shouldAlert: score > threshold,
    alertThreshold: threshold,
    headline: headlineFor(input.channel, level),
    recommendedAction: recommendationFor(input.channel, level, positive),
    signals: [...positive, ...signals.filter((s) => s.points <= 0)],
    analyzedAt: new Date().toISOString(),
  };
}

function confidenceFor(level: RiskLevel, positive: Signal[]): Confidence {
  const categories = new Set(positive.map((s) => s.category));
  if (level === "low") return categories.size === 0 ? "high" : categories.size === 1 ? "medium" : "low";
  if (categories.has("threat-database") || categories.size >= 4) return "high";
  return categories.size >= 2 ? "medium" : "low";
}

function headlineFor(channel: Channel, level: RiskLevel): string {
  if (channel === "call") {
    return level === "high" ? "Likely scam call — high confidence" : level === "medium" ? "This call has suspicious characteristics" : "No issues detected";
  }
  return level === "high" ? "Phishing detected — high confidence" : level === "medium" ? "This message has suspicious characteristics" : "No issues detected";
}

function recommendationFor(channel: Channel, level: RiskLevel, positive: Signal[]): string {
  if (level === "low") return "No action needed.";
  const has = (c: string) => positive.some((s) => s.category === c);
  if (channel === "call") {
    return level === "high"
      ? "Don't answer. If it claims to be your bank or a government agency, hang up and call the number on their official website."
      : "Let it go to voicemail, or answer cautiously and never share codes or personal details.";
  }
  if (has("attachment")) return "Don't open the attachment. Delete the email or report it as phishing.";
  if (has("payment")) return "No legitimate company or agency asks for payment by gift card, crypto or wire. Don't pay — report it.";
  if (has("sensitive-request")) return "Never share passwords, codes or account numbers. Contact the company directly using a number or website you trust.";
  if (has("link") || has("threat-database")) return "Don't open the link. Visit the company's website by typing the address yourself.";
  return "Be cautious. Verify the sender through another channel before acting.";
}
