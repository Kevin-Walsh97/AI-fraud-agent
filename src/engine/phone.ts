/** Normalizes to digits with a leading "+" when the input had a country code. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`; // assume NANP for the prototype
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}

export function samePhone(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b);
}

/** 5-6 digit SMS short codes are used by legitimate bulk senders. */
export function isShortCode(raw: string): boolean {
  return /^\d{4,6}$/.test(raw.replace(/\s/g, ""));
}

export function isValidNanp(num: string): boolean {
  // +1 NXX NXX XXXX where N = 2-9
  return /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(num);
}

/**
 * "Neighbor spoofing": scammers fake a caller ID sharing the user's area code
 * and exchange so the call looks local.
 */
export function isNeighborSpoof(caller: string, userPhone?: string): boolean {
  if (!userPhone) return false;
  const a = normalizePhone(caller);
  const b = normalizePhone(userPhone);
  if (a === b) return false;
  return a.startsWith("+1") && b.startsWith("+1") && a.slice(0, 8) === b.slice(0, 8);
}

// NANP area codes that route to Caribbean premium-rate lines ("one-ring" scams).
export const ONE_RING_AREA_CODES = ["268", "284", "473", "649", "664", "767", "809", "829", "849", "876"];

export function isOneRingAreaCode(num: string): boolean {
  const n = normalizePhone(num);
  return n.startsWith("+1") && ONE_RING_AREA_CODES.includes(n.slice(2, 5));
}
