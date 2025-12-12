
const FILE_NAME = 'jantzcard_history.json';
const MIME_TYPE = 'application/json';

export interface DeckHistoryItem {
    spreadsheetId: string;
    name: string;
    lastVisited: number;
}

export interface HistoryFileContent {
    _readme?: string;
    recentDecks: DeckHistoryItem[];
}

export interface StreakInfo {
    count: number;
    lastStudyDate: string; // YYYY-MM-DD
}

export interface HistoryFileContent {
    _readme?: string;
    recentDecks: DeckHistoryItem[];
    streak?: StreakInfo;
}

/**
 * Searches for the config file in the user's Drive.
 * Returns the file ID if found, null otherwise.
 */
export const searchConfigFile = async (): Promise<string | null> => {
    if (!window.gapi?.client?.drive) {
        console.error("Google Drive API not loaded");
        return null;
    }

    try {
        const q = `name = '${FILE_NAME}' and mimeType = '${MIME_TYPE}' and trashed = false`;
        const response = await window.gapi.client.drive.files.list({
            q,
            spaces: 'drive',
            fields: 'files(id, name)',
        });

        const files = response.result.files;
        if (files && files.length > 0) {
            return files[0].id;
        }
        return null;
    } catch (err) {
        console.error("Error searching for config file", err);
        return null;
    }
};

/**
 * Creates the config file with initial empty content.
 */
export const createConfigFile = async (): Promise<string> => {
    const metadata = {
        name: FILE_NAME,
        mimeType: MIME_TYPE,
    };

    const content: HistoryFileContent = {
        _readme: "This file stores your JantzCard session history. Please do not edit it manually.",
        recentDecks: [],
        streak: { count: 0, lastStudyDate: "" }
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(content)], { type: 'application/json' }));

    const fetchOptions = {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + window.gapi.auth.getToken().access_token }),
        body: form,
    };

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', fetchOptions);
    const file = await res.json();
    return file.id;
};

/**
 * Reads the content of the config file.
 */
export const readConfigFile = async (fileId: string): Promise<HistoryFileContent> => {
    try {
        const response = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });
        return response.result as HistoryFileContent;
    } catch (err) {
        console.error("Error reading config file", err);
        return { recentDecks: [] };
    }
};

/**
 * Updates the config file with new history.
 */
export const updateConfigFile = async (fileId: string, content: HistoryFileContent): Promise<void> => {
    const fetchOptions = {
        method: 'PATCH',
        headers: new Headers({
            'Authorization': 'Bearer ' + window.gapi.auth.getToken().access_token,
            'Content-Type': 'application/json'
        }),
        body: JSON.stringify(content),
    };

    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, fetchOptions);
};

/**
 * Main helper to add a deck to the history. 
 * Handles finding/creating the file and updating the list.
 */
export const addToHistory = async (deck: DeckHistoryItem): Promise<DeckHistoryItem[]> => {
    // 1. Ensure Drive API is loaded
    if (!window.gapi?.client || !window.gapi.client.drive) {
        try {
            await window.gapi.client.load('drive', 'v3');
        } catch (e) {
            console.error("Failed to load Drive API", e);
            return [];
        }
    }

    let fileId = await searchConfigFile();
    if (!fileId) {
        fileId = await createConfigFile();
    }

    const currentData = await readConfigFile(fileId);
    let history = currentData.recentDecks || [];

    // Remove existing entry if present (to bump to top)
    history = history.filter(item => item.spreadsheetId !== deck.spreadsheetId);

    // Add new entry to top
    history.unshift(deck);

    // Limit to 10 items
    if (history.length > 10) history = history.slice(0, 10);

    // Preserve existing streak info
    const streakInfo = currentData.streak || { count: 0, lastStudyDate: "" };

    await updateConfigFile(fileId, {
        _readme: currentData._readme || "This file stores your JantzCard session history. Please do not edit it manually.",
        recentDecks: history,
        streak: streakInfo
    });
    return history;
};

export const getHistory = async (): Promise<HistoryFileContent> => {
    if (!window.gapi?.client?.drive) {
        try {
            await window.gapi.client.load('drive', 'v3');
        } catch (e) {
            console.error("Failed to load Drive API", e);
            return { recentDecks: [] };
        }
    }

    const fileId = await searchConfigFile();
    if (!fileId) return { recentDecks: [] };

    const data = await readConfigFile(fileId);
    return data;
};

/**
 * Check and update streak.
 * Logic:
 * - If lastStudyDate == today: Do nothing.
 * - If lastStudyDate == yesterday: Increment streak, update date.
 * - If lastStudyDate < yesterday: Reset streak to 1, update date.
 * - If lastStudyDate == "": Set streak to 1, update date.
 */
export const updateStreak = async (): Promise<StreakInfo | null> => {
    if (!window.gapi?.client?.drive) {
        try {
            await window.gapi.client.load('drive', 'v3');
        } catch (e) {
            console.error("Failed to load Drive API", e);
            return null;
        }
    }

    let fileId = await searchConfigFile();
    if (!fileId) {
        fileId = await createConfigFile();
    }

    const currentData = await readConfigFile(fileId);

    // Use Local Time for "Today"
    // This ensures that 11:55 PM and 12:05 AM are treated as different days based on user's clock
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    let currentStreak = currentData.streak || { count: 0, lastStudyDate: "" };

    if (currentStreak.lastStudyDate === today) {
        // Already studied today
        return currentStreak;
    }

    // Calculate difference in days
    // We treat the stored date string as a local date (midnight start of that day)
    // and compare it to today's local date (midnight start of today).

    // Helper to parse YYYY-MM-DD as local midnight date object
    const parseLocalYMD = (ymd: string) => {
        const [y, m, d] = ymd.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const lastDate = currentStreak.lastStudyDate ? parseLocalYMD(currentStreak.lastStudyDate) : null;
    const todayDate = parseLocalYMD(today);

    let newCount = 1;

    if (lastDate) {
        const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            // Consecutive day
            newCount = currentStreak.count + 1;
        } else if (diffDays === 0) {
            // Same day (duplicate check covered above but good for safety)
            newCount = currentStreak.count;
        } else {
            // Streak broken
            newCount = 1;
        }
    }

    const newStreak: StreakInfo = {
        count: newCount,
        lastStudyDate: today
    };

    await updateConfigFile(fileId, {
        ...currentData,
        streak: newStreak
    });

    return newStreak;
};
