/**
 * MatchPro Admin/Roles/Health/Audit System
 * Phase 3: Admin/Roles/Health/Audit
 */

import { getDb } from './db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

// ─── Admin Role Management ──────────────────────────────────────────────────

export async function setAdminUser(userId: string): Promise<boolean> {
  try {
    const dbInstance = await getDb();
  if (!dbInstance) throw new Error("Database connection failed");
    await dbInstance.update(users).set({ role: 'admin' }).where(eq(users.id, parseInt(userId)));
    return true;
  } catch (error) {
    console.error('Error setting admin:', error);
    return false;
  }
}

export async function getAdminUsers() {
  try {
    const dbInstance = await getDb();
    if (!dbInstance) throw new Error('Database connection failed');
    const admins = await dbInstance.select().from(users).where(eq(users.role, 'admin'));
    return admins;
  } catch (error) {
    console.error('Error getting admins:', error);
    return [];
  }
}

// ─── RBAC Middleware ───────────────────────────────────────────────────────

export function requireAdmin(ctx: any) {
  if (ctx.user?.role !== 'admin') {
    throw new Error('FORBIDDEN: Admin access required');
  }
  return true;
}

// ─── System Health ─────────────────────────────────────────────────────────

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: number;
  components: {
    database: 'ok' | 'error';
    whatsapp: 'ok' | 'error' | 'unknown';
    email: 'ok' | 'error' | 'unknown';
    messageQueue: 'ok' | 'error';
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}

export async function checkSystemHealth(): Promise<SystemHealth> {
  const timestamp = Date.now();
  const components: SystemHealth['components'] = {
    database: 'ok',
    whatsapp: 'unknown',
    email: 'unknown',
    messageQueue: 'ok',
  };

  try {
    const dbInstance = await getDb();
    if (!dbInstance) throw new Error('DB connection failed');
    await dbInstance.select().from(users).limit(1);
  } catch (error) {
    components.database = 'error';
  }

  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (components.database === 'error') {
    status = 'critical';
  }

  return {
    status,
    timestamp,
    components,
    metrics: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsage: 0,
      activeConnections: 0,
    },
  };
}

// ─── Audit Logs ────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes: Record<string, any>;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
}

const auditLogs: AuditLog[] = [];

export function logAudit(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
  const auditLog: AuditLog = {
    ...log,
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };
  auditLogs.push(auditLog);
  
  // Keep only last 10000 logs in memory
  if (auditLogs.length > 10000) {
    auditLogs.shift();
  }
}

export function getAuditLogs(limit: number = 100): AuditLog[] {
  return auditLogs.slice(-limit);
}

export function getAuditLogsByUser(userId: string): AuditLog[] {
  return auditLogs.filter(log => log.userId === userId);
}

export function getAuditLogsByResource(resource: string, resourceId: string): AuditLog[] {
  return auditLogs.filter(log => log.resource === resource && log.resourceId === resourceId);
}
