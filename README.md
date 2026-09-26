# ScamShield — AI fraud detection agent (prototype)

A clickable prototype of a consumer app that warns people about scam **SMS messages, emails and phone calls**. Every alert comes with a 0–100 risk score and the reasons behind it. It runs entirely on the device, uses transparent rules (no ML yet), and never blocks communication.

This is the Phase 1 MVP scope from the product brief, built as a React + TypeScript web app. The detection engine (`src/engine`) is plain TypeScript with no DOM or React dependencies, so the same code can run in a React Native app, a Gmail web plugin, or a Node backend later.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine + CSV unit tests (vitest)
npm run build      # typecheck + production build
```

On first launch you go through onboarding. Afterwards:

| Tab | What it shows |
|---|---|
| **Messages** | SMS inbox. Open a thread to see the in-line alert (score badge, *why flagged*, recommendation, report/dismiss). You can still reply. You can also simulate your own incoming text. |
| **Mail** | Gmail-style inbox. The risk banner sits above the email, along with SPF/DKIM/DMARC results and attachments. Actions: report, move to spam, dismiss. Clean mail gets a subtle green check. |
| **Calls** | Pre-call screening on a mock incoming-call screen (decline / block / answer). Uses only caller ID, carrier attestation and number reputation. No audio is involved. |
| **History** | Every flagged item, filterable by channel, risk level and date. Exports to CSV. |
| **Insights** | Alerts by channel and risk level, the most common red flags, and rule precision estimated from your own feedback. |
| **Settings** | Channels, sensitivity, notifications, trusted senders, contacts, anonymous-feedback opt-in (with a preview of the exact payload), erase all data. |

## Risk scoring

`analyze(input, context)` in `src/engine/analyze.ts` returns a `RiskAssessment` containing the score, level, confidence, headline, recommended action and a list of `Signal`s. Each signal carries a user-facing reason, evidence, and the points it added.

| Signal | SMS | Email | Call | Points |
|---|---|---|---|---|
| Urgency language | ✓ | ✓ | | 15–25 (scales with matches) |
| Authority claim (bank, IRS, PayPal…) | ✓ | ✓ | caller-ID name | 15–20 |
| Requests credentials / sensitive data | ✓ | ✓ | | 25–35 |
| Payment by gift card / crypto / wire | ✓ | ✓ | | 20 |
| Threats (arrest, legal action) | ✓ | ✓ | | 15 |
| Suspicious / shortened / look-alike URL | ✓ | ✓ | | 15–25 |
| Link or domain in threat database | ✓ | ✓ | | 25–30 |
| SPF/DKIM/DMARC failure | | ✓ | | 20–30 (10 if no auth at all) |
| Domain spoofing (look-alike, display-name brand) | | ✓ | | 25–35 |
| Reply-To mismatch / free-mail "organization" | | ✓ | | 15 |
| Dangerous attachment (exe, macro, double ext.) | | ✓ | | 20–40 |
| Sender not in contacts | ✓ | | ✓ | 10–15 |
| Timing anomaly (00:00–05:00, bursts) | ✓ | | ✓ | 10 each |
| Number reputation (crowd reports) | | | ✓ | 10–40 |
| VoIP line | | | ✓ | 15 |
| Unverified caller ID / neighbor spoofing / invalid number | ✓ | | ✓ | 15–20 |
| One-ring premium area code | | | ✓ | 25 |
| Known contact / trusted sender | ✓ | ✓ | ✓ | −25 (ignored if spoofing evidence exists) |

**Levels:** 0–30 low (green check), 31–60 medium (yellow), 61–100 high (red, "Phishing detected — high confidence").

**Sensitivity** changes only *when* an alert appears. The score itself stays the same, so it can always be explained:

- strict: alert when score > 30
- balanced (default): alert when score > 40, matching the brief
- lenient: alert when score > 60

The brief puts both a medium band (31–60) and an alert threshold (> 40) in its default. Here, "balanced" follows the brief exactly: a 31–40 item counts as medium but only shows a quiet "below your alert threshold" note. "Strict" alerts on every medium item.

**Confidence** comes from how many *independent* signal categories fired. A threat-database hit always counts as high confidence.

Some false-positive guards:
- A text that delivers a verification code (e.g. "Your code is 123456") doesn't count as a sensitive-data request. The request rule only fires when the message asks you to send, reply with, or confirm the information.
- An email from a brand's official domain that passes DMARC doesn't count as an "authority claim".
- Free-mail domains such as gmail.com are never treated as an official brand.
- Brand-name substrings only count on label boundaries, so `purchase.com` isn't flagged as `chase` and `pineapple.com` isn't flagged as `apple`.

## Privacy

- Analysis is on-device. There is no backend and no network calls.
- History stores **no message bodies**, only the sender, a subject or short preview, and the assessment. It is encrypted with AES-256-GCM in IndexedDB using a **non-extractable** WebCrypto key (`src/app/secureStorage.ts`).
- Simulated messages exist only in memory and are gone on reload.
- Anonymous feedback is **opt-in**. The payload contains a SHA-256 hash of the sender, the score, which rules fired, and your action. The MVP has no server, so Settings shows you the queued payloads instead of sending them.
- CSV export protects against spreadsheet formula injection.

## File structure

```
src/
  engine/                 # platform-agnostic detection engine (reusable in React Native / plugin / backend)
    types.ts              # inputs (SMS/Email/Call), context, Signal, RiskAssessment
    analyze.ts            # channel analyzers, scoring, thresholds, copy
    text.ts               # urgency / authority / sensitive-request / payment / threat phrase detectors
    urls.ts               # URL extraction + shortener, IP, punycode, TLD, look-alike checks
    domains.ts            # brand registry, registrable domain, homoglyph + Levenshtein look-alike detection
    emailAuth.ts          # Authentication-Results parsing, attachment classification
    phone.ts              # normalization, neighbor spoofing, NANP validity, one-ring area codes
    threatIntel.ts        # offline threat snapshot (stand-in for URLhaus / PhishTank / Safe Browsing / number reports)
    analyze.test.ts       # scenario + helper tests
  app/                    # React UI
    App.tsx               # shell, tabs, toasts
    Onboarding.tsx        # 7-step onboarding (permissions → channels → sensitivity → trusted → alerts → review)
    SmsView.tsx / EmailView.tsx / CallView.tsx
    History.tsx / Insights.tsx / Settings.tsx / SettingsControls.tsx
    store.ts              # Zustand store (settings, alerts, feedback outbox) persisted via secureStorage
    secureStorage.ts      # AES-GCM encrypted IndexedDB storage
    useAssessments.ts     # scores message lists and records alerts
    feedback.ts / csv.ts / ui.tsx
  data/samples.ts         # demo contacts, texts, emails and calls (scams + legitimate)
