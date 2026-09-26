import { describe, expect, it } from "vitest";
import { analyze, createThreatIntel, parseAuthenticationResults, type AnalysisContext } from "./index";
import { detectLookalike } from "./domains";
import { extractUrls } from "./urls";
import { analyzeAttachment } from "./emailAuth";
import { SAMPLE_CALLS, SAMPLE_CONTACTS, SAMPLE_EMAILS, SAMPLE_SMS, USER_PHONE } from "../data/samples";

const ctx = (over: Partial<AnalysisContext> = {}): AnalysisContext => ({
  sensitivity: "balanced",
  contacts: SAMPLE_CONTACTS,
  trustedSenders: ["72975"],
  recentEvents: [],
  userPhone: USER_PHONE,
  threatIntel: createThreatIntel(),
  ...over,
});

const localNoon = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

const byId = <T extends { id: string }>(list: T[], id: string) => list.find((m) => m.id === id)!;
const ids = (a: ReturnType<typeof analyze>) => a.signals.map((s) => s.id);

describe("SMS", () => {
  it("flags the USPS smishing text as high risk", () => {
    const a = analyze(byId(SAMPLE_SMS, "sms-1"), ctx());
    expect(a.level).toBe("high");
    expect(a.shouldAlert).toBe(true);
    expect(ids(a)).toEqual(expect.arrayContaining(["urgency", "authority", "threat-db-link", "unknown-sender", "odd-hour"]));
  });

  it("flags credential requests with shortened links", () => {
    const a = analyze(byId(SAMPLE_SMS, "sms-3"), ctx());
    expect(a.level).toBe("high");
    expect(ids(a)).toEqual(expect.arrayContaining(["sensitive-request", "suspicious-link", "threat-db-link"]));
    expect(a.recommendedAction).toMatch(/Never share/);
  });

  it("flags gift-card CEO fraud", () => {
    const a = analyze(byId(SAMPLE_SMS, "sms-6"), ctx());
    expect(a.shouldAlert).toBe(true);
    expect(ids(a)).toContain("payment");
  });

  it("does not flag a message from a known contact", () => {
    const a = analyze(byId(SAMPLE_SMS, "sms-2"), ctx());
    expect(a.score).toBe(0);
    expect(a.level).toBe("low");
    expect(a.shouldAlert).toBe(false);
    expect(a.headline).toBe("No issues detected");
  });

  it("does not flag a verification code from a trusted short code", () => {
    const a = analyze(byId(SAMPLE_SMS, "sms-4"), ctx());
    expect(a.shouldAlert).toBe(false);
  });

  it("adds a frequency signal when the same sender bursts messages", () => {
    const now = localNoon();
    const earlier = new Date(new Date(now).getTime() - 60_000).toISOString();
    const from = "+1 (303) 555-0150";
    const a = analyze(
      { channel: "sms", id: "x", from, body: "hello", receivedAt: now },
      ctx({ recentEvents: [{ from, at: earlier }, { from, at: earlier }] }),
    );
    expect(ids(a)).toContain("high-frequency");
  });
});

describe("Email", () => {
  it("flags the PayPal look-alike with failed DMARC as high confidence phishing", () => {
    const a = analyze(byId(SAMPLE_EMAILS, "email-1"), ctx());
    expect(a.level).toBe("high");
    expect(a.confidence).toBe("high");
    expect(a.headline).toBe("Phishing detected — high confidence");
    expect(ids(a)).toEqual(expect.arrayContaining(["dmarc-fail", "lookalike-domain", "reply-to-mismatch"]));
  });

  it("passes an authenticated marketing email from the real brand", () => {
    const a = analyze(byId(SAMPLE_EMAILS, "email-2"), ctx());
    expect(a.level).toBe("low");
    expect(a.shouldAlert).toBe(false);
  });

  it("flags macro and disguised-executable attachments", () => {
    const a = analyze(byId(SAMPLE_EMAILS, "email-3"), ctx());
    expect(a.level).toBe("high");
    const att = a.signals.find((s) => s.id === "attachment")!;
    expect(att.points).toBe(40);
    expect(a.recommendedAction).toMatch(/attachment/);
  });

  it("passes an authenticated email from a known contact with a PDF", () => {
    const a = analyze(byId(SAMPLE_EMAILS, "email-4"), ctx());
    expect(a.score).toBe(0);
  });

  it("flags agency impersonation from a free email account", () => {
    const a = analyze(byId(SAMPLE_EMAILS, "email-5"), ctx());
    expect(a.level).toBe("high");
    expect(ids(a)).toEqual(expect.arrayContaining(["display-name-spoof", "freemail-authority", "sensitive-request"]));
  });

  it("catches a typo-squatted bank domain even when SPF/DKIM pass", () => {
    const a = analyze(byId(SAMPLE_EMAILS, "email-6"), ctx());
    expect(ids(a)).toContain("lookalike-domain");
    expect(a.shouldAlert).toBe(true);
  });
});

