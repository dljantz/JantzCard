
import { describe, it, expect } from 'vitest';
import { calculateStudyQueue } from './useStudyQueue';
import { Card } from '../types';

// Helper to create mock cards
const createCard = (id: string, ivl: string | null, lastSeen: string | null, priority = 10): Card => ({
    id,
    front: `Front ${id}`,
    back: `Back ${id}`,
    category: 'Test',
    priorityLevel: priority,
    currentStudyInterval: ivl,
    lastSeen, // ISO String
});

describe('useStudyQueue', () => {
    it('should return empty list for empty input', () => {
        expect(calculateStudyQueue([])).toEqual([]);
    });

    it('should prioritize new cards (null lastSeen/Interval)', () => {
        const card1 = createCard('1', '10m', new Date().toISOString()); // Just studied
        const card2 = createCard('2', null, null); // New

        const queue = calculateStudyQueue([card1, card2]);
        expect(queue).toContain('2');
    });

    it('should include overdue cards', () => {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const past = new Date(now - oneHour * 2).toISOString(); // 2 hours ago

        // Interval 10m (600,000ms). Elapsed 2h. Overdue.
        const card1 = createCard('1', '10m', past);

        const queue = calculateStudyQueue([card1]);
        expect(queue).toContain('1');
    });

    it('should not include future cards', () => {
        const now = Date.now();
        // Just studied 10s ago, interval 10m.
        const justStudied = new Date(now - 10000).toISOString();

        const card1 = createCard('1', '10m', justStudied);
        const queue = calculateStudyQueue([card1]);
        expect(queue).not.toContain('1');
    });

    it('should sort by priority first', () => {
        // Both new, so equal "Overdueness" (Infinity).
        // Priority should break tie.
        const cardA = createCard('A', null, null, 2);
        const cardB = createCard('B', null, null, 1); // Higher priority (lower number)

        const queue = calculateStudyQueue([cardA, cardB]);
        expect(queue[0]).toBe('B');
        expect(queue[1]).toBe('A');
    });
});