```

## Simulated in the prototype vs. needed for production

| Area | Prototype | Production path |
|---|---|---|
| SMS access | Sample inbox + composer | Android: `SMS_RECEIVED` / default-SMS role. iOS: `ILMessageFilterExtension`, which only sees unknown senders and can't show in-thread UI, so iOS alerts would appear as filter categories plus in-app history. |
| Calls | Mock call screen | Android `CallScreeningService` (+ overlay). iOS CallKit Call Directory, which only supports pre-loaded labels/blocks with no live UI, so the reputation list is synced into the extension. |
| Email | Mock Gmail inbox | Gmail Add-on / Chrome extension with read-only OAuth. Parse real `Authentication-Results` headers (`parseAuthenticationResults` already exists). |
| Threat intel | Small static snapshot | Periodically synced local bundles (URLhaus, PhishTank, Safe Browsing hash-prefix API, crowdsourced number reports). Queries stay local. |
| Line type / STIR-SHAKEN | Provided on the call input / toy VoIP prefix list | Carrier verification status (Android `Call.Details.getCallerNumberVerificationStatus`) and LRN lookup. |
| Storage | IndexedDB + WebCrypto | SQLCipher / Keychain- or Keystore-backed keys on mobile. |

## Next steps

1. Wrap `src/engine` as a package and build a React Native shell with Android SMS and call-screening modules.
2. Build a Gmail add-on that runs the engine on the open message.
3. Keep threat-intel snapshots up to date, with signed updates.
4. Build a feedback backend once opt-in volume justifies it. That data becomes the training set for a Phase 2 ML model to run alongside these rules.
