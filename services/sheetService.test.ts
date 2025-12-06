
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { batchUpdateCards, PendingCardUpdate } from './sheetService';

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

    it('should update card if remote timestamp is older', async () => {
        // Mock getColumnMapping response (Header row)
        mockGet.mockResolvedValueOnce({
            result: {
                values: [['Front', 'Back', 'Updated', 'ID']]
            }
        });

        // Mock current rows response for batchUpdateCards
        // Row 2: ID="123", Updated="2023-01-01T00:00:00Z"
        mockGet.mockResolvedValueOnce({
            result: {
                values: [
                    ['Front A', 'Back A', '2023-01-01T00:00:00Z', '123']
                ]
            }
        });

        const update: PendingCardUpdate = {
            id: '123',
            lastSeen: null,
            currentStudyInterval: null,
            updatedAt: '2023-01-02T00:00:00Z' // Newer
        };

        await batchUpdateCards('sheet-id', [update]);

        expect(mockBatchUpdate).toHaveBeenCalled();
        const callArgs = mockBatchUpdate.mock.calls[0][0];
        const data = callArgs.resource.data;
        // Expect update to be pushed (Updated column is C/col 2)
        // Indices: Front=0, Back=1, Updated=2, ID=3
        // Update should include Updated column at C2
        const updatedColUpdate = data.find((d: any) => d.range.includes('C2'));
        expect(updatedColUpdate).toBeDefined();
        expect(updatedColUpdate.values[0][0]).toBe('2023-01-02T00:00:00Z');
    });

    it('should SKIP update if remote timestamp is newer', async () => {
        // Mock getColumnMapping response
        mockGet.mockResolvedValueOnce({
            result: {
                values: [['Front', 'Back', 'Updated', 'ID']]
            }
        });

        // Mock current rows
        // Row 2: ID="123", Updated="2024-01-01T00:00:00Z" (Newer than local)
        mockGet.mockResolvedValueOnce({
            result: {
                values: [
                    ['Front A', 'Back A', '2024-01-01T00:00:00Z', '123']
                ]
            }
        });

        const update: PendingCardUpdate = {
            id: '123',
            lastSeen: null,
            currentStudyInterval: null,
            updatedAt: '2023-01-01T00:00:00Z' // Older
        };

        await batchUpdateCards('sheet-id', [update]);

        // Should NOT call batchUpdate if all updates are skipped
        // Wait, batchUpdateCards calls batchUpdate only if data > 0.
        expect(mockBatchUpdate).not.toHaveBeenCalled();
    });

    it('should SKIP update if remote timestamp is EQUAL', async () => {
        // Mock getColumnMapping response
        mockGet.mockResolvedValueOnce({
            result: {
                values: [['Front', 'Back', 'Updated', 'ID']]
            }
        });

        // Mock current rows
        mockGet.mockResolvedValueOnce({
            result: {
                values: [
                    ['Front A', 'Back A', '2024-01-01T00:00:00Z', '123']
                ]
            }
        });

        const update: PendingCardUpdate = {
            id: '123',
            lastSeen: null,
            currentStudyInterval: null,
            updatedAt: '2024-01-01T00:00:00Z' // Equal
        };

        await batchUpdateCards('sheet-id', [update]);

        expect(mockBatchUpdate).not.toHaveBeenCalled();
    });
});
