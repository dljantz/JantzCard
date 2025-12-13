
import { Card } from '../types';

export class RowNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RowNotFoundError";
  }
}

export interface PendingCardUpdate {
  id: string;
  lastSeen: string | null;
  currentStudyInterval: string | null;
  updatedAt?: string;
}

interface ColumnMapping {
  // Required
  Front: number;
  Back: number;

  // Optional (defaults available)
  Category?: number;
  Priority?: number;
  'Last Seen'?: number;
  Interval?: number;
  Status?: number;
  ID?: number;
  Updated?: number;
}


const REQUIRED_HEADERS = ['Front', 'Back'];
const API_TIMEOUT_MS = 5000;

/**
 * Wraps a promise with a timeout.
 */
const withTimeout = <T>(promise: Promise<T>, ms: number = API_TIMEOUT_MS): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out. Please check your internet and try again.')), ms)
    )
  ]);
};

/**
 * Converts a zero-based column index to A1 notation column letter (e.g., 0 -> A, 26 -> AA).
 */
export const getColumnLetter = (colIndex: number): string => {
  let temp, letter = '';
  while (colIndex >= 0) {
    temp = colIndex % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor(colIndex / 26) - 1;
  }
  return letter;
};

/**
 * Extracts the Spreadsheet ID from a standard Google Sheets URL.
 */
export const extractSpreadsheetId = (url: string): string | null => {
  const matches = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return matches ? matches[1] : null;
};

/**
 * Fetches the title of the spreadsheet.
 */
export const getSpreadsheetTitle = async (spreadsheetId: string): Promise<string> => {
  if (!window.gapi?.client?.sheets) {
    return "Unknown Deck";
  }
  try {
    const response = await withTimeout<any>(window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title'
    }));
    return response.result.properties?.title || "Untitled Deck";
  } catch (e) {
    console.error("Failed to fetch sheet title", e);
    return "Study Deck";
  }
};

/**
 * Generates a unique ID for cards that don't have one.
 */
const generateUniqueId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * Fetches the header row (Row 1) and maps column names to indices.
 */
const getColumnMapping = async (spreadsheetId: string): Promise<ColumnMapping> => {
  const response = await withTimeout<any>(window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Deck!1:1', // Fetch just the first row
  }));

  const headers = response.result.values?.[0];
  if (!headers || headers.length === 0) {
    throw new Error("We couldn't find any data. Please make sure Row 1 has headers like 'Front' and 'Back'.");
  }

  const mapping: any = {};

  // Create a case-insensitive lookup
  headers.forEach((header: string, index: number) => {
    mapping[header.trim()] = index;
  });

  // Validate required headers
  const missing = REQUIRED_HEADERS.filter(h => mapping[h] === undefined);
  if (missing.length > 0) {
    throw new Error(`Your sheet is missing these columns: ${missing.join(', ')}. Please add them to Row 1 to continue.`);
  }

  return mapping as ColumnMapping;
};

/**
 * Loads cards from the user's spreadsheet using dynamic column mapping.
 * Enforces unique IDs: if missing or duplicate, generates new IDs and saves to Sheet.
 */
