
import { Card } from '../types';
import { STUDY_INTERVALS, SORTING_FUZZINESS } from '../constants';

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

  // Pre-calculate noisy scores to ensure stable sorting.
  // Formula: noisyPO = PO * Random(1-fuzziness, 1+fuzziness)
  const noisyScores = new Map<string, number>();

  overdueCards.forEach(card => {
    const po = getProportionalOverdueness(card, now);
    
    if (po === Infinity) {
      // New cards remain at Infinite priority (top of list)
      noisyScores.set(card.id, Infinity);
    } else {
      const min = 1 - SORTING_FUZZINESS;
      const max = 1 + SORTING_FUZZINESS;
      const randomFactor = Math.random() * (max - min) + min;
      noisyScores.set(card.id, po * randomFactor);
    }
  });

  overdueCards.sort((a, b) => {
    // 1. Sort by priority level (lower is higher priority)
    if (a.priorityLevel !== b.priorityLevel) {
      return a.priorityLevel - b.priorityLevel;
    }

    // 2. Sort by Noisy PO (descending)
    const scoreA = noisyScores.get(a.id)!;
    const scoreB = noisyScores.get(b.id)!;

    if (scoreA === scoreB) return 0;
    if (scoreA === Infinity) return -1;
    if (scoreB === Infinity) return 1;
    
    return scoreB - scoreA;
  });

  return overdueCards.map(card => card.id);
};
