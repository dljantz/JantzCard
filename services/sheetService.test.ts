
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { batchUpdateCards, updateCardInSheet, loadCardsFromSheet, PendingCardUpdate } from './sheetService';

// Mock GAPI
const mockBatchUpdate = vi.fn();
const mockGet = vi.fn();

global.window = {
    gapi: {
        client: {
            sheets: {
                spreadsheets: {
                    values: {
                        get: mockGet,
                        batchUpdate: mockBatchUpdate
                    }
                }
            }
        }
    }
} as any;

describe('Conflict Resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should update card if remote Last Seen is older', async () => {
        // Mock getColumnMapping response (Header row)
        mockGet.mockResolvedValueOnce({
            result: {
                values: [['Front', 'Back', 'Last Seen', 'ID']]
            }
        });

        // Mock current rows response for batchUpdateCards
        // Row 2: ID="123", Last Seen="2023-01-01T00:00:00Z"
        mockGet.mockResolvedValueOnce({
            result: {
                values: [
                    ['Front A', 'Back A', '2023-01-01T00:00:00Z', '123']
                ]
            }
        });

        const update: PendingCardUpdate = {
            id: '123',
            lastSeen: '2023-01-02T00:00:00Z', // Newer
            currentStudyInterval: null,
            updatedAt: '2023-01-02T00:00:00Z'
        };

        await batchUpdateCards('sheet-id', [update]);

        expect(mockBatchUpdate).toHaveBeenCalled();
        const callArgs = mockBatchUpdate.mock.calls[0][0];
        const data = callArgs.resource.data;
        // Expect update to be pushed (Last Seen column is C/col 2)
        // Indices: Front=0, Back=1, Last Seen=2, ID=3
        const lastSeenColUpdate = data.find((d: any) => d.range.includes('C2'));
        expect(lastSeenColUpdate).toBeDefined();
        expect(lastSeenColUpdate.values[0][0]).toBe('2023-01-02T00:00:00Z');
    });

    it('should SKIP update if remote Last Seen is newer', async () => {
        // Mock getColumnMapping response
        mockGet.mockResolvedValueOnce({
            result: {
                values: [['Front', 'Back', 'Last Seen', 'ID']]
            }
        });

        // Mock current rows
        // Row 2: ID="123", Last Seen="2024-01-01T00:00:00Z" (Newer than local)
        mockGet.mockResolvedValueOnce({
            result: {
                values: [
                    ['Front A', 'Back A', '2024-01-01T00:00:00Z', '123']
                ]
            }
        });

        const update: PendingCardUpdate = {
            id: '123',
            lastSeen: '2023-01-01T00:00:00Z', // Older
            currentStudyInterval: null,
            updatedAt: '2023-01-01T00:00:00Z'
        };

        await batchUpdateCards('sheet-id', [update]);

        expect(mockBatchUpdate).not.toHaveBeenCalled();
    });

    it('should PROCEED with update if remote Last Seen is EQUAL (Remote not > Local)', async () => {
        // User logic: "If the card's Last Seen timestamp in the Sheet is more recent ... abort"
        // So equal should NOT abort.

        // Mock getColumnMapping response
        mockGet.mockResolvedValueOnce({
            result: {
                values: [['Front', 'Back', 'Last Seen', 'ID']]
            }
        });

        // Mock current rows
        // Row 2: ID="123", Last Seen="2024-01-01T00:00:00Z"
        mockGet.mockResolvedValueOnce({
            result: {
                values: [
                    ['Front A', 'Back A', '2024-01-01T00:00:00Z', '123']
                ]
            }
        });

        const update: PendingCardUpdate = {
            id: '123',
            lastSeen: '2024-01-01T00:00:00Z', // Equal
            currentStudyInterval: null,
            updatedAt: '2024-01-01T00:00:00Z'
        };

        await batchUpdateCards('sheet-id', [update]);

        expect(mockBatchUpdate).toHaveBeenCalled();
        const callArgs = mockBatchUpdate.mock.calls[0][0];
        const data = callArgs.resource.data;
        const lastSeenColUpdate = data.find((d: any) => d.range.includes('C2'));
        expect(lastSeenColUpdate).toBeDefined();
        // It updates with the local value (which is same).
        expect(lastSeenColUpdate.values[0][0]).toBe('2024-01-01T00:00:00Z');
    });

    it('should handle numeric IDs from sheet gracefully in batchUpdateCards', async () => {
        // Mock getColumnMapping response
        mockGet.mockResolvedValueOnce({
            result: {
                values: [['Front', 'Back', 'ID']]
            }
        });

        // Mock current rows
        // Row 2: ID=123 (Number)
        mockGet.mockResolvedValueOnce({
            result: {
                values: [
                    ['Front A', 'Back A', 123]
                ]
            }
        });

        const update: PendingCardUpdate = {
            id: '123', // String
            lastSeen: 'now',
            currentStudyInterval: '1d',
            updatedAt: '2024-01-01T00:00:00Z'
        };

        await batchUpdateCards('sheet-id', [update]);

        expect(mockBatchUpdate).toHaveBeenCalled();
        const callArgs = mockBatchUpdate.mock.calls[0][0];
        const data = callArgs.resource.data;
        // ID column is C/col 2.
        const idColUpdate = data.find((d: any) => d.range.includes('C2'));
        expect(idColUpdate).toBeDefined();
        // Should re-affirm ID (which we are sending as string, but matching worked)
    });

    it('should handle numeric IDs gracefully in updateCardInSheet', async () => {
        // Mock getColumnMapping response
        mockGet.mockResolvedValueOnce({
            result: {
                values: [['Front', 'Back', 'ID']]
            }
        });

        // Mock current rows/findRowForCard (it fetches A2:ZZ)
        mockGet.mockResolvedValueOnce({
            result: {
                values: [
                    ['Front A', 'Back A', 123] // Numeric ID
                ]
            }
        });

        const card = {
            id: '123', // String ID
            front: 'Front A',
            back: 'Back A',
            lastSeen: 'now',
            currentStudyInterval: '1d',
            updatedAt: '2024-01-01T00:00:00Z'
        } as any;

        await updateCardInSheet('sheet-id', card);

        expect(mockBatchUpdate).toHaveBeenCalled();
        // If it failed to find row, it would have thrown RowNotFoundError
    });
});

