/**
 * Phase 4: Match UX & Feedback System
 * Enhanced match cards, feedback tracking, learning system
 */

import { getDb } from './db';
import { matches, matchFeedback } from '../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

export interface MatchFeedbackRecord {
  matchId: number;
  userId: string;
  status: 'accepted' | 'rejected' | 'completed' | 'pending';
  reason?: string;
  notes?: string;
  contactedAt?: number;
  resultAt?: number;
  dealValue?: number;
  timestamp: number;
}

export interface EnhancedMatchCard {
  matchId: number;
  supplierId: string;
  demanderId: string;
  score: number;
  reasoning: {
    locationMatch: number;
    priceMatch: number;
    typeMatch: number;
    details: string[];
  };
  supplierInfo: {
    name: string;
    phone: string;
    location: string;
    property: string;
  };
  demanderInfo: {
    name: string;
    phone: string;
    location: string;
    budget: string;
  };
  feedback?: MatchFeedbackRecord;
  confidence: number;
  createdAt: number;
}

// Store feedback in memory with persistence
const feedbackStore: Map<number, MatchFeedbackRecord> = new Map();

export async function recordMatchFeedback(feedback: Omit<MatchFeedbackRecord, 'timestamp'>): Promise<boolean> {
  try {
    const record: MatchFeedbackRecord = {
      ...feedback,
      timestamp: Date.now(),
    };
    feedbackStore.set(feedback.matchId, record);
    
    // Persist to database if available
    const db = await getDb();
    if (db) {
      await db.insert(matchFeedback).values({
        matchId: feedback.matchId,
        userId: parseInt(feedback.userId),
        rating: 5, // Default rating
        comment: feedback.notes,
        helpful: 1,
      });
    }
    return true;
  } catch (error) {
    console.error('Error recording match feedback:', error);
    return false;
  }
}

export async function getMatchFeedback(matchId: number): Promise<MatchFeedbackRecord | null> {
  return feedbackStore.get(matchId) || null;
}

export async function getMatchesByStatus(status: string, limit: number = 50): Promise<MatchFeedbackRecord[]> {
  return Array.from(feedbackStore.values())
    .filter(f => f.status === status)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export async function calculateMatchLearning(): Promise<{
  acceptanceRate: number;
  rejectionRate: number;
  completionRate: number;
  avgDealValue: number;
  topReasons: { reason: string; count: number }[];
}> {
  const feedbacks = Array.from(feedbackStore.values());
  const total = feedbacks.length;
  
  if (total === 0) {
    return {
      acceptanceRate: 0,
      rejectionRate: 0,
      completionRate: 0,
      avgDealValue: 0,
      topReasons: [],
    };
  }

  const accepted = feedbacks.filter(f => f.status === 'accepted').length;
  const rejected = feedbacks.filter(f => f.status === 'rejected').length;
  const completed = feedbacks.filter(f => f.status === 'completed').length;
  const dealValues = feedbacks.filter(f => f.dealValue).map(f => f.dealValue || 0);
  const avgDealValue = dealValues.length > 0 ? dealValues.reduce((a, b) => a + b, 0) / dealValues.length : 0;

  // Count rejection reasons
  const reasonCounts: Map<string, number> = new Map();
  feedbacks
    .filter(f => f.status === 'rejected' && f.reason)
    .forEach(f => {
      const reason = f.reason || 'unknown';
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    });

  const topReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    acceptanceRate: (accepted / total) * 100,
    rejectionRate: (rejected / total) * 100,
    completionRate: (completed / total) * 100,
    avgDealValue,
    topReasons,
  };
}

export async function getEnhancedMatchCards(limit: number = 50): Promise<EnhancedMatchCard[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database connection failed');

    const matchRecords = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.matchScore))
      .limit(limit);

    return matchRecords.map(m => ({
      matchId: m.id,
      supplierId: String(m.supplyId || 0),
      demanderId: String(m.demandId || 0),
      score: parseInt(m.matchScore || '0'),
      reasoning: {
        locationMatch: parseInt(m.locationScore || '0'),
        priceMatch: parseInt(m.priceScore || '0'),
        typeMatch: parseInt(m.specsScore || '0'),
        details: [
          `Location: ${m.locationScore}% match`,
          `Price: ${m.priceScore}% match`,
          `Type: ${m.specsScore}% match`,
        ],
      },
      supplierInfo: {
        name: m.supplyContactName || 'Unknown',
        phone: m.supplyContactPhone || '',
        location: 'Cairo',
        property: 'Property',
      },
      demanderInfo: {
        name: m.demandContactName || 'Unknown',
        phone: m.demandContactPhone || '',
        location: 'Cairo',
        budget: '5,000,000',
      },
      feedback: feedbackStore.get(m.id) || undefined,
      confidence: parseInt(m.matchScore || '0') / 100,
      createdAt: m.updatedAt.getTime(),
    }));
  } catch (error) {
    console.error('Error getting enhanced match cards:', error);
    return [];
  }
}
