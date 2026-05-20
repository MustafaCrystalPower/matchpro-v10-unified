import { sendReportEmail, generateBrokerReportEmailTemplate } from './_core/emailService';
import { getRecentDemand } from './db';

/**
 * Broker Distribution System
 * Sends area-specific demand sheets to registered brokers
 */

/**
 * Broker registration interface
 */
export interface BrokerRegistration {
  id: number;
  name: string;
  email: string;
  phone: string;
  areas: string[]; // Areas they cover
  active: boolean;
  createdAt: Date;
}

/**
 * Mock broker database - replace with actual database queries
 */
const brokerDatabase: BrokerRegistration[] = [
  {
    id: 1,
    name: 'Ahmed Hassan',
    email: 'ahmed@brokers.com',
    phone: '+201001234567',
    areas: ['مدينتي', 'الرحاب'],
    active: true,
    createdAt: new Date(),
  },
  {
    id: 2,
    name: 'Fatima Mohamed',
    email: 'fatima@brokers.com',
    phone: '+201009876543',
    areas: ['التجمع الخامس', 'القاهرة الجديدة'],
    active: true,
    createdAt: new Date(),
  },
  {
    id: 3,
    name: 'Omar Khalil',
    email: 'omar@brokers.com',
    phone: '+201005555555',
    areas: ['الساحل الشمالي', 'العين السخنة'],
    active: true,
    createdAt: new Date(),
  },
];

/**
 * Get all active brokers
 */
export function getActiveBrokers(): BrokerRegistration[] {
  return brokerDatabase.filter((b) => b.active);
}

/**
 * Get brokers for a specific area
 */
export function getBrokersForArea(area: string): BrokerRegistration[] {
  return brokerDatabase.filter((b) => b.active && b.areas.includes(area));
}

/**
 * Distribute area-specific reports to brokers
 */
export async function distributeBrokerReports(
  reportUrl: string,
  areaSheets: Map<string, { count: number; url: string }>
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  try {
    console.log('[Broker Distribution] Starting distribution to brokers...');

    const brokers = getActiveBrokers();

    for (const broker of brokers) {
      try {
        console.log(`[Broker Distribution] Processing broker: ${broker.name}`);

        for (const area of broker.areas) {
          const areaData = areaSheets.get(area);
          if (!areaData) {
            console.warn(`[Broker Distribution] No data for area ${area}`);
            continue;
          }

          // Generate broker-specific email
          const emailTemplate = generateBrokerReportEmailTemplate(
            broker.name,
            area,
            areaData.url,
            areaData.count,
            new Date()
          );

          // Send email
          const sent = await sendReportEmail(
            broker.email,
            `📍 ${area} - New Buyer Requests (6-Hour Report)`,
            emailTemplate
          );

          if (sent) {
            console.log(`[Broker Distribution] Report sent to ${broker.name} for ${area}`);
            results.sent++;
          } else {
            console.warn(`[Broker Distribution] Failed to send report to ${broker.name} for ${area}`);
            results.failed++;
            results.errors.push(`Failed to send to ${broker.name} (${area})`);
          }
        }
      } catch (error) {
        console.error(`[Broker Distribution] Error processing broker ${broker.name}:`, error);
        results.failed++;
        results.errors.push(`Error processing ${broker.name}: ${String(error)}`);
      }
    }

    console.log(
      `[Broker Distribution] Distribution complete: ${results.sent} sent, ${results.failed} failed`
    );
    return results;
  } catch (error) {
    console.error('[Broker Distribution] Error during distribution:', error);
    results.failed++;
    results.errors.push(`Distribution error: ${String(error)}`);
    return results;
  }
}

/**
 * Get area-specific lead count for brokers
 */
export async function getAreaLeadCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  try {
    const allDemand = await getRecentDemand(1000);

    // Group by area
    const areas = new Set<string>();
    for (const demand of allDemand) {
      if (demand.area) {
        areas.add(demand.area);
      }
    }

    // Count leads per area
    for (const area of areas) {
      const count = allDemand.filter((d) => d.area === area).length;
      counts.set(area, count);
    }

    console.log(`[Broker Distribution] Area lead counts:`, Object.fromEntries(counts));
    return counts;
  } catch (error) {
    console.error('[Broker Distribution] Error getting area lead counts:', error);
    return counts;
  }
}

/**
 * Register a new broker
 */
export function registerBroker(broker: BrokerRegistration): void {
  // Check if broker already exists
  const existing = brokerDatabase.find((b) => b.email === broker.email);
  if (existing) {
    console.warn(`[Broker Distribution] Broker ${broker.email} already registered`);
    return;
  }

  broker.id = Math.max(...brokerDatabase.map((b) => b.id), 0) + 1;
  broker.createdAt = new Date();
  brokerDatabase.push(broker);
  console.log(`[Broker Distribution] Broker registered: ${broker.name}`);
}

/**
 * Deactivate a broker
 */
export function deactivateBroker(brokerId: number): void {
  const broker = brokerDatabase.find((b) => b.id === brokerId);
  if (broker) {
    broker.active = false;
    console.log(`[Broker Distribution] Broker deactivated: ${broker.name}`);
  }
}

/**
 * Update broker areas
 */
export function updateBrokerAreas(brokerId: number, areas: string[]): void {
  const broker = brokerDatabase.find((b) => b.id === brokerId);
  if (broker) {
    broker.areas = areas;
    console.log(`[Broker Distribution] Broker ${broker.name} areas updated: ${areas.join(', ')}`);
  }
}

/**
 * Get broker statistics
 */
export function getBrokerStats(): {
  totalBrokers: number;
  activeBrokers: number;
  totalAreas: number;
  brokersByArea: Record<string, number>;
} {
  const activeBrokers = brokerDatabase.filter((b) => b.active);
  const areas = new Set<string>();
  const brokersByArea: Record<string, number> = {};

  for (const broker of brokerDatabase) {
    for (const area of broker.areas) {
      areas.add(area);
      brokersByArea[area] = (brokersByArea[area] || 0) + 1;
    }
  }

  return {
    totalBrokers: brokerDatabase.length,
    activeBrokers: activeBrokers.length,
    totalAreas: areas.size,
    brokersByArea,
  };
}
