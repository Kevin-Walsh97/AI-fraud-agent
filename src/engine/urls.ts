import { detectLookalike, registrableDomain } from "./domains";
import type { ThreatIntel } from "./types";

export const URL_SHORTENERS = [
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "tiny.cc", "t.ly", "s.id",
];

// TLDs disproportionately used in phishing campaigns (per public abuse reports).
export const SUSPICIOUS_TLDS = [
  "xyz", "top", "click", "link", "info", "live", "online", "site", "shop",
  "icu", "buzz", "rest", "cfd", "sbs", "gq", "tk", "ml", "cf", "ga", "zip", "mov",
];

const FILE_EXTENSIONS = ["pdf", "doc", "docx", "docm", "xls", "xlsx", "xlsm", "exe", "jpg", "jpeg", "png", "gif", "txt", "html", "htm", "js", "csv"];

const URL_RE =
  /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s<>"')\]]*)?|https?:\/\/\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/[^\s<>"')\]]*)?)/gi;

export interface UrlFinding {
  url: string;
  host: string;
  issues: string[];
  shortened: boolean;
  lookalikeBrand?: string;
  inThreatDb: boolean;
}

export function extractUrls(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(URL_RE)) {
    const u = m[1].replace(/[.,;:!?]+$/, "");
    const hasScheme = /^https?:\/\//i.test(u);
    const tld = hostOf(u).split(".").pop() ?? "";
    // Bare "invoice.pdf" is a file name, not a link.
    if (!hasScheme && FILE_EXTENSIONS.includes(tld)) continue;
    // Skip the domain half of an email address.
    const start = m.index ?? 0;
    if (start > 0 && text[start - 1] === "@") continue;
    if (text[start + m[0].length] === "@") continue;
    out.add(u);
  }
  return [...out];
}

export function hostOf(url: string): string {
  const withScheme = /^https?:\/\//i.test(url) ? url : `http://${url}`;
  try {
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return url.split("/")[0].toLowerCase();
  }
}

export function analyzeUrl(url: string, intel: ThreatIntel): UrlFinding {
  const host = hostOf(url);
  const issues: string[] = [];
  const shortened = URL_SHORTENERS.includes(host);
  if (shortened) issues.push("shortened link hides the real destination");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) issues.push("points to a raw IP address");
  if (host.split(".").some((l) => l.startsWith("xn--"))) issues.push("uses encoded international characters (possible homograph)");
  const tld = host.split(".").pop() ?? "";
  if (SUSPICIOUS_TLDS.includes(tld)) issues.push(`uses a high-abuse domain ending (.${tld})`);
  if (/@/.test(url.replace(/^https?:\/\//i, "").split("/")[0])) issues.push("hides the real host behind an @ sign");
  if (host.split(".").length >= 5) issues.push("has an unusually deep subdomain chain");

  const look = detectLookalike(host);
  if (look) issues.push(`${registrableDomain(host)} ${look.reason}`);

  const inThreatDb = intel.isMaliciousUrl(url) || intel.isMaliciousDomain(host);
  return { url, host, issues, shortened, lookalikeBrand: look?.brand, inThreatDb };
}
