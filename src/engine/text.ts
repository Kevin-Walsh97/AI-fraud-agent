// Keyword/phrase detectors for social-engineering language. Patterns are
// matched case-insensitively on word boundaries.

export interface PhraseMatch {
  matches: string[];
}

function matchAll(text: string, patterns: RegExp[]): PhraseMatch {
  const found = new Set<string>();
  for (const p of patterns) {
    const m = text.match(p);
    if (m) found.add(m[0].toLowerCase().replace(/\s+/g, " ").trim());
  }
  return { matches: [...found] };
}

const w = (s: string) => new RegExp(`\\b${s}\\b`, "i");

export const URGENCY = [
  w("immediately"),
  w("urgent(?:ly)?"),
  w("act (?:now|fast|quickly)"),
  w("right now"),
  w("as soon as possible|asap"),
  w("within (?:24|48|12|2) ?(?:hours|hrs|h)"),
  w("today only"),
  w("final (?:notice|warning|reminder)"),
  w("last chance"),
  w("expires? (?:today|soon|tonight)"),
  w("time[- ]sensitive"),
  w("don'?t delay"),
  w("respond now"),
  w("verify (?:now|immediately|your)"),
  w("(?:account|card) (?:has been |will be |is )?(?:suspended|locked|disabled|frozen|closed)"),
  w("unusual (?:activity|sign[- ]in)"),
];

export const AUTHORITY = [
  w("irs"),
  w("internal revenue service"),
  w("hmrc"),
  w("social security(?: administration)?"),
  w("ssa"),
  w("medicare"),
  w("fbi"),
  w("police|sheriff"),
  w("customs"),
  w("paypal"),
  w("apple(?: id| support)?"),
  w("amazon"),
  w("microsoft|windows support"),
  w("netflix"),
  w("usps|fedex|ups|dhl|royal mail"),
  w("bank of america|chase|wells fargo|citi(?:bank)?|capital one|hsbc|barclays"),
  w("(?:your )?bank"),
  w("fraud (?:department|team|alert)"),
  w("security (?:team|department)"),
  w("tech(?:nical)? support"),
  w("dmv"),
  w("court|warrant"),
];

export const SENSITIVE = [
  w("password|passcode"),
  w("(?:one[- ]time |verification |security |otp )(?:code|pin)"),
  w("otp"),
  w("pin(?: number)?"),
  w("ssn|social security number"),
  w("account number"),
  w("routing number"),
  w("card number|credit card|debit card|cvv|cvc"),
  w("date of birth|dob"),
  w("mother'?s maiden name"),
  w("login (?:details|credentials)|credentials"),
  w("confirm your (?:identity|details|information|account)"),
  w("update your (?:payment|billing|account) (?:details|information|method)"),
];

export const PAYMENT = [
  w("gift ?cards?"),
  w("itunes card|google play card|steam card"),
  w("bitcoin|crypto(?:currency)?|usdt"),
  w("wire (?:transfer|the money)"),
  w("western union|moneygram"),
  w("zelle|venmo|cash ?app"),
  w("processing fee|release fee|customs fee|small fee"),
];

export const THREATS = [
  w("arrest(?:ed)?"),
  w("legal action"),
  w("lawsuit"),
  w("deport(?:ed|ation)?"),
  w("penalt(?:y|ies)"),
  w("will be (?:charged|fined|prosecuted)"),
];

export const detectUrgency = (t: string) => matchAll(t, URGENCY);
export const detectAuthority = (t: string) => matchAll(t, AUTHORITY);
const REQUEST_VERB = /\b(send|reply|text|share|provide|tell|give|confirm|enter|update|verify|submit|read|call|log ?in|sign ?in|click|tap)\b/i;

/**
 * Only counts sensitive terms when the message asks for something — so
 * "Your verification code is 123456" doesn't trip, but
 * "Reply with the verification code we sent" does.
 */
export function detectSensitiveRequest(t: string): PhraseMatch {
  const stripped = t.replace(/\b(?:do not|don'?t|never) (?:share|give|tell)[^.!?\n]*/gi, "");
  if (!REQUEST_VERB.test(stripped)) return { matches: [] };
  return matchAll(stripped, SENSITIVE);
}
export const detectPaymentPressure = (t: string) => matchAll(t, PAYMENT);
export const detectThreats = (t: string) => matchAll(t, THREATS);
