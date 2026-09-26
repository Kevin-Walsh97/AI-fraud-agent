import type { AuthResult, EmailInput } from "./types";

/**
 * Parses an RFC 8601 Authentication-Results header, e.g.
 *   "mx.google.com; spf=pass smtp.mailfrom=x.com; dkim=fail header.d=x.com; dmarc=fail"
 */
export function parseAuthenticationResults(header: string): NonNullable<EmailInput["auth"]> {
  const pick = (key: string): AuthResult => {
    const m = header.match(new RegExp(`\\b${key}=(pass|fail|softfail|neutral|none|temperror|permerror)`, "i"));
    if (!m) return "none";
    const v = m[1].toLowerCase();
    return v === "temperror" || v === "permerror" ? "fail" : (v as AuthResult);
  };
  return { spf: pick("spf"), dkim: pick("dkim"), dmarc: pick("dmarc") };
}

const DANGEROUS_EXT = ["exe", "scr", "js", "jse", "vbs", "vbe", "bat", "cmd", "com", "msi", "ps1", "hta", "jar", "lnk", "iso", "img", "wsf"];
const MACRO_EXT = ["docm", "xlsm", "pptm", "dotm", "xltm", "xlam"];
const ARCHIVE_EXT = ["zip", "rar", "7z"];
const HTML_EXT = ["html", "htm", "shtml", "svg"];

export interface AttachmentFinding {
  filename: string;
  issue: string;
  severity: "high" | "medium";
}

export function analyzeAttachment(filename: string): AttachmentFinding | null {
  const lower = filename.toLowerCase().trim();
  const parts = lower.split(".");
  const ext = parts.length > 1 ? parts.pop()! : "";
  const prev = parts.length > 1 ? parts[parts.length - 1] : "";
  if (DANGEROUS_EXT.includes(ext)) {
    if (["pdf", "doc", "docx", "jpg", "png", "xlsx", "txt"].includes(prev)) {
      return { filename, issue: `disguises a .${ext} program as a .${prev} file`, severity: "high" };
    }
    return { filename, issue: `is an executable file type (.${ext})`, severity: "high" };
  }
  if (MACRO_EXT.includes(ext)) return { filename, issue: `is a macro-enabled Office document (.${ext})`, severity: "high" };
  if (HTML_EXT.includes(ext)) return { filename, issue: "is an HTML attachment (commonly used for fake login pages)", severity: "medium" };
  if (ARCHIVE_EXT.includes(ext)) return { filename, issue: `is a compressed archive (.${ext}) that can hide malware`, severity: "medium" };
  return null;
}