export const loadCardsFromSheet = async (spreadsheetId: string): Promise<Card[]> => {
  if (!window.gapi?.client?.sheets) {
    throw new Error("Google Services inactive. Please refresh the page.");
  }

  // 1. Get Column Mapping
  const mapping = await getColumnMapping(spreadsheetId);

  // 2. Fetch Data (Row 2 onwards)
  const response = await withTimeout<any>(window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Deck!A2:ZZ', // Fetch a wide range to be safe
  }));

  const rows = response.result.values;
  if (!rows || rows.length === 0) {
    return [];
  }

  const seenIds = new Set<string>();
  const updates: { range: string; values: any[][] }[] = [];
  const cards: Card[] = [];

  rows.forEach((row: any[], index: number) => {
    // Helper to safely get value at index
    const getVal = (colIdx?: number) => colIdx !== undefined ? row[colIdx] : undefined;

    let id = getVal(mapping.ID);
    let needsUpdate = false;

    // 0. Skip Empty Rows (No Front)
    const front = getVal(mapping.Front);
    if (!front || String(front).trim() === '') {
      return; // Skip this row entirely
    }

    // 1. Check for Missing ID
    if (!id) {
      id = generateUniqueId();
      needsUpdate = true;
    }

    // Enforce string ID to avoid type mismatches
    id = String(id);

    // 2. Check for Duplicate ID
    if (seenIds.has(id)) {
      id = generateUniqueId();
      needsUpdate = true;
    }

    seenIds.add(id);

    // Queue update if needed (and if we have an ID column to write to)
    if (needsUpdate && mapping.ID !== undefined) {
      const rowNumber = index + 2; // Rows are 1-indexed, and data starts at Row 2
      const colLetter = getColumnLetter(mapping.ID);
      updates.push({
        range: `Deck!${colLetter}${rowNumber}`,
        values: [[id]]
      });
    }

    const status = getVal(mapping.Status);

    // Logic for Priority
    const parsedPriority = parseInt(getVal(mapping.Priority));
    const priorityLevel = isNaN(parsedPriority) ? Number.MAX_SAFE_INTEGER : parsedPriority;

    cards.push({
      id: id,
      front: getVal(mapping.Front) || '',
      back: getVal(mapping.Back) || '',
      category: getVal(mapping.Category) || 'General',
      priorityLevel: priorityLevel,
      lastSeen: getVal(mapping['Last Seen']) || null,
      currentStudyInterval: getVal(mapping.Interval) || null,
      status: status || 'Active',
      updatedAt: getVal(mapping.Updated),
    });
  });

  // 3. Batch Update Fixes to Sheet (Fire and Forget-ish, but await to be safe)
  if (updates.length > 0) {
    // console.log(`Fixing ${updates.length} invalid/duplicate IDs in sheet...`);
    try {
      await withTimeout(window.gapi.client.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: 'RAW',
          data: updates
        }
      }));
      // console.log("ID fixes saved to sheet.");
    } catch (e) {
      console.error("Failed to save generated IDs to sheet:", e);
      // We continue anyway, returning the cards with valid local IDs so the app works.
      // The next reload might fix it or encounter the same issue if save failed.
    }
  }

  return cards.filter((c: Card) => !!c.front && c.status !== 'Inactive');
};

/**
 * Helper to find the row index for a specific card.
 */
const findRowForCard = async (spreadsheetId: string, card: Card, mapping: ColumnMapping): Promise<number | null> => {
  const response = await withTimeout<any>(window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Deck!A2:ZZ',
    majorDimension: 'ROWS'
  }));

  const rows = response.result.values;
  if (!rows) return null;

  // Search by ID first
  if (mapping.ID !== undefined) {
    const idIndex = mapping.ID;
    const foundIndex = rows.findIndex((row: any[]) => String(row[idIndex]) === String(card.id));
    if (foundIndex !== -1) return foundIndex + 2;
  }

  // Fallback: Search by Content
  const foundIndex = rows.findIndex((row: any[]) => {
    const sheetFront = String(row[mapping.Front] ?? '').trim();
    const sheetBack = String(row[mapping.Back] ?? '').trim();
    return sheetFront === card.front.trim() && sheetBack === card.back.trim();
  });

  return foundIndex !== -1 ? foundIndex + 2 : null;
};

/**
 * Updates Last Seen, Interval, and ID for a specific card.
 */
