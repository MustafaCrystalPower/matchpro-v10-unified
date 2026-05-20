# MatchPro — No Outbound Messaging Policy

**Effective:** March 16, 2026  
**Status:** Enforced in code  
**Authority:** Crystal Power Investments — Mo'men Maisara, Founder & CEO

---

## Policy Statement

**MatchPro does not send messages to individuals under any circumstances.**

All property matching results, analytics, and insights are available exclusively within the MatchPro dashboard. No automated or manual message triggers exist in the platform workflow.

---

## Scope

This policy applies to all outbound communication channels, including but not limited to:

| Channel | Status |
|---|---|
| WhatsApp (Green API) | **Disabled — send functions return `false`** |
| Email (Gmail / SMTP) | **Disabled — send functions return `false`** |
| SMS | Not implemented |
| Push notifications to individuals | Not implemented |

---

## What the Platform Does

MatchPro is a **read-only real estate intelligence dashboard**. It performs the following operations internally:

1. **Reads** incoming WhatsApp group messages via Green API webhook (inbound only)
2. **Parses** messages using the NLP engine to extract supply and demand signals
3. **Matches** supply and demand using the scoring algorithm
4. **Displays** all results within the dashboard — Matches page, Analytics, Market Intelligence

No data leaves the system to external recipients.

---

## Code Enforcement

The following files have been permanently modified to disable all outbound sends:

| File | Change |
|---|---|
| `server/notificationService.ts` | All send functions return `false` with a console log |
| `server/whatsappAuth.ts` | `sendWhatsAppOTP()` returns `false` immediately |
| `server/whatsappMagicLink.ts` | `sendWhatsAppMessage()` returns `false` immediately |
| `server/matchingEngine.ts` | CRM auto-WhatsApp block removed |
| `server/morningDigest.ts` | Deleted |
| `server/greenApiHelper.ts` | Deleted |

---

## Test Coverage

**7 dedicated tests** in `server/greenapi.test.ts` verify that every outbound send function returns `false` and throws no errors. These tests run on every `pnpm test` execution.

---

## Green API — Permitted Uses

The Green API credentials remain active for **inbound operations only**:

- Reading incoming group messages (webhook)
- Checking instance connection status (admin panel)
- Displaying QR code for WhatsApp re-authentication (admin only)
- Admin logout from WhatsApp instance

No `sendMessage` API calls are made under any circumstances.

---

## Acceptance Criteria — Met

- [x] No messages (automated or manual) are sent from MatchPro to individuals
- [x] Matching and insights are accessible only within the platform
- [x] All messaging triggers are removed or permanently disabled
- [x] 163/163 tests pass confirming matching and insights remain fully operational
- [x] TypeScript clean — 0 errors
