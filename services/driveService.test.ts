import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateStreak } from './driveService';

// Mock GAPI and Fetch
const mockGapi = {
    client: {
        drive: {
            files: {
                list: vi.fn(),
                get: vi.fn(),
            }
        },
        load: vi.fn(),
    },
    auth: {
        getToken: vi.fn().mockReturnValue({ access_token: 'mock_token' })
    }
};

const mockFetch = vi.fn();

describe('driveService.updateStreak', () => {
    beforeEach(() => {
        vi.stubGlobal('window', { gapi: mockGapi });
        vi.stubGlobal('fetch', mockFetch);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('should initialize streak to 1 if no history exists', async () => {
        // Set "Today" to a known local time (e.g. 2025-05-20)
        // Note: vitest setSystemTime sets the "now". 
        // We need to ensure getMonth/getDate returns expected values.
        // Let's pick a date that is safe from timezone shifts if possible, or force timezone in test env?
        // Since we can't easily force timezone in browser environment without complex mocks,
        // we will just assert that it produces A date string.

        mockGapi.client.drive.files.list.mockResolvedValue({ result: { files: [{ id: 'file_123' }] } });
        mockGapi.client.drive.files.get.mockResolvedValue({ result: { streak: undefined } });
        mockFetch.mockResolvedValue({ ok: true });

        const result = await updateStreak();

        expect(result).toEqual({ count: 1, lastStudyDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    });

    it('should increment streak if studied yesterday (local time)', async () => {
        // Mock "Now" as 2025-12-10 12:00:00 Local
        // The implementation uses new Date().getDate() etc.
        // We can just rely on the fact that we feed it a "yesterday" string that matches whatever today evaluates to minus 1.

        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        // Calculate yesterday string
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const y2 = yesterday.getFullYear();
        const m2 = String(yesterday.getMonth() + 1).padStart(2, '0');
        const d2 = String(yesterday.getDate()).padStart(2, '0');
        const yesterdayStr = `${y2}-${m2}-${d2}`;

        // Mock File Read (Last studied yesterday)
        mockGapi.client.drive.files.list.mockResolvedValue({ result: { files: [{ id: 'file_123' }] } });
        mockGapi.client.drive.files.get.mockResolvedValue({
            result: {
                streak: { count: 5, lastStudyDate: yesterdayStr }
            }
        });
        mockFetch.mockResolvedValue({ ok: true });

        const result = await updateStreak();

        expect(result?.count).toBe(6);
        expect(result?.lastStudyDate).toBe(todayStr);
    });

    it('should not increment if already studied today', async () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        // Mock File Read (Last studied today)
        mockGapi.client.drive.files.list.mockResolvedValue({ result: { files: [{ id: 'file_123' }] } });
        mockGapi.client.drive.files.get.mockResolvedValue({
            result: {
                streak: { count: 5, lastStudyDate: todayStr }
            }
        });

        const result = await updateStreak();

        expect(result?.count).toBe(5);
        // Should NOT call update
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reset streak if missed a day', async () => {
        // Mock "Two days ago"
        const now = new Date();
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(now.getDate() - 2);

        const y = twoDaysAgo.getFullYear();
        const m = String(twoDaysAgo.getMonth() + 1).padStart(2, '0');
        const d = String(twoDaysAgo.getDate()).padStart(2, '0');
        const twoDaysAgoStr = `${y}-${m}-${d}`;

        mockGapi.client.drive.files.list.mockResolvedValue({ result: { files: [{ id: 'file_123' }] } });
        mockGapi.client.drive.files.get.mockResolvedValue({
            result: {
                streak: { count: 5, lastStudyDate: twoDaysAgoStr }
            }
        });
        mockFetch.mockResolvedValue({ ok: true });

        const result = await updateStreak();

        expect(result?.count).toBe(1);
    });
});
