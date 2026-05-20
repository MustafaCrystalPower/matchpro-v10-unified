# MatchPro API Endpoints Documentation

## Base URL
```
https://matchpro-[random].up.railway.app/api/trpc
```

## Authentication
All endpoints require valid JWT token in cookie or header:
```
Authorization: Bearer <jwt_token>
```

---

## Matches Endpoints

### Get All Matches
**Endpoint:** `GET /matches.list`

**Description:** Retrieve all matches with pagination

**Query Parameters:**
- `limit` (optional): Number of matches per page (default: 20)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by status (new, viewed, contacted, viewing_scheduled, negotiating, closed)

**Response:**
```json
{
  "result": {
    "data": [
      {
        "id": 1,
        "supplyId": 1,
        "demandId": 1,
        "matchScore": "85.5",
        "supplyContactPhone": "+201066505665",
        "supplyContactName": "Ahmed Hassan",
        "demandContactPhone": "+201234567890",
        "demandContactName": "Fatima Mohamed",
        "qualificationStatus": "qualified",
        "contactsVerified": 1,
        "status": "new",
        "matchSummary": "High-confidence match for Cairo villa",
        "createdAt": "2026-02-18T10:30:00Z"
      }
    ],
    "total": 475,
    "page": 1
  }
}
```

**Test Command:**
```bash
curl -X GET "https://matchpro-[random].up.railway.app/api/trpc/matches.list?limit=10" \
  -H "Cookie: session=<jwt_token>"
```

---

### Get Qualified Matches Only
**Endpoint:** `GET /matches.qualified`

**Description:** Retrieve only matches with "qualified" status (both contacts verified)

**Response:** Same as above, but filtered to qualified matches only

**Test Command:**
```bash
curl -X GET "https://matchpro-[random].up.railway.app/api/trpc/matches.qualified" \
  -H "Cookie: session=<jwt_token>"
```

---

### Qualify a Match
**Endpoint:** `POST /matches.qualify`

**Description:** Mark a match as qualified (both contacts verified)

**Request Body:**
```json
{
  "matchId": 1
}
```

**Response:**
```json
{
  "result": {
    "data": {
      "success": true,
      "matchId": 1,
      "qualificationStatus": "qualified",
      "message": "Match qualified successfully"
    }
  }
}
```

**Test Command:**
```bash
curl -X POST "https://matchpro-[random].up.railway.app/api/trpc/matches.qualify" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<jwt_token>" \
  -d '{"matchId": 1}'
```

---

### Add Match Feedback
**Endpoint:** `POST /matches.feedback`

**Description:** Rate a match (1-5 stars) to improve algorithm

**Request Body:**
```json
{
  "matchId": 1,
  "rating": 5,
  "feedback": "Excellent match, both parties very interested"
}
```

**Response:**
```json
{
  "result": {
    "data": {
      "success": true,
      "feedbackId": 42,
      "message": "Feedback recorded successfully"
    }
  }
}
```

**Test Command:**
```bash
curl -X POST "https://matchpro-[random].up.railway.app/api/trpc/matches.feedback" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<jwt_token>" \
  -d '{
    "matchId": 1,
    "rating": 5,
    "feedback": "Great match"
  }'
```

---

## Broker Analytics Endpoints

### Get Top Brokers
**Endpoint:** `GET /brokers.topBrokers`

**Description:** Get list of top brokers ranked by successful matches

**Query Parameters:**
- `limit` (optional): Number of brokers to return (default: 10)

**Response:**
```json
{
  "result": {
    "data": [
      {
        "brokerId": 1,
        "brokerPhone": "+201066505665",
        "brokerName": "Ahmed Hassan",
        "supplyCount": 45,
        "demandCount": 32,
        "successfulMatches": 28,
        "successRate": 87.5,
        "lastActive": "2026-02-18T15:30:00Z"
      }
    ]
  }
}
```

**Test Command:**
```bash
curl -X GET "https://matchpro-[random].up.railway.app/api/trpc/brokers.topBrokers?limit=10" \
  -H "Cookie: session=<jwt_token>"
```

---