describe('loadCardsFromSheet ID Enforcement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate IDs for missing or duplicate entries and save to sheet', async () => {
        // Mock getColumnMapping response
        // Indices: Front=0, Back=1, ID=2
        mockGet.mockResolvedValueOnce({
            result: {
                values: [['Front', 'Back', 'ID']]
            }
        });

        // Mock Sheet Data
        // Row 2: Valid ID "1"
        // Row 3: Missing ID
        // Row 4: Duplicate ID "1"
        // Row 5: Empty Front, Missing ID (Should be ignored)
        mockGet.mockResolvedValueOnce({
            result: {
                values: [
                    ['Card 1', 'Back 1', '1'],
                    ['Card 2', 'Back 2', ''],      // Missing
                    ['Card 3', 'Back 3', '1'],     // Duplicate
                    ['', 'Back 4', ''],            // Empty Front
                ]
            }
        });

        const cards = await loadCardsFromSheet('sheet-id');

        // 1. Verify all cards have unique IDs
        const ids = cards.map(c => c.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(3); // Only 3 valid cards
        expect(ids[0]).toBe('1');       // Original preserved
        expect(ids[1]).not.toBe('');    // New generated
        expect(ids[2]).not.toBe('1');   // New generated

        // 2. Verify Batch Update was called
        expect(mockBatchUpdate).toHaveBeenCalled();
        const callArgs = mockBatchUpdate.mock.calls[0][0];
        const data = callArgs.resource.data;

        // Expect updates for Row 3 and Row 4
        const row3Update = data.find((d: any) => d.range === 'Deck!C3');
        const row4Update = data.find((d: any) => d.range === 'Deck!C4');
        const row5Update = data.find((d: any) => d.range === 'Deck!C5');

        expect(row3Update).toBeDefined();
        expect(row3Update.values[0][0]).toBe(ids[1]);

        expect(row4Update).toBeDefined();
        expect(row4Update.values[0][0]).toBe(ids[2]);

        // Row 5 should NOT be updated
        expect(row5Update).toBeUndefined();
    });
});
