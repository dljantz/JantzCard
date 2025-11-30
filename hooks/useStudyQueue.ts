
import { Card } from '../types';
import { STUDY_INTERVALS } from '../constants';

// Create a lookup map for efficient access to interval milliseconds
const intervalMap = new Map<string, number>(
  STUDY_INTERVALS.map(i => [i.label, i.ms])
);

export const getProportionalOverdueness = (card: Card, now: number): number => {
  if (!card.lastSeen || !card.currentStudyInterval) {
    return Infinity; // New cards are infinitely overdue
  }
  
  const intervalMs = intervalMap.get(card.currentStudyInterval);
  // If interval is invalid/corrupt, treat as infinitely overdue (New Card behavior)
  if (!intervalMs) return Infinity;

  const lastSeenTime = new Date(card.lastSeen).getTime();
  // If date is invalid/corrupt, treat as infinitely overdue (New Card behavior)
  if (isNaN(lastSeenTime)) return Infinity;

  const elapsedTime = now - lastSeenTime;
  return elapsedTime / intervalMs;
};


export const calculateStudyQueue = (cards: Card[]): string[] => {
  if (!cards || cards.length === 0) {
    return [];
  }
  
  const now = Date.now();

  const overdueCards = cards.filter(card => {
    if (!card.lastSeen || !card.currentStudyInterval) {
      return true; // New cards are always overdue
    }
    const intervalMs = intervalMap.get(card.currentStudyInterval);
    // If the interval is not in our master list (e.g. "kasdf"), treat it as corrupt/new and thus overdue.
    if (!intervalMs) return true;
    
    const lastSeenTime = new Date(card.lastSeen).getTime();
    // If the date is invalid (e.g. "invalid-date"), treat it as corrupt/new and thus overdue.
    if (isNaN(lastSeenTime)) return true;
    
    const dueTime = lastSeenTime + intervalMs;
    return now >= dueTime;
  });

  overdueCards.sort((a, b) => {
    // 1. Sort by priority level (lower is higher priority)
    if (a.priorityLevel !== b.priorityLevel) {
      return a.priorityLevel - b.priorityLevel;
    }

    // 2. Sort by proportional overdueness (higher is more overdue)
    const overduenessA = getProportionalOverdueness(a, now);
    const overduenessB = getProportionalOverdueness(b, now);

    // Handle Infinity - Infinity = NaN case
    if (overduenessA === overduenessB) return 0;
    
    return overduenessB - overduenessA;
  });

  return overdueCards.map(card => card.id);
};