### Get Broker Analytics
**Endpoint:** `GET /brokers.analytics`

**Description:** Get detailed analytics for a specific broker

**Query Parameters:**
- `brokerPhone` (required): Broker's phone number

**Response:**
```json
{
  "result": {
    "data": {
      "brokerPhone": "+201066505665",
      "brokerName": "Ahmed Hassan",
      "totalMessages": 127,
      "supplyMessages": 45,
      "demandMessages": 32,
      "unknownMessages": 50,
      "preferences": {
        "propertyTypes": ["villa", "apartment"],
        "locations": ["Cairo", "Giza"],
        "priceRange": { "min": 500000, "max": 5000000 }
      },
      "recentMatches": [
        {
          "matchId": 1,
          "score": 85.5,
          "status": "qualified"
        }
      ]
    }
  }
}
```

**Test Command:**
```bash
curl -X GET "https://matchpro-[random].up.railway.app/api/trpc/brokers.analytics?brokerPhone=%2B201066505665" \
  -H "Cookie: session=<jwt_token>"
```

---

## Market Intelligence Endpoints

### Get Hot Investment Zones
**Endpoint:** `GET /marketIntel.hotZones`

**Description:** Get locations with highest investment potential

**Query Parameters:**
- `limit` (optional): Number of zones to return (default: 20)
- `minScore` (optional): Minimum investment score (0-100, default: 75)

**Response:**
```json
{
  "result": {
    "data": [
      {
        "location": "New Cairo",
        "supplyCount": 45,
        "demandCount": 32,
        "matchCount": 28,
        "marketTemperature": "hot",
        "investmentScore": 92,
        "priceRange": { "min": 1000000, "max": 10000000 },
        "avgPrice": 4500000,
        "lastUpdated": "2026-02-18T10:00:00Z"
      }
    ]
  }
}
```

**Test Command:**
```bash
curl -X GET "https://matchpro-[random].up.railway.app/api/trpc/marketIntel.hotZones?limit=20&minScore=75" \
  -H "Cookie: session=<jwt_token>"
```

---

### Get Market Data by Location
**Endpoint:** `GET /marketIntel.byLocation`

**Description:** Get detailed market intelligence for a specific location

**Query Parameters:**
- `location` (required): Location name (e.g., "Cairo", "Giza")

**Response:**
```json
{
  "result": {
    "data": {
      "location": "Cairo",
      "supplyCount": 150,
      "demandCount": 120,
      "matchCount": 85,
      "marketTemperature": "warm",
      "investmentScore": 78,
      "supplyDemandRatio": 1.25,
      "avgPrice": 3200000,
      "priceRange": { "min": 500000, "max": 15000000 },
      "propertyTypes": {
        "villa": 45,
        "apartment": 60,
        "townhouse": 30,
        "land": 15
      },
      "trend": "increasing",
      "lastUpdated": "2026-02-18T10:00:00Z"
    }
  }
}
```

**Test Command:**
```bash
curl -X GET "https://matchpro-[random].up.railway.app/api/trpc/marketIntel.byLocation?location=Cairo" \
  -H "Cookie: session=<jwt_token>"
```

---

## User Profile Endpoints

### Get User Profile
**Endpoint:** `GET /users.profile`

**Description:** Get current user's profile and preferences

**Response:**
```json
{
  "result": {
    "data": {
      "userId": 1,
      "email": "mmaisara@crystalpowerinvestment.com",
      "name": "Moamen Maisara",
      "role": "admin",
      "userType": "investor",
      "preferences": {
        "propertyTypes": ["villa", "apartment"],
        "locations": ["Cairo", "New Cairo"],
        "priceRange": { "min": 1000000, "max": 10000000 },
        "requirements": "Modern amenities, good location"
      },
      "createdAt": "2026-02-01T10:00:00Z"
    }
  }
}
```

**Test Command:**
```bash
curl -X GET "https://matchpro-[random].up.railway.app/api/trpc/users.profile" \
  -H "Cookie: session=<jwt_token>"
```

---

### Update User Profile
**Endpoint:** `POST /users.updateProfile`

**Description:** Update user preferences and profile

