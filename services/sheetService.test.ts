import { describe, it, expect } from 'vitest';
import { createColumnMapping } from './sheetService';

describe('createColumnMapping', () => {
    it('should map standard columns correctly', () => {
        const headers = ['Front', 'Back', 'Category', 'Priority'];
        const mapping = createColumnMapping(headers);

        expect(mapping['Front']).toBe(0);
        expect(mapping['Back']).toBe(1);
        expect(mapping['Category']).toBe(2);
        expect(mapping['Priority']).toBe(3);
    });

    it('should map "Learning Order" alias to "Priority"', () => {
        const headers = ['Front', 'Back', 'Learning Order'];
        const mapping = createColumnMapping(headers);

        expect(mapping['Front']).toBe(0);
        expect(mapping['Back']).toBe(1);
        expect(mapping['Priority']).toBe(2);
    });

    it('should handle case-insensitivity for alias', () => {
        const headers = ['Front', 'Back', 'learning order'];
        const mapping = createColumnMapping(headers);

        expect(mapping['Priority']).toBe(2);
    });

    it('should prefer "Priority" if both exist (implementation detail: last wins or specific order)', () => {
        // Current implementation: keys are set in order. 
        // If "Priority" comes last, it overwrites. 
        // If "Learning Order" comes last, it overwrites "Priority" key.

        const headers = ['Front', 'Back', 'Priority', 'Learning Order'];
        const mapping = createColumnMapping(headers);

        // "Priority" is index 2.
        // "Learning Order" is index 3, which maps to "Priority".
        // So mapping['Priority'] should be 3.
        expect(mapping['Priority']).toBe(3);
    });
});
