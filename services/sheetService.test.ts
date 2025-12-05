import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateCardInSheet } from './sheetService'; // We test updateCardInSheet which calls findRowForCard internally
import { Card } from '../types';

// Mock the global google object
const mockValuesGet = vi.fn();
const mockBatchUpdate = vi.fn();

const setupGoogleMock = () => {
    (global as any).window = {
        gapi: {
            client: {
                sheets: {
                    spreadsheets: {
                        values: {
                            get: mockValuesGet,
                            batchUpdate: mockBatchUpdate
                        }
                    }
                }
            }
        }
    };
};

describe('sheetService', () => {
    beforeEach(() => {
        setupGoogleMock();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (global as any).window;
    });

    it('should find row when sheet returns sparse array (missing trailing empty strings)', async () => {
        // Setup Logic:
        // 1. Mock getColumnMapping response (Header row)
        // 2. Mock findRowForCard response (Data rows)

        // Headers: Front, Back, Category (indices 0, 1, 2)
        // Row 1 (Header)
        mockValuesGet.mockResolvedValueOnce({
            result: {
                values: [['Front', 'Back', 'Category']]
            }
        });

        // Row 2+ (Data)
        // Scenario: Card has back="", but Sheet row is ['FrontVal'] (length 1), missing index 1 and 2
        mockValuesGet.mockResolvedValueOnce({
            result: {
                values: [
                    ['FrontVal'] // Sparse row! Missing 'Back' and 'Category'
                ]
            }
        });

        const card: Card = {
            id: 'temp-id', // ID doesn't match/exist in sheet yet, forces content search
            front: 'FrontVal',
            back: '', // Local state has empty string
            category: 'General',
            priorityLevel: 1,
            lastSeen: null,
            currentStudyInterval: null,
            status: 'Active'
        };

        // We expect this to SUCCEED now that we fixed the sparse array handling
        await expect(updateCardInSheet('sheet-id', card)).resolves.not.toThrow();
    });
});
