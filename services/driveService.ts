
const FILE_NAME = 'jantzcard_history.json';
const MIME_TYPE = 'application/json';

export interface DeckHistoryItem {
    spreadsheetId: string;
    name: string;
    lastVisited: number;
}

export interface HistoryFileContent {
    recentDecks: DeckHistoryItem[];
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

    const content = {
        recentDecks: []
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
        // Attempt to load it if not ready? For now, assume App.tsx initializes it.
        // If we are strictly following the hooks pattern, we might need to check this better.
        // But let's proceed assuming the scope grant was successful.
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

    await updateConfigFile(fileId, { recentDecks: history });
    return history;
};

export const getHistory = async (): Promise<DeckHistoryItem[]> => {
    if (!window.gapi?.client?.drive) {
        try {
            await window.gapi.client.load('drive', 'v3');
        } catch (e) {
            console.error("Failed to load Drive API", e);
            return [];
        }
    }

    const fileId = await searchConfigFile();
    if (!fileId) return [];

    const data = await readConfigFile(fileId);
    return data.recentDecks || [];
};