export const updateCardInSheet = async (spreadsheetId: string, card: Card): Promise<void> => {
  if (!window.gapi?.client?.sheets) {
    throw new Error("Google Services inactive. Please refresh the page.");
  }

  const mapping = await getColumnMapping(spreadsheetId);
  const rowNumber = await findRowForCard(spreadsheetId, card, mapping);

  if (!rowNumber) {
    console.warn(`RowNotFoundError Debug: ID '${card.id}' not found. Searched using mapping:`, mapping);
    // Optional: could log more details about what WAS found if needed, but that might spam.
    throw new RowNotFoundError(`Sync Error: Card data could not be found in the sheet.`);
  }

  // Check for conflict
  // We need to fetch the CURRENT row to compare timestamps.
  // Note: findRowForCard already fetches the whole sheet (inefficient but safe for now),
  // but it returns an index. We might need to refactor or just fetch the specific row again if we had the index.
  // Since we don't have the row data from findRowForCard, let's just fetch the specific cell for 'Updated' if possible,
  // or more simply, let's rely on the fact that we need to read before write for conflict resolution.

  // Actually, to be safe and atomic-ish, we should check the timestamp.
  // We can fetch just the 'Updated' column for that row.
  let shouldUpdate = true;
  if (mapping.Updated !== undefined) {
    const updatedColLetter = getColumnLetter(mapping.Updated);
    const timeResponse = await withTimeout<any>(window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `Deck!${updatedColLetter}${rowNumber}`
    }));
    const remoteUpdated = timeResponse.result.values?.[0]?.[0];

    if (remoteUpdated && card.updatedAt) {
      const remoteTime = new Date(remoteUpdated).getTime();
      const localTime = new Date(card.updatedAt).getTime();
      if (remoteTime >= localTime) {
        console.warn(`Conflict detected for card ${card.id}. Remote (${remoteUpdated}) is newer or equal to local (${card.updatedAt}). Skipping update.`);
        shouldUpdate = false;
      }
    }
  }

  if (!shouldUpdate) return; // Hook should handle this as "success" or explicit "skipped"? 
  // User asked for "Last Write Wins" based on timestamp. If we skip, we are letting remote win.

  const updates: any[] = [];

  // Helper to push update if column exists
  const addUpdate = (colIdx: number | undefined, value: any) => {
    if (colIdx !== undefined) {
      const colLetter = getColumnLetter(colIdx);
      updates.push({
        range: `Deck!${colLetter}${rowNumber}`,
        values: [[value]]
      });
    }
  };

  addUpdate(mapping['Last Seen'], card.lastSeen);
  addUpdate(mapping.Interval, card.currentStudyInterval);
  addUpdate(mapping.Status, card.status || 'Active');
  addUpdate(mapping.ID, card.id);
  addUpdate(mapping.Updated, card.updatedAt);

  if (updates.length > 0) {
    await withTimeout(window.gapi.client.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {
        valueInputOption: 'RAW',
        data: updates
      }
    }));
  }
};

/**
 * Performs a batch update for multiple cards.
 */
export const batchUpdateCards = async (spreadsheetId: string, updates: PendingCardUpdate[]): Promise<void> => {
  if (!window.gapi?.client?.sheets) {
    throw new Error("Google Services inactive. Please refresh the page.");
  }

  const mapping = await getColumnMapping(spreadsheetId);

  // Fetch current rows to map IDs
  const response = await withTimeout<any>(window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Deck!A2:ZZ',
  }));
  const rows = response.result.values || [];

  const data: any[] = [];

  for (const update of updates) {
    let rowIndex = -1;

    // Find row by ID
    if (mapping.ID !== undefined) {
      rowIndex = rows.findIndex((row: any[]) => String(row[mapping.ID!]) === String(update.id));
    }

    if (rowIndex !== -1) {
      // Conflict Resolution for Batch
      let shouldUpdate = true;
      if (mapping.Updated !== undefined && update.updatedAt) {
        const remoteUpdated = rows[rowIndex][mapping.Updated];
        if (remoteUpdated) {
          const remoteTime = new Date(remoteUpdated).getTime();
          const localTime = new Date(update.updatedAt).getTime();
          if (remoteTime >= localTime) {
            console.warn(`Conflict: Remote ${remoteUpdated} >= Local ${update.updatedAt} for card ${update.id}`);
            shouldUpdate = false;
          }
        }
      }

      if (shouldUpdate) {
        const rowNumber = rowIndex + 2;

        const addUpdate = (colIdx: number | undefined, value: any) => {
          if (colIdx !== undefined) {
            const colLetter = getColumnLetter(colIdx);
            data.push({
              range: `Deck!${colLetter}${rowNumber}`,
              values: [[value]]
            });
          }
        };

        addUpdate(mapping['Last Seen'], update.lastSeen);
        addUpdate(mapping.Interval, update.currentStudyInterval);
        addUpdate(mapping.ID, update.id); // Ensure ID is persisted/re-affirmed
        addUpdate(mapping.Updated, update.updatedAt);
      }
    }
  }

  if (data.length === 0) return;

  await withTimeout(window.gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource: {
      valueInputOption: 'RAW',
      data: data
    }
  }));
};
