
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
}

const REQUIRED_HEADERS = ['Front', 'Back'];

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
    const response = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title'
    });
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
  const response = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Deck!1:1', // Fetch just the first row
  });

  const headers = response.result.values?.[0];
  if (!headers || headers.length === 0) {
    throw new Error("Sheet is empty or missing headers in Row 1.");
  }

  const mapping: any = {};

  // Create a case-insensitive lookup
  headers.forEach((header: string, index: number) => {
    mapping[header.trim()] = index;
  });

  // Validate required headers
  const missing = REQUIRED_HEADERS.filter(h => mapping[h] === undefined);
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}. Please add them to Row 1.`);
  }

  return mapping as ColumnMapping;
};

/**
 * Loads cards from the user's spreadsheet using dynamic column mapping.
 */
export const loadCardsFromSheet = async (spreadsheetId: string): Promise<Card[]> => {
  if (!window.gapi?.client?.sheets) {
    throw new Error("Google Sheets API not loaded");
  }

  // 1. Get Column Mapping
  const mapping = await getColumnMapping(spreadsheetId);

  // 2. Fetch Data (Row 2 onwards)
  const response = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Deck!A2:ZZ', // Fetch a wide range to be safe
  });

  const rows = response.result.values;
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((row: any[]) => {
    // Helper to safely get value at index
    const getVal = (colIdx?: number) => colIdx !== undefined ? row[colIdx] : undefined;

    let id = getVal(mapping.ID);
    const status = getVal(mapping.Status);

    // If ID is missing, generate one in memory (will be saved later)
    if (!id) {
      id = generateUniqueId();
    }

    // Logic for Priority
    const parsedPriority = parseInt(getVal(mapping.Priority));
    const priorityLevel = isNaN(parsedPriority) ? Number.MAX_SAFE_INTEGER : parsedPriority;

    return {
      id: id,
      front: getVal(mapping.Front) || '',
      back: getVal(mapping.Back) || '',
      category: getVal(mapping.Category) || 'General',
      priorityLevel: priorityLevel,
      lastSeen: getVal(mapping['Last Seen']) || null,
      currentStudyInterval: getVal(mapping.Interval) || null,
      status: status || 'Active',
    };
  }).filter((c: Card) => !!c.front && c.status !== 'Inactive');
};

/**
 * Helper to find the row index for a specific card.
 */
const findRowForCard = async (spreadsheetId: string, card: Card, mapping: ColumnMapping): Promise<number | null> => {
  const response = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Deck!A2:ZZ',
    majorDimension: 'ROWS'
  });

  const rows = response.result.values;
  if (!rows) return null;

  // Search by ID first
  if (mapping.ID !== undefined) {
    const idIndex = mapping.ID;
    const foundIndex = rows.findIndex((row: any[]) => row[idIndex] === card.id);
    if (foundIndex !== -1) return foundIndex + 2;
  }

  // Fallback: Search by Content
  const foundIndex = rows.findIndex((row: any[]) =>
    row[mapping.Front] === card.front &&
    row[mapping.Back] === card.back
  );

  return foundIndex !== -1 ? foundIndex + 2 : null;
};

/**
 * Updates Last Seen, Interval, and ID for a specific card.
 */
export const updateCardInSheet = async (spreadsheetId: string, card: Card): Promise<void> => {
  if (!window.gapi?.client?.sheets) {
    throw new Error("Google Sheets API not loaded");
  }

  const mapping = await getColumnMapping(spreadsheetId);
  const rowNumber = await findRowForCard(spreadsheetId, card, mapping);

  if (!rowNumber) {
    throw new RowNotFoundError(`Could not find row for card ID: ${card.id}.`);
  }

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

  if (updates.length > 0) {
    await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {
        valueInputOption: 'RAW',
        data: updates
      }
    });
  }
};

/**
 * Performs a batch update for multiple cards.
 */
export const batchUpdateCards = async (spreadsheetId: string, updates: PendingCardUpdate[]): Promise<void> => {
  if (!window.gapi?.client?.sheets) {
    throw new Error("Google Sheets API not loaded");
  }

  const mapping = await getColumnMapping(spreadsheetId);

  // Fetch current rows to map IDs
  const response = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Deck!A2:ZZ',
  });
  const rows = response.result.values || [];

  const data: any[] = [];

  for (const update of updates) {
    let rowIndex = -1;

    // Find row by ID
    if (mapping.ID !== undefined) {
      rowIndex = rows.findIndex((row: any[]) => row[mapping.ID!] === update.id);
    }

    if (rowIndex !== -1) {
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
    }
  }

  if (data.length === 0) return;

  await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource: {
      valueInputOption: 'RAW',
      data: data
    }
  });
};
