import type { CallInput, Contact, EmailInput, SmsInput } from "../engine";

// Timestamps are built relative to "today" so the demo always looks fresh.
function at(hour: number, minute = 0, daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const USER_PHONE = "+1 (415) 555-0100";

export const SAMPLE_CONTACTS: Contact[] = [
  { name: "Mom", phone: "+1 (415) 555-0142", email: "mom.walsh@gmail.com" },
  { name: "Alex (work)", phone: "+1 (628) 555-0177", email: "alex@acme-corp.com" },
  { name: "Dr. Patel's Office", phone: "+1 (650) 555-0110" },
];

export const SAMPLE_SMS: SmsInput[] = [
  {
    channel: "sms",
    id: "sms-1",
    from: "+1 (202) 555-0199",
    body: "USPS: Your package is on hold due to an incomplete address. Update your details within 24 hours or it will be returned: https://usps-redelivery.info/track",
    receivedAt: at(3, 12),
  },
  {
    channel: "sms",
    id: "sms-2",
    from: "+1 (415) 555-0142",
    body: "Hi hun, are we still on for dinner Sunday? Dad's making lasagna 🍝",
    receivedAt: at(18, 40),
  },
  {
    channel: "sms",
    id: "sms-3",
    from: "+1 (310) 555-0188",
    body: "Chase Fraud Alert: Unusual activity detected on your debit card. Reply with your card number and PIN to verify now or your account will be suspended. bit.ly/3xScAm1",
    receivedAt: at(9, 5),
  },
  {
    channel: "sms",
    id: "sms-4",
    from: "72975",
    body: "Your verification code is 482913. It expires in 10 minutes.",
    receivedAt: at(11, 22),
  },
  {
    channel: "sms",
    id: "sms-5",
    from: "+1 (628) 555-0177",
    body: "Running 10 min late to standup, start without me",
    receivedAt: at(8, 51),
  },
  {
    channel: "sms",
    id: "sms-6",
    from: "+1 (917) 555-0134",
    body: "Hi, this is your CEO. I need you to buy 5 Apple gift cards for a client right now. Keep this confidential, send me the codes ASAP.",
    receivedAt: at(14, 3),
  },
];

export const SAMPLE_EMAILS: EmailInput[] = [
  {
    channel: "email",
    id: "email-1",
    from: { name: "PayPal Security", address: "service@paypa1-secure.com" },
    replyTo: "recovery.team@protonmail.com",
    subject: "Action required: Your account has been limited",
    body: "Dear Customer,\n\nWe noticed unusual sign-in activity on your PayPal account. Your account has been suspended until you confirm your identity.\n\nPlease log in immediately and update your billing information to avoid permanent closure:\nhttp://paypa1-secure.com/login\n\nPayPal Security Team",
    receivedAt: at(7, 44),
    auth: { spf: "fail", dkim: "none", dmarc: "fail" },
  },
  {
    channel: "email",
    id: "email-2",
    from: { name: "Netflix", address: "info@mailer.netflix.com" },
    subject: "New on Netflix this week",
    body: "Hi there, here's what's new this week. Watch now at https://www.netflix.com/browse",
    receivedAt: at(10, 15),
    auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
  },
  {
    channel: "email",
    id: "email-3",
    from: { name: "Accounts Payable", address: "billing@acme-invoices.xyz" },
    subject: "Overdue invoice #88213 — final notice",
    body: "Hello,\n\nPlease see the attached overdue invoice. Payment must be made today to avoid legal action. Enable editing and content to view the document.",
    receivedAt: at(13, 2),
    auth: { spf: "softfail", dkim: "none", dmarc: "none" },
    attachments: [{ filename: "Invoice_88213.xlsm" }, { filename: "remittance.pdf.exe" }],
  },
  {
    channel: "email",
    id: "email-4",
    from: { name: "Alex", address: "alex@acme-corp.com" },
    subject: "Slides for Thursday",
    body: "Hey — attached are the slides for Thursday's review. Let me know if anything looks off.",
    receivedAt: at(16, 30),
    auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
    attachments: [{ filename: "Q3-review.pdf" }],
  },
  {
    channel: "email",
    id: "email-5",
    from: { name: "IRS Tax Refund", address: "irs.refunds.dept@gmail.com" },
    subject: "You are eligible for a tax refund of $1,284.00",
    body: "Our records show you are owed a refund. To receive it, verify your Social Security Number and bank routing number within 48 hours at https://irs-taxrefund.online/claim",
    receivedAt: at(2, 18, 1),
    auth: { spf: "pass", dkim: "pass", dmarc: "none" },
  },
  {
    channel: "email",
    id: "email-6",
    from: { name: "Bank of America", address: "alerts@bankofameric.com" },
    subject: "Unusual sign-in detected",
    body: "We detected an unusual sign-in to your Online Banking. If this wasn't you, verify your account at https://secure.bankofameric.com/verify",
    receivedAt: at(6, 55, 1),
    auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
  },
];

export const SAMPLE_CALLS: CallInput[] = [
  {
    channel: "call",
    id: "call-1",
    from: "+1 (888) 555-0143",
    callerName: "IRS",
    receivedAt: at(10, 2),
    attestation: "C",
  },
  {
    channel: "call",
    id: "call-2",
    from: "+1 (415) 555-0142",
    callerName: "Mom",
    receivedAt: at(19, 10),
    lineType: "mobile",
    attestation: "A",
  },
  {
    channel: "call",
    id: "call-3",
    from: "+1 (415) 555-0187",
    receivedAt: at(3, 30),
    attestation: "C",
    lineType: "voip",
  },
  {
    channel: "call",
    id: "call-4",
    from: "+1 (809) 555-0111",
    receivedAt: at(22, 47),
    attestation: "none",
  },
  {
    channel: "call",
    id: "call-5",
    from: "+1 (650) 555-0110",
    callerName: "Dr. Patel's Office",
    receivedAt: at(9, 30),
    lineType: "landline",
    attestation: "A",
  },
];
