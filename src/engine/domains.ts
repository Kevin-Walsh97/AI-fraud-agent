// Brand lookalike detection. In production this list would be much larger and
// ship with the threat-intel bundle; here it covers the brands in the demo.

export const BRANDS: Record<string, string[]> = {
  paypal: ["paypal.com"],
  apple: ["apple.com", "icloud.com"],
  amazon: ["amazon.com", "amazon.co.uk"],
  microsoft: ["microsoft.com", "outlook.com", "live.com", "office.com"],
  netflix: ["netflix.com"],
  google: ["google.com", "gmail.com"],
  bankofamerica: ["bankofamerica.com", "bofa.com"],
  chase: ["chase.com"],
  wellsfargo: ["wellsfargo.com"],
  usps: ["usps.com"],
  fedex: ["fedex.com"],
  irs: ["irs.gov"],
  coinbase: ["coinbase.com"],
};

const MULTI_PART_TLDS = ["co.uk", "com.au", "co.nz", "co.jp", "com.br"];

/** "login.secure.paypal.com" -> "paypal.com" */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.includes(lastTwo)) return parts.slice(-3).join(".");
  return lastTwo;
}

export function isOfficialDomain(host: string): string | null {
  const reg = registrableDomain(host);
  for (const [brand, domains] of Object.entries(BRANDS)) {
    if (domains.includes(reg)) return brand;
  }
  return null;
}

function swapHomoglyphs(s: string): string {
  return s
    .toLowerCase()
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/0/g, "o")
    .replace(/[1|!]/g, "l")
    .replace(/3/g, "e")
    .replace(/5/g, "s");
}

/** Collapse common homoglyph substitutions so "paypa1" and "rnicrosoft" compare equal to the real brand. */
export function normalizeHomoglyphs(s: string): string {
  return swapHomoglyphs(s).replace(/[-_.]/g, "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export interface LookalikeResult {
  brand: string;
  reason: string;
}

/**
 * Returns the impersonated brand if `host` is not an official domain but looks
 * like one: a near-miss spelling ("bankofameric.com"), a homoglyph swap
 * ("paypa1.com"), or the brand name embedded in an unrelated domain
 * ("paypal-secure-login.com", "paypal.com.verify-account.net").
 */
export function detectLookalike(host: string): LookalikeResult | null {
  const h = host.toLowerCase();
  if (isOfficialDomain(h)) return null;
  const reg = registrableDomain(h);
  const label = reg.split(".")[0];
  const normLabel = normalizeHomoglyphs(label);

  for (const [brand, domains] of Object.entries(BRANDS)) {
    for (const official of domains) {
      const officialLabel = official.split(".")[0];
      if (normLabel === officialLabel && label !== officialLabel) {
        return { brand, reason: `uses look-alike characters to imitate ${official}` };
      }
      const dist = levenshtein(normLabel, officialLabel);
      const maxDist = officialLabel.length >= 8 ? 2 : officialLabel.length >= 5 ? 1 : 0;
      if (dist > 0 && dist <= maxDist) {
        return { brand, reason: `is one or two letters off from ${official}` };
      }
    }
    // Brand as a whole label/segment ("paypal-login.com", "paypal.com.evil.net"),
    // or embedded anywhere for long, distinctive brand names.
    const segment = new RegExp(`(^|[-.])${brand}([-.]|$)`);
    if (segment.test(h) || segment.test(swapHomoglyphs(h)) || (brand.length >= 7 && normLabel.includes(brand))) {
      return { brand, reason: `contains "${brand}" but isn't owned by ${brand}` };
    }
  }
  return null;
}
