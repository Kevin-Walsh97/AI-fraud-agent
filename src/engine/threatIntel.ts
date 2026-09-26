import { registrableDomain } from "./domains";
import { normalizePhone } from "./phone";
import type { ThreatIntel } from "./types";

/**
 * Offline snapshot of threat feeds. In production this bundle would be synced
 * periodically from URLhaus, PhishTank, Google Safe Browsing (hash-prefix
 * lookups) and crowdsourced number reports, then queried locally so message
 * content never leaves the device.
 */
export interface ThreatSnapshot {
  domains: string[];
  urls: string[];
  numbers: Record<string, { reports: number; label?: string }>;
  voipPrefixes: string[];
}

export const DEMO_SNAPSHOT: ThreatSnapshot = {
  domains: [
    "usps-redelivery.info",
    "paypa1-secure.com",
    "irs-taxrefund.online",
    "amaz0n-orders.xyz",
    "wellsfargo-alerts.top",
    "coinbase-verify.site",
  ],
  urls: ["bit.ly/3xScAm1"],
  numbers: {
    "+18885550143": { reports: 312, label: "IRS impersonation" },
    "+12025550199": { reports: 87, label: "Fake bank fraud department" },
    "+18095550111": { reports: 1450, label: "One-ring callback scam" },
    "+14155550123": { reports: 41, label: "Auto warranty robocall" },
  },
  // Toy prefix list standing in for a carrier line-type (CNAM/LRN) lookup.
  voipPrefixes: ["+1202555", "+1415555", "+1888555"],
};

export function createThreatIntel(snapshot: ThreatSnapshot = DEMO_SNAPSHOT): ThreatIntel {
  const domains = new Set(snapshot.domains.map((d) => d.toLowerCase()));
  const urls = new Set(snapshot.urls.map((u) => stripScheme(u)));
  return {
    isMaliciousUrl: (url) => urls.has(stripScheme(url)),
    isMaliciousDomain: (host) => domains.has(host.toLowerCase()) || domains.has(registrableDomain(host)),
    numberReputation: (phone) => snapshot.numbers[normalizePhone(phone)] ?? null,
  };
}

export function isLikelyVoip(phone: string, snapshot: ThreatSnapshot = DEMO_SNAPSHOT): boolean {
  const n = normalizePhone(phone);
  return snapshot.voipPrefixes.some((p) => n.startsWith(p));
}

function stripScheme(u: string): string {
  return u.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}
