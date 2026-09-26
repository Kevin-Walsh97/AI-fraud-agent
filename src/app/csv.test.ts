import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import type { AlertRecord } from "./store";

const rec: AlertRecord = {
  id: "1",
  channel: "sms",
  sender: "+1 (202) 555-0199",
  label: '=HYPERLINK("http://evil") "quoted"',
  score: 88,
  level: "high",
  confidence: "high",
  reasons: ["Uses urgent language", "Suspicious link"],
  signalIds: [],
  flaggedAt: "2026-01-01T03:00:00.000Z",
};

describe("toCsv", () => {
  it("writes a header and escapes quotes and formula injection, but keeps phone numbers", () => {
    const [header, row] = toCsv([rec]).split("\r\n");
    expect(header.startsWith("flagged_at,channel,sender")).toBe(true);
    expect(row).toContain('"+1 (202) 555-0199"');
    expect(row).toContain(`"'=HYPERLINK(""http://evil"") ""quoted"""`);
    expect(row).toContain('"Uses urgent language; Suspicious link"');
  });
});
