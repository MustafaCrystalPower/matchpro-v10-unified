import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, uniqueIndex, tinyint, bigint, boolean } from "drizzle-orm/mysql-core";

/**
 * Organizations table - for multi-tenant data isolation
 * Each organization (broker firm, agency) gets their own isolated data view
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 128 }).unique(),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  inviteToken: varchar("inviteToken", { length: 256 }).unique(),
  isActive: int("isActive").default(1),
  plan: mysqlEnum("plan", ["free", "basic", "premium", "enterprise"]).default("free"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  organizationId: int("organizationId").references(() => organizations.id),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  whatsappVerified: int("whatsappVerified").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * WhatsApp messages table - stores all incoming group messages
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  messageId: varchar("messageId", { length: 128 }).unique(),
  chatId: varchar("chatId", { length: 128 }),
  groupName: varchar("groupName", { length: 256 }),
  sender: varchar("sender", { length: 128 }),
  senderName: varchar("senderName", { length: 256 }),
  messageText: text("messageText"),
  classification: mysqlEnum("classification", ["supply", "demand", "unknown"]),
  language: mysqlEnum("language", ["ar", "en", "mixed"]),
  hasImage: int("hasImage").default(0),
  imageUrl: text("imageUrl"),
  processed: int("processed").default(0),
  organizationId: int("organizationId").references(() => organizations.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Supply listings - properties for sale or rent
 */
