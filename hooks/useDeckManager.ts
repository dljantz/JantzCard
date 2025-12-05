
import { useState, useCallback, useEffect } from 'react';
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
import { addToHistory } from '../services/driveService';

const BACKLOG_STORAGE_KEY = 'jantzcard_pending_sheet_updates';

export interface UseDeckManagerReturn {
    cards: Card[];
    queue: string[];
    currentCard: Card | null;
    isLoading: boolean;
    syncMessage: string | null;
    error: string | null;
    pendingUpdatesCount: number;
    dataSource: DataSource;

    loadDeck: (source: DataSource, url?: string) => Promise<void>;
    reloadDeck: () => Promise<void>;
    updateCard: (card: Card) => Promise<void>;
    clearDeck: () => void;
}

export const useDeckManager = (): UseDeckManagerReturn => {
    const [dataSource, setDataSource] = useState<DataSource>(DataSource.Mock);
    const [cards, setCards] = useState<Card[]>([]);
    const [queue, setQueue] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pendingUpdates, setPendingUpdates] = useState<PendingCardUpdate[]>([]);

    // Internal Reference to Sheet ID (persisted in hook state for reload)
    const [currentSpreadsheetId, setCurrentSpreadsheetId] = useState<string | null>(null);

    // Load backlog on mount
    useEffect(() => {
        const savedBacklog = localStorage.getItem(BACKLOG_STORAGE_KEY);
        if (savedBacklog) {
            try {
                setPendingUpdates(JSON.parse(savedBacklog));
            } catch (e) {
                console.error("Failed to parse saved backlog", e);
            }
        }
    }, []);

    // Persist backlog helper
    const updateBacklog = (newBacklog: PendingCardUpdate[]) => {
        setPendingUpdates(newBacklog);
        localStorage.setItem(BACKLOG_STORAGE_KEY, JSON.stringify(newBacklog));
    };

    // Process Backlog Logic
    const processBacklog = useCallback(async (spreadsheetId: string, updates: PendingCardUpdate[]) => {
        if (updates.length === 0) return;
        console.log(`Attempting to sync ${updates.length} pending updates...`);

        try {
            await batchUpdateCards(spreadsheetId, updates);
            updateBacklog([]);
            console.log("Backlog synced successfully.");
        } catch (err) {
            console.error("Backlog sync failed:", err);
        }
    }, []);

    // --- Actions ---

    const clearDeck = useCallback(() => {
        setDataSource(DataSource.Mock); // Default back to known cleaning state? Or keep last.
        setCards([]);
        setQueue([]);
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
                setQueue(calculateStudyQueue(mockData));
                setCurrentSpreadsheetId(null);
            } else {
                // Sheet Loading
                if (!url) throw new Error("URL required for Sheet data source");

                const spreadsheetId = extractSpreadsheetId(url);
                if (!spreadsheetId) throw new Error("Invalid Sheet URL");

                setCurrentSpreadsheetId(spreadsheetId);
                localStorage.setItem('jantzcard_sheet_url', url);

                // 1. Load Data
                const loadedCards = await loadCardsFromSheet(spreadsheetId);
                if (loadedCards.length === 0) {
                    throw new Error("No cards found in sheet. Ensure data starts at Row 2.");
                }

                // 2. Merge Pending Updates
                let mergedCards = [...loadedCards];
                if (pendingUpdates.length > 0) {
                    setSyncMessage(`Syncing ${pendingUpdates.length} offline updates...`);
                    mergedCards = loadedCards.map(c => {
                        const pending = pendingUpdates.find(p => p.id === c.id);
                        return pending ? { ...c, lastSeen: pending.lastSeen, currentStudyInterval: pending.currentStudyInterval } : c;
                    });

                    // Try to sync backlog immediately
                    await processBacklog(spreadsheetId, pendingUpdates);
                    setSyncMessage(null);
                }

                setCards(mergedCards);
                const newQueue = calculateStudyQueue(mergedCards);
                if (newQueue.length === 0) {
                    // Not necessarily an error, just means user is done. But traditionally we treated it as "Check back later"
                    // Let's not throw, but maybe show a message or just empty queue.
                    // The UI handles empty queue as "Finished" if triggered during study, but on load it might look empty.
                    // Let's set error if TRULY empty and not just "done for today"? 
                    // Actually, `calculateStudyQueue` filters for overdue. If none overdue, queue is empty.
                    if (loadedCards.length > 0) {
                        setError("No overdue cards found! Check back later.");
                    }
                }
                setQueue(newQueue);

                // History Update (Fire and forget)
                getSpreadsheetTitle(spreadsheetId)
                    .then(title => addToHistory({ spreadsheetId, name: title, lastVisited: Date.now() }))
                    .catch(console.warn);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to load deck");
            setDataSource(DataSource.Mock); // Fallback? Or stay on Sheet but error?
        } finally {
            setIsLoading(false);
        }
    }, [pendingUpdates, processBacklog]);

    const reloadDeck = useCallback(async () => {
        if (dataSource !== DataSource.Sheet || !currentSpreadsheetId) return;

        setIsLoading(true);
        setSyncMessage("Reloading deck...");

        try {
            // Sync existing backlog first
            if (pendingUpdates.length > 0) {
                await processBacklog(currentSpreadsheetId, pendingUpdates);
            }

            const loadedCards = await loadCardsFromSheet(currentSpreadsheetId);

            let finalCards = loadedCards;
            // Re-apply backlog if sync failed
            if (pendingUpdates.length > 0) {
                finalCards = loadedCards.map(c => {
                    const pending = pendingUpdates.find(p => p.id === c.id);
                    return pending ? { ...c, lastSeen: pending.lastSeen, currentStudyInterval: pending.currentStudyInterval } : c;
                });
            }

            setCards(finalCards);
            setQueue(calculateStudyQueue(finalCards));
            setSyncMessage("Deck reloaded!");
            setTimeout(() => setSyncMessage(null), 2000);

        } catch (e: any) {
            setSyncMessage("Reload failed: " + e.message);
        } finally {
            setIsLoading(false);
        }
    }, [dataSource, currentSpreadsheetId, pendingUpdates, processBacklog]);

    const updateCard = useCallback(async (updatedCard: Card) => {
        setIsLoading(true);

        // Optimistic Update
        const newCards = cards.map(c => c.id === updatedCard.id ? updatedCard : c);
        setCards(newCards);
        setQueue(calculateStudyQueue(newCards));

        try {
            if (dataSource === DataSource.Sheet) {
                if (!currentSpreadsheetId) throw new Error("Spreadsheet ID lost");

                try {
                    await updateCardInSheet(currentSpreadsheetId, updatedCard);
                    setSyncMessage(null);

                    // If successful, try to clear any remaining backlog
                    if (pendingUpdates.length > 0) {
                        await processBacklog(currentSpreadsheetId, pendingUpdates);
                    }
                } catch (sheetError: any) {
                    if (sheetError instanceof RowNotFoundError) {
                        console.warn("Card deleted remotely. Removing from backlog.");
                        const newBacklog = pendingUpdates.filter(p => p.id !== updatedCard.id);
                        updateBacklog(newBacklog);
                        setSyncMessage("Sync skipped: Card deleted remotely.");
                    } else {
                        console.warn("Update failed, queueing offline.", sheetError);
                        const pending: PendingCardUpdate = {
                            id: updatedCard.id,
                            lastSeen: updatedCard.lastSeen,
                            currentStudyInterval: updatedCard.currentStudyInterval
                        };
                        const newBacklog = [...pendingUpdates.filter(p => p.id !== pending.id), pending];
                        updateBacklog(newBacklog);
                    }
                }
            } else {
                await updateMockCard(updatedCard);
            }
        } catch (e: any) {
            setSyncMessage("System Error: " + e.message);
        } finally {
            setIsLoading(false);
        }
    }, [cards, dataSource, currentSpreadsheetId, pendingUpdates, processBacklog]);

    const currentCard = queue.length > 0 ? cards.find(c => c.id === queue[0]) || null : null;

    return {
        cards,
        queue,
        currentCard,
        isLoading,
        syncMessage,
        error,
        pendingUpdatesCount: pendingUpdates.length,
        dataSource,
        loadDeck,
        reloadDeck,
        updateCard,
        clearDeck
    };
};