describe("Calls", () => {
  it("warns on a reported IRS impersonation number", () => {
    const a = analyze(byId(SAMPLE_CALLS, "call-1"), ctx());
    expect(a.level).toBe("high");
    expect(a.headline).toMatch(/Likely scam call/);
    expect(ids(a)).toEqual(expect.arrayContaining(["number-reputation", "voip", "caller-name-authority"]));
  });

  it("does not warn on a verified call from a contact", () => {
    const a = analyze(byId(SAMPLE_CALLS, "call-2"), ctx());
    expect(a.shouldAlert).toBe(false);
    expect(a.score).toBe(0);
  });

  it("detects neighbor spoofing at night", () => {
    const a = analyze(byId(SAMPLE_CALLS, "call-3"), ctx());
    expect(ids(a)).toEqual(expect.arrayContaining(["neighbor-spoof", "voip", "odd-hour"]));
    expect(a.shouldAlert).toBe(true);
  });

  it("detects one-ring premium area codes", () => {
    const a = analyze(byId(SAMPLE_CALLS, "call-4"), ctx());
    expect(ids(a)).toContain("one-ring");
    expect(a.level).toBe("high");
  });
});

describe("Sensitivity", () => {
  it("changes the alert threshold without changing the score", () => {
    const msg = { channel: "sms" as const, id: "s", from: "+1 (303) 555-0150", body: "Your bank account needs attention, reply asap", receivedAt: localNoon() };
    const strict = analyze(msg, ctx({ sensitivity: "strict" }));
    const lenient = analyze(msg, ctx({ sensitivity: "lenient" }));
    expect(strict.score).toBe(lenient.score);
    expect(strict.score).toBeGreaterThan(30);
    expect(strict.shouldAlert).toBe(true);
    expect(lenient.shouldAlert).toBe(false);
  });
});

describe("helpers", () => {
  it("detects look-alike domains", () => {
    expect(detectLookalike("paypa1.com")?.brand).toBe("paypal");
    expect(detectLookalike("bankofameric.com")?.brand).toBe("bankofamerica");
    expect(detectLookalike("paypal.com.account-verify.net")?.brand).toBe("paypal");
    expect(detectLookalike("rnicrosoft.com")?.brand).toBe("microsoft");
    expect(detectLookalike("paypal.com")).toBeNull();
    expect(detectLookalike("purchase.com")).toBeNull();
    expect(detectLookalike("pineapple.com")).toBeNull();
    expect(detectLookalike("gmail.com")).toBeNull();
  });

  it("extracts links but not email addresses or file names", () => {
    expect(extractUrls("mail john.smith@acme.com about invoice.pdf then visit bit.ly/abc.")).toEqual(["bit.ly/abc"]);
  });

  it("classifies attachments", () => {
    expect(analyzeAttachment("a.pdf.exe")?.issue).toMatch(/disguises/);
    expect(analyzeAttachment("report.docm")?.severity).toBe("high");
    expect(analyzeAttachment("photo.jpg")).toBeNull();
  });

  it("parses Authentication-Results headers", () => {
    expect(parseAuthenticationResults("mx.google.com; spf=pass smtp.mailfrom=x.com; dkim=fail header.d=x.com; dmarc=permerror")).toEqual({
      spf: "pass",
      dkim: "fail",
      dmarc: "fail",
    });
  });
});

describe("sensitive requests", () => {
  const sms = (body: string) => ({ channel: "sms" as const, id: "s", from: "+1 (303) 555-0150", body, receivedAt: localNoon() });
  it("ignores codes being delivered", () => {
    const a = analyze(sms("Your verification code is 123456. Do not share this code with anyone."), ctx());
    expect(ids(a)).not.toContain("sensitive-request");
  });
  it("flags codes being requested", () => {
    const a = analyze(sms("We sent you a verification code. Reply with it to keep your account open."), ctx());
    expect(ids(a)).toContain("sensitive-request");
  });
});
