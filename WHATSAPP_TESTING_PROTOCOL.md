# MatchPro WhatsApp End-to-End Testing Protocol

## Overview

This document defines the complete testing protocol for validating WhatsApp integration from message receipt through match generation. Every test must pass before the system is considered production-ready.

---

## Pre-Test Checklist

| Check | Status | How to Verify |
|-------|--------|---------------|
| Green API Instance ID configured | ☐ | Dashboard → Settings → WhatsApp shows Instance ID `7105409203` |
| Green API Token configured | ☐ | Environment variable `GREEN_API_TOKEN` is set |
| Webhook URL configured | ☐ | Green API settings point to `{APP_URL}/api/whatsapp/webhook` |
| WhatsApp authorized | ☐ | Green API state returns `authorized` |
| Database connected | ☐ | System Health Widget shows Database: OK |
| Matching engine active | ☐ | System Health Widget shows no errors |

---

## Phase 1: WhatsApp Connection Validation

### Test 1.1: Verify Green API Authorization
**Action:** Call Green API state endpoint
```
GET https://api.green-api.com/waInstance7105409203/getStateInstance/{TOKEN}
```
**Expected:** `{ "stateInstance": "authorized" }`
**Pass Criteria:** Status is `authorized`

### Test 1.2: Verify Webhook Configuration
**Action:** Call Green API settings endpoint
```
GET https://api.green-api.com/waInstance7105409203/getSettings/{TOKEN}
```
**Expected:** `webhookUrl` matches `{APP_URL}/api/whatsapp/webhook`
**Pass Criteria:** Webhook URL is correct and active

### Test 1.3: Verify Webhook Receives Messages
**Action:** Send a simple test message to the WhatsApp number +201066505665
```
Test message: "Hello MatchPro test"
```
**Expected:** Message appears in Live Message Feed within 10 seconds
**Pass Criteria:** Message logged in database with correct timestamp

---

## Phase 2: Message Ingestion & Classification

### Test 2.1: Supply Message (Arabic)
**Send to WhatsApp group:**
```
شقة للبيع في التجمع الخامس
3 غرف نوم - 180 متر
السعر: 2,500,000 جنيه
للتواصل: 01012345678 - أحمد
```
**Expected Classification:** SUPPLY
**Expected Extraction:**
- Property Type: apartment
- Location: التجمع الخامس (Fifth Settlement)
- Bedrooms: 3
- Area: 180 sqm
- Price: 2,500,000 EGP
- Contact Name: أحمد
- Contact Phone: 01012345678

### Test 2.2: Demand Message (Arabic)
**Send to WhatsApp group:**
```
مطلوب شقة في التجمع الخامس
2-3 غرف - ميزانية 2 مليون
محمد - 01098765432
```
**Expected Classification:** DEMAND
**Expected Extraction:**
- Property Type: apartment
- Location: التجمع الخامس (Fifth Settlement)
- Bedrooms: 2-3
- Budget: 2,000,000 EGP
- Contact Name: محمد
- Contact Phone: 01098765432

### Test 2.3: Supply Message (English)
**Send to WhatsApp group:**
```
Villa for sale in Mivida, New Cairo
4 bedrooms, 350 sqm, garden view
Price: 8,000,000 EGP
Contact: Sarah 01155667788
```
**Expected Classification:** SUPPLY
**Expected Extraction:**
- Property Type: villa
- Location: Mivida, New Cairo
- Bedrooms: 4
- Area: 350 sqm
- Price: 8,000,000 EGP
- Contact Name: Sarah
- Contact Phone: 01155667788

### Test 2.4: Demand Message (English)
**Send to WhatsApp group:**
```
Looking for a villa in Mivida or Madinaty
Budget up to 10M
Need 4+ bedrooms with garden
Call Ali: 01234567890
```
**Expected Classification:** DEMAND
**Expected Extraction:**
- Property Type: villa
- Location: Mivida / Madinaty
- Bedrooms: 4+
- Budget: 10,000,000 EGP
- Contact Name: Ali
- Contact Phone: 01234567890

### Test 2.5: Mixed/Ambiguous Message
**Send to WhatsApp group:**
```
عندي شقة 150 متر في مدينتي وعايز أبدلها بفيلا في التجمع
أحمد 01066505665
```
**Expected:** System classifies as BOTH supply (apartment in Madinaty) AND demand (villa in Fifth Settlement)
**Pass Criteria:** Both supply and demand records created with correct contact

---

## Phase 3: Match Generation & Validation

### Test 3.1: Direct Match Trigger
**Pre-condition:** Tests 2.1 and 2.2 completed successfully
**Expected Match:**
- Supply: أحمد's apartment in التجمع الخامس (2.5M)
- Demand: محمد's request for apartment in التجمع الخامس (2M budget)
- Match Score: Should be > 60% (location match + type match)
- Both contacts visible: أحمد (01012345678) ↔ محمد (01098765432)

### Test 3.2: High-Confidence Match
**Pre-condition:** Tests 2.3 and 2.4 completed successfully
**Expected Match:**
- Supply: Sarah's villa in Mivida (8M)
- Demand: Ali's request for villa in Mivida (10M budget)
- Match Score: Should be > 85% (location + type + price within budget)
- Both contacts visible: Sarah (01155667788) ↔ Ali (01234567890)
- Notification triggered (score > 85%)

### Test 3.3: Contact Verification on Match
**Validation Rule:** NO match should ever appear without BOTH contacts
**Check each match for:**