**Request Body:**
```json
{
  "userType": "investor",
  "preferences": {
    "propertyTypes": ["villa", "apartment"],
    "locations": ["Cairo", "New Cairo", "Giza"],
    "priceRange": { "min": 1000000, "max": 15000000 },
    "requirements": "Modern, good location, high ROI potential"
  }
}
```

**Response:**
```json
{
  "result": {
    "data": {
      "success": true,
      "message": "Profile updated successfully",
      "userId": 1
    }
  }
}
```

**Test Command:**
```bash
curl -X POST "https://matchpro-[random].up.railway.app/api/trpc/users.updateProfile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<jwt_token>" \
  -d '{
    "userType": "investor",
    "preferences": {
      "propertyTypes": ["villa", "apartment"],
      "locations": ["Cairo", "New Cairo"],
      "priceRange": { "min": 1000000, "max": 15000000 },
      "requirements": "Modern amenities"
    }
  }'
```

---

## Notification Endpoints

### Get Notifications
**Endpoint:** `GET /notifications.list`

**Description:** Get user's notifications

**Query Parameters:**
- `unreadOnly` (optional): Show only unread notifications (default: false)
- `limit` (optional): Number of notifications (default: 20)

**Response:**
```json
{
  "result": {
    "data": [
      {
        "notificationId": 1,
        "title": "New Match Found",
        "content": "High-confidence match for Cairo villa",
        "type": "match",
        "read": false,
        "createdAt": "2026-02-18T15:30:00Z"
      }
    ],
    "unreadCount": 5
  }
}
```

**Test Command:**
```bash
curl -X GET "https://matchpro-[random].up.railway.app/api/trpc/notifications.list?unreadOnly=true" \
  -H "Cookie: session=<jwt_token>"
```

---

### Mark Notification as Read
**Endpoint:** `POST /notifications.markRead`

**Description:** Mark a notification as read

**Request Body:**
```json
{
  "notificationId": 1
}
```

**Response:**
```json
{
  "result": {
    "data": {
      "success": true,
      "notificationId": 1,
      "read": true
    }
  }
}
```

**Test Command:**
```bash
curl -X POST "https://matchpro-[random].up.railway.app/api/trpc/notifications.markRead" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<jwt_token>" \
  -d '{"notificationId": 1}'
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing authentication token"
  }
}
```

### 403 Forbidden
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource"
  }
}
```

### 404 Not Found
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### 400 Bad Request
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid request parameters"
  }
}
```

### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

---

## Testing Tips

1. **Use Postman or Insomnia** for API testing
2. **Set Authorization header** with valid JWT token
3. **Test with different user roles** (admin vs regular user)
4. **Verify response status codes** (200, 400, 401, 403, 404, 500)
5. **Check response data structure** matches documentation
6. **Test edge cases** (empty results, invalid IDs, etc.)
7. **Monitor Railway logs** for any errors
8. **Check database** to verify data was actually updated

---

## Admin-Only Endpoints

These endpoints require `role = 'admin'`:

- `GET /admin.users` - List all users
- `POST /admin.setRole` - Change user role
- `GET /admin.systemStats` - System statistics
- `POST /admin.resetData` - Reset test data (use with caution!)

---

## Rate Limiting

Current limits:
- **Public endpoints:** 100 requests/hour
- **Authenticated endpoints:** 1000 requests/hour
- **Admin endpoints:** 5000 requests/hour

---

## Webhook Events

### Match Created
```json
{
  "event": "match.created",
  "data": {
    "matchId": 1,
    "supplyContactPhone": "+201066505665",
    "demandContactPhone": "+201234567890",
    "matchScore": 85.5
  }
}
```

### Message Received
```json
{
  "event": "message.received",
  "data": {
    "messageId": 1,
    "sender": "+201066505665",
    "content": "Villa in Cairo for sale",
    "classification": "supply"
  }
}
```

---

## Support & Troubleshooting

For issues or questions:
1. Check Railway logs: `railway logs`
2. Verify environment variables are set
3. Test with curl commands above
4. Check database directly via Railway PostgreSQL panel
5. Contact: mmaisara@crystalpowerinvestment.com
