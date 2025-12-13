
import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, DataSource } from '../types';
import { calculateStudyQueue } from './useStudyQueue';
import { getMockData, updateCard as updateMockCard } from '../services/dataService';
import {
    loadCardsFromSheet,
    updateCardInSheet,
    extractSpreadsheetId,
    batchUpdateCards,
    getSpreadsheetTitle,
    PendingCardUpdate,
    RowNotFoundError
} from '../services/sheetService';
import { addToHistory, updateStreak } from '../services/driveService';

const BACKLOG_STORAGE_KEY = 'jantzcard_pending_sheet_updates';
const ACTIVE_QUEUE_STORAGE_KEY = 'jantzcard_active_save_queue';

export interface UseDeckManagerReturn {
    cards: Card[];
    queue: string[];
    currentCard: Card | null;
    isLoading: boolean;
    isSaving: boolean;
    syncMessage: string | null;
    error: string | null;
    pendingUpdatesCount: number;
    dataSource: DataSource;

    loadDeck: (source: DataSource, url?: string) => Promise<void>;
    reloadDeck: () => Promise<void>;
    updateCard: (card: Card) => Promise<void>;
    clearDeck: () => void;
    initialQueueLength: number;
}

export const useDeckManager = (ensureToken?: () => Promise<string | null>): UseDeckManagerReturn => {
    const [dataSource, setDataSource] = useState<DataSource>(DataSource.Mock);
    const [cards, setCards] = useState<Card[]>([]);
    const [queue, setQueue] = useState<string[]>([]);
    const [initialQueueLength, setInitialQueueLength] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pendingUpdates, setPendingUpdates] = useState<PendingCardUpdate[]>([]);

    // Ref for pending updates to ensure synchronous access in loops
    const pendingUpdatesRef = useRef<PendingCardUpdate[]>([]);

    // Queue for processing sequential saves
    const saveQueueRef = useRef<Card[]>([]);
    const isProcessingQueueRef = useRef(false);

    // Internal Reference to Sheet ID (persisted in hook state for reload)
    const [currentSpreadsheetId, setCurrentSpreadsheetId] = useState<string | null>(null);

    // Helper to update both state and ref and local storage
    const updateBacklog = useCallback((newBacklog: PendingCardUpdate[]) => {
        pendingUpdatesRef.current = newBacklog;
        setPendingUpdates(newBacklog);
        localStorage.setItem(BACKLOG_STORAGE_KEY, JSON.stringify(newBacklog));
    }, []);

    // Load backlog and recover stranded active items on mount
    useEffect(() => {
        let initialBacklog: PendingCardUpdate[] = [];

        // 1. Load normal backlog
        const savedBacklog = localStorage.getItem(BACKLOG_STORAGE_KEY);
        if (savedBacklog) {
            try {
                initialBacklog = JSON.parse(savedBacklog);
            } catch (e) {
                console.error("Failed to parse saved backlog", e);
            }
        }

        // 2. Check for stranded active items (app closed while saving)
        const strandedQueue = localStorage.getItem(ACTIVE_QUEUE_STORAGE_KEY);
        if (strandedQueue) {
            try {
                const strandedItems: Card[] = JSON.parse(strandedQueue);
                if (strandedItems.length > 0) {
                    const msg = `Recovered ${strandedItems.length} unsaved updates from interrupted session.`;
                    console.warn(msg);
                    setSyncMessage(msg);
                    // Convert Card[] to PendingCardUpdate[]
                    const recoveredUpdates: PendingCardUpdate[] = strandedItems.map(c => ({
                        id: c.id,
                        lastSeen: c.lastSeen,
                        currentStudyInterval: c.currentStudyInterval,
                        updatedAt: c.updatedAt
                    }));

                    // Merge, favoring recovered items if duplicates exist (they are newer)
                    initialBacklog = [
                        ...initialBacklog.filter(b => !recoveredUpdates.some(r => r.id === b.id)),
                        ...recoveredUpdates
                    ];

                    // Clear the active queue now that we've "rescued" them to backlog
                    localStorage.removeItem(ACTIVE_QUEUE_STORAGE_KEY);
                }
            } catch (e) {
                console.error("Failed to recover stranded queue", e);
            }
        }

        // Initialize Ref and State
        if (initialBacklog.length > 0) {
            updateBacklog(initialBacklog);
        }

        // 3. Restore Sheet ID if known, to allow background syncing
        const savedUrl = localStorage.getItem('jantzcard_sheet_url');
        if (savedUrl) {
            const id = extractSpreadsheetId(savedUrl);
            if (id) setCurrentSpreadsheetId(id);
        }
    }, [updateBacklog]);

    // Process Backlog Logic
    const processBacklog = useCallback(async (spreadsheetId: string) => {
        const currentUpdates = pendingUpdatesRef.current;
        if (currentUpdates.length === 0) return;

        if (dataSource === DataSource.Sheet && ensureToken) {
            await ensureToken();
        }

        console.log(`Attempting to sync ${currentUpdates.length} pending updates...`);
        if (!isProcessingQueueRef.current) setSyncMessage(`Syncing ${currentUpdates.length} offline updates...`);

        try {
            await batchUpdateCards(spreadsheetId, currentUpdates);
            updateBacklog([]);
            if (!isProcessingQueueRef.current) setSyncMessage("Backlog synced successfully.");
            setTimeout(() => { if (!isProcessingQueueRef.current) setSyncMessage(null); }, 3000);
            console.log("Backlog synced successfully.");
        } catch (err) {
            console.error("Backlog sync failed:", err);
            // Keep them in backlog
        }
    }, [updateBacklog, ensureToken, dataSource]);

    // Cleanup interval on unmount
    useEffect(() => {
        const interval = setInterval(() => {
            const hasPending = pendingUpdatesRef.current.length > 0;
            if (currentSpreadsheetId && hasPending && !isProcessingQueueRef.current && !isSaving) {
                console.log("Triggering periodic background sync...");
                processBacklog(currentSpreadsheetId);
            }
        }, 10000); // Check every 10 seconds

        return () => clearInterval(interval);
    }, [currentSpreadsheetId, isSaving, processBacklog]);

    // --- Actions ---

    const clearDeck = useCallback(() => {
        setDataSource(DataSource.Mock);
        setCards([]);
        setQueue([]);
        setInitialQueueLength(0);
        setError(null);
        setSyncMessage(null);
    }, []);

    const loadDeck = useCallback(async (source: DataSource, url?: string) => {
        setError(null);
        setSyncMessage(null);
        setDataSource(source);
        setIsLoading(true);

        try {
            if (source === DataSource.Mock) {
                const mockData = getMockData();
                setCards(mockData);
                const newQueue = calculateStudyQueue(mockData);
                setQueue(newQueue);
                setInitialQueueLength(newQueue.length);
                setCurrentSpreadsheetId(null);
            } else {
                // Sheet Loading
                if (!url) throw new Error("URL required for Sheet data source");

                if (ensureToken) {
                    const token = await ensureToken();
                    if (!token) throw new Error("Authentication required");
                }

                const spreadsheetId = extractSpreadsheetId(url);
                if (!spreadsheetId) throw new Error("Invalid Sheet URL");

                setCurrentSpreadsheetId(spreadsheetId);
                localStorage.setItem('jantzcard_sheet_url', url);

                // 0. Try to sync backlog immediately before loading (if we have one)
                if (pendingUpdatesRef.current.length > 0) {
                    await processBacklog(spreadsheetId);
                }

                // 1. Load Data
                const loadedCards = await loadCardsFromSheet(spreadsheetId);
                if (loadedCards.length === 0) {
                    throw new Error("No cards found in sheet. Ensure data starts at Row 2.");
                }

                // 2. Re-apply any pending updates that FAILED to sync just now
                let mergedCards = [...loadedCards];
                if (pendingUpdatesRef.current.length > 0) {
                    const currentUpdates = pendingUpdatesRef.current;
                    setSyncMessage(`Syncing ${currentUpdates.length} offline updates...`); // Show persistent msg
                    mergedCards = loadedCards.map(c => {
                        const pending = currentUpdates.find(p => p.id === c.id);
                        return pending ? { ...c, lastSeen: pending.lastSeen, currentStudyInterval: pending.currentStudyInterval } : c;
                    });
                }

                setCards(mergedCards);
                const newQueue = calculateStudyQueue(mergedCards);
                if (newQueue.length === 0 && loadedCards.length > 0) {
                    setError("No overdue cards found! Check back later.");
                }
                setQueue(newQueue);
                setInitialQueueLength(newQueue.length);

                // History Update (Fire and forget)
                getSpreadsheetTitle(spreadsheetId)
                    .then(title => addToHistory({ spreadsheetId, name: title, lastVisited: Date.now() }))
                    .catch(console.warn);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to load deck");
            setDataSource(DataSource.Mock);
        } finally {
            setIsLoading(false);
        }
    }, [processBacklog, ensureToken]);

    const reloadDeck = useCallback(async () => {
        if (dataSource !== DataSource.Sheet || !currentSpreadsheetId) return;

        setIsLoading(true);
        setSyncMessage("Reloading deck...");

        try {
            if (ensureToken) await ensureToken();

            // Sync existing backlog first
            await processBacklog(currentSpreadsheetId);

            const loadedCards = await loadCardsFromSheet(currentSpreadsheetId);

            let finalCards = loadedCards;
            // Re-apply backlog if sync failed
            if (pendingUpdatesRef.current.length > 0) {
                const currentUpdates = pendingUpdatesRef.current;
                finalCards = loadedCards.map(c => {
                    const pending = currentUpdates.find(p => p.id === c.id);
                    return pending ? { ...c, lastSeen: pending.lastSeen, currentStudyInterval: pending.currentStudyInterval } : c;
                });
            }

            setCards(finalCards);
            const newQueue = calculateStudyQueue(finalCards);
            setQueue(newQueue);
            setInitialQueueLength(newQueue.length);
            setSyncMessage("Deck reloaded!");
            setTimeout(() => setSyncMessage(null), 2000);

        } catch (e: any) {
            setSyncMessage("Reload failed: " + e.message);
        } finally {
            setIsLoading(false);
        }
    }, [dataSource, currentSpreadsheetId, processBacklog, ensureToken]);

    // Unified process for handling the save queue
    const processSaveQueue = useCallback(async () => {
        if (isProcessingQueueRef.current || saveQueueRef.current.length === 0) return;

        isProcessingQueueRef.current = true;
        setIsSaving(true);
        setSyncMessage("Saving..."); // Keep user informed

        try {
            while (saveQueueRef.current.length > 0) {
                const nextCard = saveQueueRef.current[0]; // Peek

                // If not sheet, just mock update and shift
                if (dataSource !== DataSource.Sheet) {
                    await updateMockCard(nextCard);
                    saveQueueRef.current.shift();
                    continue;
                }

                let targetSheetId = currentSpreadsheetId;
                if (!targetSheetId) {
                    // Try to recover ID from local storage if lost (e.g. reload)
                    const savedUrl = localStorage.getItem('jantzcard_sheet_url');
                    targetSheetId = savedUrl ? extractSpreadsheetId(savedUrl) : null;
                    if (!targetSheetId) throw new Error("Spreadsheet ID lost");
                    setCurrentSpreadsheetId(targetSheetId); // Update state for next time
                }

                // Ensure token before saving each card (or at least check)
                if (ensureToken) {
                    try {
                        await ensureToken();
                    } catch (e) {
                        // If auth fails/cancels, we should probably stop the loop and let it retry later?
                        // Or treat as "Update failed, queueing offline".
                        console.warn("Auth check failed during save", e);
                        // Throw to trigger catch block which queues item locally
                        throw new Error("Authentication failed");
                    }
                }

                try {
                    await updateCardInSheet(targetSheetId, nextCard);

                    // Success! Remove from queue
                    saveQueueRef.current.shift();
                    localStorage.setItem(ACTIVE_QUEUE_STORAGE_KEY, JSON.stringify(saveQueueRef.current));

                    // If successful, try to clear any remaining backlog from offline usage
                    if (pendingUpdatesRef.current.length > 0) {
                        try {
                            await batchUpdateCards(targetSheetId, pendingUpdatesRef.current);
                            updateBacklog([]);
                            console.log("Backlog cleared after successful save.");
                        } catch (e) {
                            console.warn("Failed to clear backlog in invalid connectivity window", e);
                        }
                    }
                } catch (sheetError: any) {
                    // Failed for this specific card
                    saveQueueRef.current.shift(); // Remove from active queue to unblock next items
                    localStorage.setItem(ACTIVE_QUEUE_STORAGE_KEY, JSON.stringify(saveQueueRef.current)); // Update persistence

                    if (sheetError instanceof RowNotFoundError) {
                        console.warn("Card deleted remotely. Removing from backlog.");
                        const newBacklog = pendingUpdatesRef.current.filter(p => p.id !== nextCard.id);
                        updateBacklog(newBacklog);
                        setSyncMessage("Sync skipped: Card deleted remotely.");
                    } else {
                        console.warn("Update failed, queueing offline.", sheetError);
                        const pending: PendingCardUpdate = {
                            id: nextCard.id,
                            lastSeen: nextCard.lastSeen,
                            currentStudyInterval: nextCard.currentStudyInterval,
                            updatedAt: nextCard.updatedAt
                        };
                        // Add to persistent backlog using REF to ensure we don't lose previous failures in this loop
                        const newBacklog = [...pendingUpdatesRef.current.filter(p => p.id !== pending.id), pending];
                        updateBacklog(newBacklog);
                    }
                }
            }
            setSyncMessage(null);
        } catch (e: any) {
            setSyncMessage("System Error during save: " + e.message);
        } finally {
            isProcessingQueueRef.current = false;
            setIsSaving(false);
            // Final cleanup check (queue should be empty here if loop finished naturally)
            if (saveQueueRef.current.length === 0) {
                localStorage.removeItem(ACTIVE_QUEUE_STORAGE_KEY);
            }
        }
    }, [dataSource, currentSpreadsheetId, processBacklog, updateBacklog, ensureToken]);

    // Local override to avoid excessive API calls
    const hasUpdatedStreakRef = useRef(false);

    const updateCard = useCallback(async (updatedCard: Card) => {
        // Inject timestamp for conflict resolution
        updatedCard.updatedAt = new Date().toISOString();

        // Optimistic Update (Immediate UI reflection)
        const newCards = cards.map(c => c.id === updatedCard.id ? updatedCard : c);
        setCards(newCards);
        setQueue(calculateStudyQueue(newCards));

        // Add to queue and trigger processing
        saveQueueRef.current.push(updatedCard);
        localStorage.setItem(ACTIVE_QUEUE_STORAGE_KEY, JSON.stringify(saveQueueRef.current));

        processSaveQueue();

        // Update Streak (fire and forget, once per session/load)
        // We only try once per session to save bandwidth, 
        // assuming the user doesn't cross midnight during a single page load often.
        if (!hasUpdatedStreakRef.current && dataSource === DataSource.Sheet) {
            hasUpdatedStreakRef.current = true;
            updateStreak().catch((e: any) => console.error("Failed to update streak", e));
        }

    }, [cards, dataSource, currentSpreadsheetId, processSaveQueue]);

    const currentCard = queue.length > 0 ? cards.find(c => c.id === queue[0]) || null : null;

    return {
        cards,
        queue,
        currentCard,
        isLoading,
        isSaving,
        syncMessage,
        error,
        pendingUpdatesCount: pendingUpdates.length,
        dataSource,
        loadDeck,
        reloadDeck,
        updateCard,
        clearDeck,
        initialQueueLength
    };
};