export const supply = mysqlTable("supply", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").references(() => messages.id),
  propertyType: varchar("propertyType", { length: 64 }),
  location: varchar("location", { length: 256 }),
  area: varchar("area", { length: 128 }),
  city: varchar("city", { length: 128 }).default("Cairo"),
  price: decimal("price", { precision: 15, scale: 2 }),
  priceUnit: mysqlEnum("priceUnit", ["total", "per_sqm", "per_month"]).default("total"),
  priceType: mysqlEnum("priceType", ["cash", "installment", "both"]).default("cash"),
  cashPrice: decimal("cashPrice", { precision: 15, scale: 2 }),
  downPayment: decimal("downPayment", { precision: 15, scale: 2 }),
  installmentAmount: decimal("installmentAmount", { precision: 15, scale: 2 }),
  installmentYears: int("installmentYears"),
  size: int("size"),
  bedrooms: int("bedrooms"),
  bathrooms: int("bathrooms"),
  floor: int("floor"),
  purpose: mysqlEnum("purpose", ["sale", "rent"]),
  contact: varchar("contact", { length: 64 }).notNull(),
  contactName: varchar("contactName", { length: 256 }).notNull(),
  features: json("features"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  matched: int("matched").default(0),
  contactVerified: int("contactVerified").default(0),
  verifiedAt: timestamp("verifiedAt"),
  priority: mysqlEnum("priority", ["high", "medium", "low"]).default("medium"),
  reviewStatus: mysqlEnum("reviewStatus", ["auto_approved", "pending_review", "approved", "rejected"]).default("auto_approved"),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: varchar("reviewedBy", { length: 256 }),
  sourceGroup: varchar("sourceGroup", { length: 256 }),
  nlpVersion: varchar("nlpVersion", { length: 32 }).default("v2"),
  rawMessageText: text("rawMessageText"),
  organizationId: int("organizationId").references(() => organizations.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Supply = typeof supply.$inferSelect;
export type InsertSupply = typeof supply.$inferInsert;

/**
 * Demand requests - properties being sought
 */
export const demand = mysqlTable("demand", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").references(() => messages.id),
  propertyType: varchar("propertyType", { length: 64 }),
  location: varchar("location", { length: 256 }),
  area: varchar("area", { length: 128 }),
  city: varchar("city", { length: 128 }).default("Cairo"),
  priceMin: decimal("priceMin", { precision: 15, scale: 2 }),
  priceMax: decimal("priceMax", { precision: 15, scale: 2 }),
  sizeMin: int("sizeMin"),
  sizeMax: int("sizeMax"),
  bedrooms: int("bedrooms"),
  bathrooms: int("bathrooms"),
  purpose: mysqlEnum("purpose", ["sale", "rent"]),
  contact: varchar("contact", { length: 64 }).notNull(),
  contactName: varchar("contactName", { length: 256 }).notNull(),
  requirements: json("requirements"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  matched: int("matched").default(0),
  contactVerified: int("contactVerified").default(0),
  verifiedAt: timestamp("verifiedAt"),
  priority: mysqlEnum("priority", ["high", "medium", "low"]).default("medium"),
  reviewStatus: mysqlEnum("reviewStatus", ["auto_approved", "pending_review", "approved", "rejected"]).default("auto_approved"),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: varchar("reviewedBy", { length: 256 }),
  sourceGroup: varchar("sourceGroup", { length: 256 }),
  nlpVersion: varchar("nlpVersion", { length: 32 }).default("v2"),
  rawMessageText: text("rawMessageText"),
  organizationId: int("organizationId").references(() => organizations.id),
  // Buyer Intent Classification (0-100 score + tier label)
  buyerIntentScore: int("buyerIntentScore").default(50),
  buyerTier: mysqlEnum("buyerTier", ["direct_buyer", "broker_with_request", "speculative"]).default("broker_with_request"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Demand = typeof demand.$inferSelect;
export type InsertDemand = typeof demand.$inferInsert;

/**
 * Matches table - pairs supply with demand
 */
export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  supplyId: int("supplyId").references(() => supply.id),
  demandId: int("demandId").references(() => demand.id),
  matchScore: decimal("matchScore", { precision: 5, scale: 2 }).notNull(),
  locationScore: decimal("locationScore", { precision: 5, scale: 2 }),
  priceScore: decimal("priceScore", { precision: 5, scale: 2 }),
  specsScore: decimal("specsScore", { precision: 5, scale: 2 }),
  // Supply contact info - REQUIRED for display
  supplyContactPhone: varchar("supplyContactPhone", { length: 64 }).notNull(),
  supplyContactName: varchar("supplyContactName", { length: 256 }).notNull(),
  // Demand contact info - REQUIRED for display
  demandContactPhone: varchar("demandContactPhone", { length: 64 }).notNull(),
  demandContactName: varchar("demandContactName", { length: 256 }).notNull(),
  transactionType: mysqlEnum("transactionType", ["sale", "rent"]),
  status: mysqlEnum("status", ["new", "viewed", "contacted", "viewing_scheduled", "negotiating", "closed"]).default("new"),
  notified: int("notified").default(0),
  notifiedAt: timestamp("notifiedAt"),
  brokerPhone: varchar("brokerPhone", { length: 30 }),
  matchSummary: text("matchSummary"),
  matchExplanation: text("matchExplanation"),
  notes: text("notes"),
  viewingScheduledAt: timestamp("viewingScheduledAt"),
  lastContactedAt: timestamp("lastContactedAt"),
  qualificationStatus: mysqlEnum("qualificationStatus", ["pending", "qualified", "rejected"]).default("pending"),
  contactsVerified: int("contactsVerified").default(1),
  organizationId: int("organizationId").references(() => organizations.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/**
 * WhatsApp groups being monitored
 */
export const whatsappGroups = mysqlTable("whatsappGroups", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chatId", { length: 128 }).unique(),
  groupName: varchar("groupName", { length: 256 }),
  messageCount: int("messageCount").default(0),
  supplyCount: int("supplyCount").default(0),
  demandCount: int("demandCount").default(0),
  isActive: int("isActive").default(1),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WhatsappGroup = typeof whatsappGroups.$inferSelect;
export type InsertWhatsappGroup = typeof whatsappGroups.$inferInsert;

/**
 * System notifications for high-confidence matches
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["high_match", "new_supply", "new_demand", "system"]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content"),
  matchId: int("matchId").references(() => matches.id),
  isRead: int("isRead").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;


/**
 * Bookmarked/saved property listings
 */
export const bookmarks = mysqlTable("bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  supplyId: int("supplyId").references(() => supply.id),
  demandId: int("demandId").references(() => demand.id),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = typeof bookmarks.$inferInsert;

/**
 * Match feedback/ratings from users
 */
export const matchFeedback = mysqlTable("matchFeedback", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").references(() => matches.id).notNull(),
  userId: int("userId").references(() => users.id),
  rating: int("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  helpful: int("helpful").default(0), // 1 = helpful, 0 = not helpful
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MatchFeedback = typeof matchFeedback.$inferSelect;
export type InsertMatchFeedback = typeof matchFeedback.$inferInsert;

/**
 * Property amenities for filtering
 */
export const amenities = mysqlTable("amenities", {
  id: int("id").autoincrement().primaryKey(),
  supplyId: int("supplyId").references(() => supply.id),
  demandId: int("demandId").references(() => demand.id),
  hasPool: int("hasPool").default(0),
  hasBalcony: int("hasBalcony").default(0),
  hasGarden: int("hasGarden").default(0),
  hasParking: int("hasParking").default(0),
  hasElevator: int("hasElevator").default(0),
  hasSecurity: int("hasSecurity").default(0),
  hasGym: int("hasGym").default(0),
  hasFurnished: int("hasFurnished").default(0),
  hasAC: int("hasAC").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Amenity = typeof amenities.$inferSelect;
export type InsertAmenity = typeof amenities.$inferInsert;


/**
 * User notification preferences - channels for receiving alerts
 */
export const notificationPreferences = mysqlTable("notificationPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  emailEnabled: int("emailEnabled").default(1),
  emailAddress: varchar("emailAddress", { length: 320 }),
  whatsappEnabled: int("whatsappEnabled").default(1),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  highMatchThreshold: int("highMatchThreshold").default(85), // Notify when match score >= this
  notifyNewSupply: int("notifyNewSupply").default(0),
  notifyNewDemand: int("notifyNewDemand").default(0),
  notifyHighMatch: int("notifyHighMatch").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

/**
 * Authorized admin emails - users with these emails get admin access
 */
export const authorizedAdmins = mysqlTable("authorizedAdmins", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 256 }),
  phone: varchar("phone", { length: 32 }),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuthorizedAdmin = typeof authorizedAdmins.$inferSelect;
export type InsertAuthorizedAdmin = typeof authorizedAdmins.$inferInsert;

/**
 * Market intelligence snapshots - aggregated supply/demand by location
 * Admin-only access for investor monetization
 */
export const marketIntelligence = mysqlTable("marketIntelligence", {
  id: int("id").autoincrement().primaryKey(),
  location: varchar("location", { length: 256 }).notNull(),
  area: varchar("area", { length: 128 }),
  city: varchar("city", { length: 128 }).default("Cairo"),
  supplyCount: int("supplyCount").default(0),
  demandCount: int("demandCount").default(0),
  avgSupplyPrice: decimal("avgSupplyPrice", { precision: 15, scale: 2 }),
  avgDemandPriceMin: decimal("avgDemandPriceMin", { precision: 15, scale: 2 }),
  avgDemandPriceMax: decimal("avgDemandPriceMax", { precision: 15, scale: 2 }),
  supplyDemandRatio: decimal("supplyDemandRatio", { precision: 5, scale: 2 }),
  hotScore: int("hotScore").default(0), // 0-100 indicating market activity
  propertyTypes: json("propertyTypes"), // { apartment: 10, villa: 5, ... }
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MarketIntelligence = typeof marketIntelligence.$inferSelect;
export type InsertMarketIntelligence = typeof marketIntelligence.$inferInsert;

/**
 * Investor subscriptions - for future monetization of market intelligence
 */
export const investorSubscriptions = mysqlTable("investorSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  plan: mysqlEnum("plan", ["free", "basic", "premium", "enterprise"]).default("free"),
  accessLevel: mysqlEnum("accessLevel", ["none", "limited", "full"]).default("none"),
  locationsAccess: json("locationsAccess"), // Array of locations they can view
  expiresAt: timestamp("expiresAt"),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InvestorSubscription = typeof investorSubscriptions.$inferSelect;
export type InsertInvestorSubscription = typeof investorSubscriptions.$inferInsert;

/**
 * User profiles - stores user preferences and requirements for personalized matching
 */
export const userProfiles = mysqlTable("userProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull().unique(),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  userType: mysqlEnum("userType", ["buyer", "seller", "investor", "agent"]).notNull(),
  propertyType: varchar("propertyType", { length: 64 }), // apartment, villa, townhouse, etc.
  location: varchar("location", { length: 256 }),
  area: varchar("area", { length: 128 }),
  city: varchar("city", { length: 128 }).default("Cairo"),
  priceMin: decimal("priceMin", { precision: 15, scale: 2 }),
  priceMax: decimal("priceMax", { precision: 15, scale: 2 }),
  sizeMin: int("sizeMin"),
  sizeMax: int("sizeMax"),
  bedrooms: int("bedrooms"),
  bathrooms: int("bathrooms"),
  purpose: mysqlEnum("purpose", ["sale", "rent"]),
  requirements: json("requirements"), // Amenities and special requirements
  notifyOnMatch: int("notifyOnMatch").default(1),
  notifyViaWhatsapp: int("notifyViaWhatsapp").default(1),
  notifyViaEmail: int("notifyViaEmail").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * Custom notifications - personalized alerts sent to users
 */
export const customNotifications = mysqlTable("customNotifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull(),
  matchId: int("matchId").references(() => matches.id),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message"),
  notificationType: mysqlEnum("notificationType", ["personalized_match", "price_update", "new_property", "custom"]).notNull(),
  channel: mysqlEnum("channel", ["in_app", "whatsapp", "email", "all"]).default("in_app"),
  isRead: int("isRead").default(0),
  sentViaWhatsapp: int("sentViaWhatsapp").default(0),
  sentViaEmail: int("sentViaEmail").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  readAt: timestamp("readAt"),
});

export type CustomNotification = typeof customNotifications.$inferSelect;
export type InsertCustomNotification = typeof customNotifications.$inferInsert;

/**
 * User onboarding tracking - tracks QR code generation and user signup
 */
export const userOnboarding = mysqlTable("userOnboarding", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  qrCode: text("qrCode"), // Base64 encoded QR code image
  qrCodeUrl: text("qrCodeUrl"), // URL to the QR code
  invitationToken: varchar("invitationToken", { length: 256 }).unique(),
  invitationUrl: text("invitationUrl"),
  referrerUserId: int("referrerUserId").references(() => users.id),
  signupSource: varchar("signupSource", { length: 64 }), // qr_code, link, direct, etc.
  isCompleted: int("isCompleted").default(0),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserOnboarding = typeof userOnboarding.$inferSelect;
export type InsertUserOnboarding = typeof userOnboarding.$inferInsert;

/**
 * Broker analytics - tracks broker activity and preferences
 */
export const brokerAnalytics = mysqlTable("brokerAnalytics", {
  id: int("id").autoincrement().primaryKey(),
  brokerPhone: varchar("brokerPhone", { length: 20 }).notNull().unique(),
  brokerName: varchar("brokerName", { length: 256 }),
  supplyCount: int("supplyCount").default(0),
  demandCount: int("demandCount").default(0),
  matchCount: int("matchCount").default(0),
  successfulMatches: int("successfulMatches").default(0),
  avgMatchScore: decimal("avgMatchScore", { precision: 5, scale: 2 }),
  lastActiveAt: timestamp("lastActiveAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrokerAnalytics = typeof brokerAnalytics.$inferSelect;
export type InsertBrokerAnalytics = typeof brokerAnalytics.$inferInsert;

/**
 * Geo market data - stores geocoded market data for map visualization
 */
export const geoMarketData = mysqlTable("geoMarketData", {
  id: int("id").autoincrement().primaryKey(),
  location: varchar("location", { length: 256 }).notNull().unique(),
  city: varchar("city", { length: 128 }).default("Cairo"),
  lat: decimal("lat", { precision: 10, scale: 6 }),
  lng: decimal("lng", { precision: 10, scale: 6 }),
  totalSupply: int("totalSupply").default(0),
  totalDemand: int("totalDemand").default(0),
  totalMatches: int("totalMatches").default(0),
  avgSupplyPrice: decimal("avgSupplyPrice", { precision: 15, scale: 2 }),
  avgDemandBudget: decimal("avgDemandBudget", { precision: 15, scale: 2 }),
  marketTemperature: mysqlEnum("marketTemperature", ["hot", "warm", "cool", "cold"]).default("cool"),
  investmentScore: int("investmentScore").default(0), // 0-100
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeoMarketData = typeof geoMarketData.$inferSelect;
export type InsertGeoMarketData = typeof geoMarketData.$inferInsert;

/**
 * System health tracking
 */
export const systemHealth = mysqlTable("systemHealth", {
  id: int("id").autoincrement().primaryKey(),
  whatsappStatus: mysqlEnum("whatsappStatus", ["connected", "disconnected", "error"]).default("disconnected"),
  whatsappLastMessageAt: timestamp("whatsappLastMessageAt"),
  whatsappLastErrorAt: timestamp("whatsappLastErrorAt"),
  whatsappErrorMessage: text("whatsappErrorMessage"),
  whatsappMessageCount: int("whatsappMessageCount").default(0),
  databaseStatus: mysqlEnum("databaseStatus", ["ok", "error"]).default("ok"),
  databaseLastCheckAt: timestamp("databaseLastCheckAt"),
  databaseErrorMessage: text("databaseErrorMessage"),
  matchingEngineStatus: mysqlEnum("matchingEngineStatus", ["ok", "error"]).default("ok"),
  matchingEngineLastRunAt: timestamp("matchingEngineLastRunAt"),
  matchingEngineLastErrorAt: timestamp("matchingEngineLastErrorAt"),
  matchingEngineErrorMessage: text("matchingEngineErrorMessage"),
  matchesGeneratedToday: int("matchesGeneratedToday").default(0),
  emailStatus: mysqlEnum("emailStatus", ["ok", "error"]).default("ok"),
  emailLastSentAt: timestamp("emailLastSentAt"),
  emailLastErrorAt: timestamp("emailLastErrorAt"),
  overallStatus: mysqlEnum("overallStatus", ["healthy", "degraded", "critical"]).default("healthy"),
  lastUpdatedAt: timestamp("lastUpdatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemHealth = typeof systemHealth.$inferSelect;
export type InsertSystemHealth = typeof systemHealth.$inferInsert;

/**
 * Audit logs - tracks all important actions in the system
 */
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entityType", ["supply", "demand", "match", "user", "notification"]).notNull(),
  entityId: int("entityId").notNull(),
  action: mysqlEnum("action", ["created", "updated", "deleted", "qualified", "contacted"]).notNull(),
  createdBy: int("createdBy").references(() => users.id),
  createdByEmail: varchar("createdByEmail", { length: 320 }),
  changes: json("changes"),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  indexEntityId: int("indexEntityId"),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Conversion funnel - tracks the journey from match to deal
 */
export const conversionFunnel = mysqlTable("conversionFunnel", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").references(() => matches.id).notNull(),
  supplyId: int("supplyId").references(() => supply.id),
  demandId: int("demandId").references(() => demand.id),
  matchGeneratedAt: timestamp("matchGeneratedAt").notNull(),
  firstReplyAt: timestamp("firstReplyAt"),
  viewingScheduledAt: timestamp("viewingScheduledAt"),
  viewingCompletedAt: timestamp("viewingCompletedAt"),
  dealClosedAt: timestamp("dealClosedAt"),
  dealLostAt: timestamp("dealLostAt"),
  currentStage: mysqlEnum("currentStage", ["generated", "replied", "viewing_scheduled", "viewing_completed", "deal_closed", "deal_lost"]).default("generated"),
  daysToFirstReply: int("daysToFirstReply"),
  daysToViewing: int("daysToViewing"),
  daysToDeal: int("daysToDeal"),
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConversionFunnel = typeof conversionFunnel.$inferSelect;
export type InsertConversionFunnel = typeof conversionFunnel.$inferInsert;

/**
 * Segmented analytics - aggregated data by area, property type, price band
 */
export const segmentedAnalytics = mysqlTable("segmentedAnalytics", {
  id: int("id").autoincrement().primaryKey(),
  area: varchar("area", { length: 128 }),
  propertyType: varchar("propertyType", { length: 64 }),
  priceBand: varchar("priceBand", { length: 64 }),
  supplyCount: int("supplyCount").default(0),
  demandCount: int("demandCount").default(0),
  matchCount: int("matchCount").default(0),
  avgSupplyPrice: decimal("avgSupplyPrice", { precision: 15, scale: 2 }),
  avgDemandBudget: decimal("avgDemandBudget", { precision: 15, scale: 2 }),
  supplyDemandRatio: decimal("supplyDemandRatio", { precision: 5, scale: 2 }),
  matchesToReplies: int("matchesToReplies").default(0),
  repliesToViewings: int("repliesToViewings").default(0),
  viewingsToDeal: int("viewingsToDeal").default(0),
  insight: text("insight"),
  insightArabic: text("insightArabic"),
  insightType: mysqlEnum("insightType", ["opportunity", "oversupply", "balanced", "emerging"]).default("balanced"),
  period: mysqlEnum("period", ["today", "7days", "30days", "90days"]).default("30days"),
  // Metadata
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SegmentedAnalytics = typeof segmentedAnalytics.$inferSelect;
export type InsertSegmentedAnalytics = typeof segmentedAnalytics.$inferInsert;

/**
 * WhatsApp magic link tokens for passwordless onboarding
 * Users scan QR → WhatsApp message → click magic link → auto-authenticated
 */
export const whatsappMagicLinks = mysqlTable("whatsappMagicLinks", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 256 }).notNull().unique(),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }).notNull(),
  organizationId: int("organizationId").references(() => organizations.id),
  invitedByUserId: int("invitedByUserId").references(() => users.id),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdUserId: int("createdUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WhatsappMagicLink = typeof whatsappMagicLinks.$inferSelect;
export type InsertWhatsappMagicLink = typeof whatsappMagicLinks.$inferInsert;

/**
 * WhatsApp OTP authentication tokens
 * Used for WhatsApp-based login (alternative to Manus OAuth)
 */
export const whatsappOtp = mysqlTable("whatsappOtp", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 32 }).notNull(),
  otp: varchar("otp", { length: 8 }).notNull(),
  openId: varchar("openId", { length: 64 }),
  used: int("used").default(0).notNull(),
  failedAttempts: int("failedAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WhatsappOtp = typeof whatsappOtp.$inferSelect;
export type InsertWhatsappOtp = typeof whatsappOtp.$inferInsert;

/**
 * Match status history - CRM pipeline audit trail
 * Records every status transition for conversion funnel analytics
 */
export const matchStatusHistory = mysqlTable("matchStatusHistory", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").references(() => matches.id).notNull(),
  fromStatus: mysqlEnum("fromStatus", ["new", "viewed", "contacted", "viewing_scheduled", "negotiating", "closed"]),
  toStatus: mysqlEnum("toStatus", ["new", "viewed", "contacted", "viewing_scheduled", "negotiating", "closed"]).notNull(),
  changedByUserId: int("changedByUserId").references(() => users.id),
  changedByName: varchar("changedByName", { length: 256 }),
  note: text("note"),
  brokerPhone: varchar("brokerPhone", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MatchStatusHistory = typeof matchStatusHistory.$inferSelect;
export type InsertMatchStatusHistory = typeof matchStatusHistory.$inferInsert;

/**
 * Contact Labels - user-defined names for phone-only senders
 * When WhatsApp only shows a phone number (no saved contact name),
 * the user can label that number once and it applies to all their listings/matches.
 */
export const contactLabels = mysqlTable("contactLabels", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 32 }).notNull(),       // Normalized phone: 01XXXXXXXXX or 201XXXXXXXXX
  label: varchar("label", { length: 256 }).notNull(),       // Human-readable name given by user
  organizationId: int("organizationId").references(() => organizations.id),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ContactLabel = typeof contactLabels.$inferSelect;
export type InsertContactLabel = typeof contactLabels.$inferInsert;

/**
 * System Settings — confidence thresholds, digest email schedule, and runtime config
 */
export const systemSettings = mysqlTable("systemSettings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value").notNull(),
  label: varchar("label", { length: 256 }),
  description: text("description"),
  updatedByUserId: int("updatedByUserId").references(() => users.id),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

/**
 * Web Push Subscriptions — stores browser push subscription objects per user/device
 */
export const pushSubscriptions = mysqlTable("pushSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: varchar("userAgent", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

/**
 * Appointments — viewing/meeting scheduling between supply and demand contacts
 */
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").references(() => matches.id),
  supplyId: int("supplyId").references(() => supply.id),
  demandId: int("demandId").references(() => demand.id),
  // Who created this appointment
  createdByUserId: int("createdByUserId").references(() => users.id),
  // Appointment details
  title: varchar("title", { length: 256 }).notNull(),
  appointmentType: mysqlEnum("appointmentType", ["viewing", "meeting", "call", "site_visit"]).default("viewing"),
  scheduledAt: timestamp("scheduledAt").notNull(),
  durationMinutes: int("durationMinutes").default(60),
  location: varchar("location", { length: 512 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["scheduled", "confirmed", "completed", "cancelled", "no_show"]).default("scheduled"),
  // Contact info for both parties
  supplyContactPhone: varchar("supplyContactPhone", { length: 64 }),
  supplyContactName: varchar("supplyContactName", { length: 256 }),
  demandContactPhone: varchar("demandContactPhone", { length: 64 }),
  demandContactName: varchar("demandContactName", { length: 256 }),
  // WhatsApp confirmation sent
  confirmationSentAt: timestamp("confirmationSentAt"),
  reminderSentAt: timestamp("reminderSentAt"),
  organizationId: int("organizationId").references(() => organizations.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

/**
 * Smart Profile Intake — captures structured buy/sell/rent intent from the owner
 */
export const profileIntakes = mysqlTable("profileIntakes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  intentType: mysqlEnum("intentType", ["buying", "selling", "renting_out", "renting", "investing"]).notNull(),
  propertyType: varchar("propertyType", { length: 64 }),
  location: varchar("location", { length: 256 }),
  priceMin: decimal("priceMin", { precision: 15, scale: 2 }),
  priceMax: decimal("priceMax", { precision: 15, scale: 2 }),
  sizeMin: int("sizeMin"),
  sizeMax: int("sizeMax"),
  bedrooms: int("bedrooms"),
  purpose: mysqlEnum("purpose", ["sale", "rent"]),
  notes: text("notes"),
  status: mysqlEnum("status", ["active", "matched", "closed", "paused"]).default("active"),
  // Linked to supply/demand record created from this intake
  linkedSupplyId: int("linkedSupplyId").references(() => supply.id),
  linkedDemandId: int("linkedDemandId").references(() => demand.id),
  organizationId: int("organizationId").references(() => organizations.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProfileIntake = typeof profileIntakes.$inferSelect;
export type InsertProfileIntake = typeof profileIntakes.$inferInsert;


/**
 * User Assets — properties owned by users for sale or rent
 */
export const userAssets = mysqlTable("userAssets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull(),
  propertyType: varchar("propertyType", { length: 64 }).notNull(),
  location: varchar("location", { length: 256 }).notNull(),
  area: varchar("area", { length: 256 }),
  size: int("size"),
  bedrooms: int("bedrooms"),
  bathrooms: int("bathrooms"),
  price: decimal("price", { precision: 15, scale: 2 }),
  priceType: mysqlEnum("priceType", ["sale", "rent"]).notNull(),
  rentalPeriod: mysqlEnum("rentalPeriod", ["monthly", "yearly"]),
  description: text("description"),
  contactPhone: varchar("contactPhone", { length: 20 }),
  status: mysqlEnum("status", ["active", "sold", "rented", "inactive"]).default("active"),
  matchCount: int("matchCount").default(0),
  newMatchCount: int("newMatchCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserAsset = typeof userAssets.$inferSelect;
export type InsertUserAsset = typeof userAssets.$inferInsert;

/**
 * Broker List — brokers who receive demand sheets every 6 hours
 */
export const brokersList = mysqlTable("brokersList", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 256 }),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  preferredAreas: json("preferredAreas"), // array of areas they focus on
  preferredTypes: json("preferredTypes"), // array of property types
  status: mysqlEnum("status", ["active", "inactive"]).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BrokersList = typeof brokersList.$inferSelect;
export type InsertBrokersList = typeof brokersList.$inferInsert;

/**
 * Scheduled Jobs — track automated tasks (6-hour demand sheets, etc)
 */
export const scheduledJobs = mysqlTable("scheduledJobs", {
  id: int("id").autoincrement().primaryKey(),
  jobType: mysqlEnum("jobType", ["broker_demand_sheet", "asset_matching", "daily_digest"]).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending"),
  lastRun: timestamp("lastRun"),
  nextRun: timestamp("nextRun"),
  frequency: varchar("frequency", { length: 64 }), // "every 6 hours", "daily", etc
  recipientId: int("recipientId"), // broker ID or user ID
  recipientEmail: varchar("recipientEmail", { length: 256 }),
  dataSnapshot: json("dataSnapshot"), // stores the data sent
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ScheduledJob = typeof scheduledJobs.$inferSelect;
export type InsertScheduledJob = typeof scheduledJobs.$inferInsert;

/**
 * Asset Matches — tracks matches between user assets and demand messages
 */
export const assetMatches = mysqlTable("assetMatches", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").references(() => userAssets.id).notNull(),
  demandId: int("demandId").references(() => demand.id).notNull(),
  matchScore: decimal("matchScore", { precision: 5, scale: 2 }),
  locationScore: decimal("locationScore", { precision: 5, scale: 2 }),
  priceScore: decimal("priceScore", { precision: 5, scale: 2 }),
  specsScore: decimal("specsScore", { precision: 5, scale: 2 }),
  demandContact: varchar("demandContact", { length: 64 }),
  demandContactName: varchar("demandContactName", { length: 256 }),
  demandSourceGroup: varchar("demandSourceGroup", { length: 256 }),
  demandRawMessage: text("demandRawMessage"),
  buyerTier: mysqlEnum("buyerTier", ["direct_buyer", "broker_with_request", "speculative"]),
  buyerIntentScore: int("buyerIntentScore"),
  matchReasoning: text("matchReasoning"),
  status: mysqlEnum("status", ["new", "viewed", "contacted", "closed"]).default("new"),
  alertSent: int("alertSent").default(0),
  alertSentAt: timestamp("alertSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AssetMatch = typeof assetMatches.$inferSelect;
export type InsertAssetMatch = typeof assetMatches.$inferInsert;


/**
 * Report Runs — tracks scheduled report generation and distribution
 */
export const reportRuns = mysqlTable("reportRuns", {
  id: int("id").autoincrement().primaryKey(),
  reportType: varchar("reportType", { length: 64 }).notNull(), // "demand_sheet", "asset_matches", etc
  location: varchar("location", { length: 256 }), // null for all locations
  status: mysqlEnum("status", ["pending", "generating", "generated", "distributing", "completed", "failed"]).default("pending"),
  totalRecords: int("totalRecords").default(0),
  distributedTo: int("distributedTo").default(0),
  fileKey: varchar("fileKey", { length: 512 }), // S3 file key
  fileUrl: text("fileUrl"), // Public URL
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ReportRun = typeof reportRuns.$inferSelect;
export type InsertReportRun = typeof reportRuns.$inferInsert;

/**
 * Broker Preferences — stores which brokers want which locations/types
 */
export const brokerPreferences = mysqlTable("brokerPreferences", {
  id: int("id").autoincrement().primaryKey(),
  brokerId: int("brokerId").references(() => brokersList.id).notNull(),
  preferredAreas: text("preferredAreas"), // JSON array of areas
  preferredTypes: text("preferredTypes"), // JSON array of "sale", "rent"
  minPrice: decimal("minPrice", { precision: 15, scale: 2 }),
  maxPrice: decimal("maxPrice", { precision: 15, scale: 2 }),
  isActive: tinyint("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BrokerPreference = typeof brokerPreferences.$inferSelect;
export type InsertBrokerPreference = typeof brokerPreferences.$inferInsert;


/**
 * Report history - tracks all generated and sent reports
 */
export const reportHistory = mysqlTable("reportHistory", {
  id: int("id").autoincrement().primaryKey(),
  reportName: varchar("reportName", { length: 256 }).notNull(),
  filePath: text("filePath").notNull(),
  fileSize: int("fileSize"), // in bytes
  demandsCount: int("demandsCount").default(0),
  sheetsCount: int("sheetsCount").default(21),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
  deliveryStatus: mysqlEnum("deliveryStatus", ["pending", "sent", "delivered", "failed", "resent"]).default("pending"),
  deliveryError: text("deliveryError"),
  recipientEmail: varchar("recipientEmail", { length: 256 }).notNull(),
  sentVia: mysqlEnum("sentVia", ["email", "whatsapp", "both"]).default("email"),
  whatsappStatus: mysqlEnum("whatsappStatus", ["pending", "sent", "delivered", "read", "failed"]),
  whatsappMessageId: varchar("whatsappMessageId", { length: 256 }),
  whatsappError: text("whatsappError"),
  manuallyTriggered: int("manuallyTriggered").default(0),
  triggeredBy: varchar("triggeredBy", { length: 256 }), // user who manually triggered
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReportHistory = typeof reportHistory.$inferSelect;
export type InsertReportHistory = typeof reportHistory.$inferInsert;

/**
 * Report notifications - tracks WhatsApp/Slack alerts sent
 */
export const reportNotifications = mysqlTable("reportNotifications", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").references(() => reportHistory.id),
  notificationType: mysqlEnum("notificationType", ["generation_started", "generation_completed", "delivery_success", "delivery_failed", "resend_requested"]).notNull(),
  channel: mysqlEnum("channel", ["whatsapp", "slack", "email"]).notNull(),
  recipientPhone: varchar("recipientPhone", { length: 20 }),
  recipientSlackId: varchar("recipientSlackId", { length: 256 }),
  messageContent: text("messageContent"),
  messageId: varchar("messageId", { length: 256 }),
  status: mysqlEnum("status", ["pending", "sent", "delivered", "failed"]).default("pending"),
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReportNotification = typeof reportNotifications.$inferSelect;
export type InsertReportNotification = typeof reportNotifications.$inferInsert;


/**
 * Saved searches - users can save search criteria and receive email notifications
 */
export const savedSearches = mysqlTable("savedSearches", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 256 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  mode: mysqlEnum("mode", ["sell", "buy", "urgent"]).notNull(),
  location: varchar("location", { length: 256 }),
  propertyType: varchar("propertyType", { length: 256 }),
  priceMin: decimal("priceMin", { precision: 15, scale: 2 }),
  priceMax: decimal("priceMax", { precision: 15, scale: 2 }),
  bedroomsMin: int("bedroomsMin"),
  bedroomsMax: int("bedroomsMax"),
  sizeMin: int("sizeMin"),
  sizeMax: int("sizeMax"),
  notifyEmail: varchar("notifyEmail", { length: 256 }).notNull(),
  notifyOnNewMatches: tinyint("notifyOnNewMatches").default(1).notNull(),
  minScoreThreshold: int("minScoreThreshold").default(70).notNull(),
  lastNotifiedAt: timestamp("lastNotifiedAt"),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = typeof savedSearches.$inferInsert;

/**
 * Search matches - tracks matches found for each saved search
 */
export const searchMatches = mysqlTable("searchMatches", {
  id: int("id").autoincrement().primaryKey(),
  savedSearchId: int("savedSearchId").references(() => savedSearches.id).notNull(),
  supplyId: int("supplyId").references(() => supply.id),
  demandId: int("demandId").references(() => demand.id),
  matchScore: int("matchScore").notNull(),
  notificationSent: tinyint("notificationSent").default(0).notNull(),
  notificationSentAt: timestamp("notificationSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SearchMatch = typeof searchMatches.$inferSelect;
export type InsertSearchMatch = typeof searchMatches.$inferInsert;
