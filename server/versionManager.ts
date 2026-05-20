/**
 * Version Manager — Feature gating system for MatchPro v1-v10
 * 
 * Allows admins to enable/disable features by version
 * All features gate-checked at runtime
 * 
 * v1 (CORE): Always enabled
 *   - Supply + Demand ingestion
 *   - Matching algorithm
 *   - Notifications
 *   - Dashboard
 * 
 * v2 (MY ASSETS): User-owned property management + auto-matching
 * v3 (MY SEARCH): Saved searches + smart alerts
 * v4 (PROPERTY FINDER): Property Finder scraper
 * v5 (DUBIZZLE): Dubizzle scraper
 * v6 (FACEBOOK): Facebook Groups integration
 * v7-v10: Reserved for future expansion
 */

import { getDb } from "./db";

export type FeatureVersion = "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | "v8" | "v9" | "v10";

export interface VersionConfig {
  version: FeatureVersion;
  name: string;
  description: string;
  features: string[];
  enabled: boolean;
  defaultEnabled: boolean;
}

/**
 * Version configurations
 */
const VERSION_CONFIGS: Record<FeatureVersion, VersionConfig> = {
  v1: {
    version: "v1",
    name: "Core Platform",
    description: "Supply + Demand matching, notifications, dashboard",
    features: ["supply", "demand", "matching", "notifications", "dashboard"],
    enabled: true,
    defaultEnabled: true,
  },
  v2: {
    version: "v2",
    name: "My Assets",
    description: "User-owned property management with auto-matching",
    features: ["myAssets", "assetMatching", "assetTracking"],
    enabled: true,
    defaultEnabled: true,
  },
  v3: {
    version: "v3",
    name: "My Search",
    description: "Saved searches with smart alerts and notifications",
    features: ["mySearch", "savedSearches", "searchAlerts"],
    enabled: true,
    defaultEnabled: true,
  },
  v4: {
    version: "v4",
    name: "Property Finder Scraper",
    description: "Automatic Property Finder Egypt scraping",
    features: ["propertyFinderScraper"],
    enabled: false,
    defaultEnabled: false,
  },
  v5: {
    version: "v5",
    name: "Dubizzle Scraper",
    description: "Automatic Dubizzle Egypt scraping",
    features: ["dubizzleScraper"],
    enabled: false,
    defaultEnabled: false,
  },
  v6: {
    version: "v6",
    name: "Facebook Integration",
    description: "Facebook Groups connector and scraper",
    features: ["facebookScraper"],
    enabled: false,
    defaultEnabled: false,
  },
  v7: {
    version: "v7",
    name: "Advanced Analytics",
    description: "Investor dashboard and market intelligence",
    features: ["advancedAnalytics"],
    enabled: false,
    defaultEnabled: false,
  },
  v8: {
    version: "v8",
    name: "Broker Tools",
    description: "Broker leaderboard and performance tracking",
    features: ["brokerTools"],
    enabled: false,
    defaultEnabled: false,
  },
  v9: {
    version: "v9",
    name: "Enterprise Features",
    description: "AVM, broker detection, advanced NLP",
    features: ["enterpriseFeatures"],
    enabled: false,
    defaultEnabled: false,
  },
  v10: {
    version: "v10",
    name: "AI Co-Pilot",
    description: "AI-powered property recommendations and insights",
    features: ["aiCopilot"],
    enabled: false,
    defaultEnabled: false,
  },
};

/**
 * Get version configuration
 */
export function getVersionConfig(version: FeatureVersion): VersionConfig {
  return VERSION_CONFIGS[version] || VERSION_CONFIGS.v1;
}

/**
 * Check if feature is enabled
 */
export async function isFeatureEnabled(featureName: string): Promise<boolean> {
  // For now, use in-memory config
  // In production, this would query the database for user-specific settings

  for (const config of Object.values(VERSION_CONFIGS)) {
    if (config.features.includes(featureName) && config.enabled) {
      return true;
    }
  }

  return false;
}

/**
 * Check if version is enabled
 */
export async function isVersionEnabled(version: FeatureVersion): Promise<boolean> {
  const config = getVersionConfig(version);
  return config.enabled;
}

/**
 * Get all enabled versions
 */
export async function getEnabledVersions(): Promise<FeatureVersion[]> {
  return (Object.keys(VERSION_CONFIGS) as FeatureVersion[]).filter(
    (v) => VERSION_CONFIGS[v].enabled
  );
}

/**
 * Get all versions (enabled + disabled)
 */
export function getAllVersions(): VersionConfig[] {
  return Object.values(VERSION_CONFIGS);
}

/**
 * Admin: Toggle version on/off
 */
export async function toggleVersion(version: FeatureVersion, enabled: boolean): Promise<VersionConfig> {
  VERSION_CONFIGS[version].enabled = enabled;

  console.log(`[VersionManager] ${version} toggled to ${enabled ? "ON" : "OFF"}`);

  // TODO: Persist to database
  // const db = await getDb();
  // if (db) {
  //   await db.update(systemSettings).set({
  //     value: JSON.stringify(VERSION_CONFIGS)
  //   }).where(eq(systemSettings.key, 'versionConfigs'));
  // }

  return VERSION_CONFIGS[version];
}

/**
 * Admin: Get feature-gating status
 */
export function getFeatureStatus(): {
  version: string;
  enabled: boolean;
  features: string[];
  description: string;
}[] {
  return Object.values(VERSION_CONFIGS).map((config) => ({
    version: config.version,
    enabled: config.enabled,
    features: config.features,
    description: config.description,
  }));
}

/**
 * Middleware: Gate route/feature based on version
 */
export async function versionGate(featureName: string): Promise<boolean> {
  const enabled = await isFeatureEnabled(featureName);

  if (!enabled) {
    console.log(`[VersionManager] Feature gated: ${featureName}`);
  }

  return enabled;
}

/**
 * Decorator: Apply to router procedures to gate features
 * Usage: @versionGateDecorator('myAssets')
 */
export function createVersionGate(featureName: string) {
  return async () => {
    const enabled = await isFeatureEnabled(featureName);
    if (!enabled) {
      throw new Error(`Feature not enabled: ${featureName}`);
    }
  };
}

/**
 * Initialize version manager from database (if persisted)
 */
export async function initVersionManager(): Promise<void> {
  console.log("[VersionManager] Initialized with default configs");

  // TODO: Load from database if exists
  // const db = await getDb();
  // if (db) {
  //   const stored = await db
  //     .select()
  //     .from(systemSettings)
  //     .where(eq(systemSettings.key, 'versionConfigs'));
  //   if (stored.length > 0) {
  //     const parsed = JSON.parse(stored[0].value);
  //     Object.assign(VERSION_CONFIGS, parsed);
  //   }
  // }
}

/**
 * Reset to defaults
 */
export async function resetVersionDefaults(): Promise<void> {
  for (const version of Object.keys(VERSION_CONFIGS) as FeatureVersion[]) {
    VERSION_CONFIGS[version].enabled = VERSION_CONFIGS[version].defaultEnabled;
  }

  console.log("[VersionManager] Reset to default configuration");
}

/**
 * Export for testing
 */
export { VERSION_CONFIGS };
