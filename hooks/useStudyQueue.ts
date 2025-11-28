
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
  const intervalMs = intervalMap.get(card.currentStudyInterval) || 1;
  const lastSeenTime = new Date(card.lastSeen).getTime();
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
    // If the interval is not in our master list, treat it as not overdue.
    // This is a safe default to prevent cards with corrupted data from flooding the queue.
    if (!intervalMs) return false;
    
    const lastSeenTime = new Date(card.lastSeen).getTime();
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

    return overduenessB - overduenessA;
  });

  return overdueCards.map(card => card.id);
};