| Field | Required | Example |
|-------|----------|---------|
| Supply Contact Name | YES | أحمد / Sarah |
| Supply Contact Phone | YES | 01012345678 / 01155667788 |
| Demand Contact Name | YES | محمد / Ali |
| Demand Contact Phone | YES | 01098765432 / 01234567890 |
| Match Score | YES | 72% / 91% |
| Qualification Status | YES | qualified |

**FAIL if any match shows "Unknown" or empty contact fields**

---

## Phase 4: Dashboard Verification

### Test 4.1: Live Message Feed
**Check:** Messages from Phase 2 appear in real-time feed
**Pass Criteria:**
- Messages show within 10 seconds of receipt
- Each message shows sender name, timestamp, and classification badge (SUPPLY/DEMAND)
- Feed auto-refreshes

### Test 4.2: Statistics Cards
**Check:** Dashboard KPI cards update after test messages
**Pass Criteria:**
- Total Supply count increased by test supply messages
- Total Demand count increased by test demand messages
- Total Matches count increased by generated matches

### Test 4.3: System Health Widget
**Check:** Widget shows all green status
**Pass Criteria:**
- WhatsApp: Connected (green)
- Database: OK (green)
- Last Message Time: Shows recent timestamp
- No error messages displayed

### Test 4.4: Matches Page
**Check:** Navigate to Matches page
**Pass Criteria:**
- Test matches visible with both contacts prominently displayed
- Contact phone numbers are clickable (WhatsApp links)
- Match score and qualification status shown
- Filter and search working

---

## Phase 5: Export Validation

### Test 5.1: CSV Export
**Action:** Click "Export CSV" on Matches page
**Pass Criteria:**
- CSV downloads successfully
- Every row has Supply Contact Name + Phone
- Every row has Demand Contact Name + Phone
- No empty contact columns
- Match scores present and accurate

### Test 5.2: Data Accuracy Check
**Action:** Compare CSV data with dashboard display
**Pass Criteria:**
- All matches in CSV match dashboard data exactly
- Contact numbers match original WhatsApp messages
- Prices and locations are correctly extracted
- No duplicate matches

---

## Phase 6: Notification Validation

### Test 6.1: In-App Notification
**Trigger:** High-confidence match (>85%) from Test 3.2
**Pass Criteria:**
- Bell icon shows unread count
- Notification panel shows match details
- Both contacts visible in notification

### Test 6.2: WhatsApp Notification
**Trigger:** High-confidence match notification
**Pass Criteria:**
- WhatsApp message sent to admin (+201066505665)
- Message includes both contact numbers
- Message includes match summary

---

## Phase 7: Edge Cases

### Test 7.1: Duplicate Message Handling
**Action:** Send the same supply message twice
**Pass Criteria:** Only one supply record created (deduplication)

### Test 7.2: Message Without Contact
**Send:**
```
شقة للبيع في المعادي - 200 متر
```
**Pass Criteria:** Message stored but NOT matched (no contact = no match)

### Test 7.3: Invalid Phone Number
**Send:**
```
فيلا للبيع في الشيخ زايد
السعر 5 مليون
اتصل: 123
```
**Pass Criteria:** Message stored, contact marked as unverified, not matched until valid contact provided

---

## Test Results Summary Template

| Test ID | Description | Status | Notes |
|---------|-------------|--------|-------|
| 1.1 | Green API Authorization | ☐ Pass / ☐ Fail | |
| 1.2 | Webhook Configuration | ☐ Pass / ☐ Fail | |
| 1.3 | Webhook Receives Messages | ☐ Pass / ☐ Fail | |
| 2.1 | Supply Message (Arabic) | ☐ Pass / ☐ Fail | |
| 2.2 | Demand Message (Arabic) | ☐ Pass / ☐ Fail | |
| 2.3 | Supply Message (English) | ☐ Pass / ☐ Fail | |
| 2.4 | Demand Message (English) | ☐ Pass / ☐ Fail | |
| 2.5 | Mixed/Ambiguous Message | ☐ Pass / ☐ Fail | |
| 3.1 | Direct Match Trigger | ☐ Pass / ☐ Fail | |
| 3.2 | High-Confidence Match | ☐ Pass / ☐ Fail | |
| 3.3 | Contact Verification | ☐ Pass / ☐ Fail | |
| 4.1 | Live Message Feed | ☐ Pass / ☐ Fail | |
| 4.2 | Statistics Cards | ☐ Pass / ☐ Fail | |
| 4.3 | System Health Widget | ☐ Pass / ☐ Fail | |
| 4.4 | Matches Page | ☐ Pass / ☐ Fail | |
| 5.1 | CSV Export | ☐ Pass / ☐ Fail | |
| 5.2 | Data Accuracy | ☐ Pass / ☐ Fail | |
| 6.1 | In-App Notification | ☐ Pass / ☐ Fail | |
| 6.2 | WhatsApp Notification | ☐ Pass / ☐ Fail | |
| 7.1 | Duplicate Handling | ☐ Pass / ☐ Fail | |
| 7.2 | No Contact Message | ☐ Pass / ☐ Fail | |
| 7.3 | Invalid Phone | ☐ Pass / ☐ Fail | |

**Total: 22 tests | Pass: ___ | Fail: ___ | Score: ___%**

---

## Post-Test Actions

1. **All Pass:** System is production-ready. Proceed with Railway deployment.
2. **Any Fail:** Document failure, fix issue, re-run failed tests.
3. **Critical Fail (Phase 1):** WhatsApp connection issue - check Green API credentials and webhook URL.
4. **Critical Fail (Phase 3):** Matching engine issue - check NLP parser and matching algorithm.
