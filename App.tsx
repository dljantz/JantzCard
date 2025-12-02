
import React, { useState, useCallback, useEffect } from 'react';
import { Card, AppState, DataSource } from './types';
import { calculateStudyQueue } from './hooks/useStudyQueue';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import HomeScreen from './components/HomeScreen';
import StudyScreen from './components/StudyScreen';
import CompletionScreen from './components/CompletionScreen';
import { getMockData, updateCard as updateMockCard } from './services/dataService';
import { 
  loadCardsFromSheet, 
  updateCardInSheet, 
  extractSpreadsheetId, 
  batchUpdateCards, 
  PendingCardUpdate,
  RowNotFoundError
} from './services/sheetService';

const BACKLOG_STORAGE_KEY = 'jantzcard_pending_sheet_updates';

// Temporary debugging helper to log queue state
const logQueueToConsole = (queue: string[], cards: Card[]) => {
  console.log('%c--- Current Study Queue ---', 'color: #4ade80; font-weight: bold;');
  const output = queue.map(id => {
    const card = cards.find(c => c.id === id);
    return card ? card.front : `[Unknown ID: ${id}]`;
  }).join('\n');
  console.log(output || "(Queue is empty)");
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Home);
  const [dataSource, setDataSource] = useState<DataSource>(DataSource.Mock);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [sessionQueue, setSessionQueue] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  
  // Backlog state for offline capability
  const [pendingUpdates, setPendingUpdates] = useState<PendingCardUpdate[]>([]);

  // Google Auth Hook
  const { 
    isReady, 
    initializeClient, 
    login, 
    logout, 
    currentUser, 
    error: authError,
    isLoading: isAuthLoading
  } = useGoogleAuth();

  // Load backlog from local storage on mount
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

  // Helper to persist backlog changes
  const updateBacklog = (newBacklog: PendingCardUpdate[]) => {
    setPendingUpdates(newBacklog);
    localStorage.setItem(BACKLOG_STORAGE_KEY, JSON.stringify(newBacklog));
  };

  const handleStartMockStudy = useCallback(() => {
    setDataSource(DataSource.Mock);
    const cardsData = getMockData();
    setAllCards(cardsData);
    const initialQueue = calculateStudyQueue(cardsData);
    setSessionQueue(initialQueue);
    logQueueToConsole(initialQueue, cardsData);
    setAppState(AppState.Studying);
  }, []);

  // Attempt to flush the backlog to the sheet
  const processBacklog = useCallback(async (spreadsheetId: string, updates: PendingCardUpdate[]) => {
    if (updates.length === 0) return;
    
    console.log(`Attempting to sync ${updates.length} pending updates...`);
    
    try {
      await batchUpdateCards(spreadsheetId, updates);
      // Success: Clear backlog
      updateBacklog([]);
      console.log("Backlog synced successfully.");
    } catch (err: any) {
      console.error("Backlog sync failed:", err);
      // We do NOT clear the backlog here. It remains for the next attempt.
      // We also don't throw, so the main flow can continue.
    }
  }, []);

  const handleStartSheetStudy = useCallback(async (sheetUrl: string) => {
    setAppError(null);
    setSyncMessage(null);
    
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      setAppError("Invalid Sheet URL. Could not extract Spreadsheet ID.");
      return;
    }

    setIsSyncing(true);
    try {
      setDataSource(DataSource.Sheet);

      // 1. Load fresh data
      const cardsData = await loadCardsFromSheet(spreadsheetId);
      
      if (cardsData.length === 0) {
        setAppError("Found no cards in the sheet. Please ensure data starts at Row 2.");
        setIsSyncing(false);
        return;
      }

      setAllCards(cardsData);

      // 2. Merge pending updates
      let cardsForQueue = [...cardsData];
      if (pendingUpdates.length > 0) {
        setSyncMessage(`Syncing ${pendingUpdates.length} offline updates...`);
        
        // Merge local pending updates into the fresh data for the session
        cardsForQueue = cardsData.map(card => {
          const pending = pendingUpdates.find(p => p.id === card.id);
          if (pending) {
            return { 
              ...card, 
              lastSeen: pending.lastSeen, 
              currentStudyInterval: pending.currentStudyInterval 
            };
          }
          return card;
        });
        setAllCards(cardsForQueue);

        // Try to push to sheet
        await processBacklog(spreadsheetId, pendingUpdates);
        setSyncMessage(null);
      }

      const initialQueue = calculateStudyQueue(cardsForQueue);
      
      if (initialQueue.length === 0) {
        setAppError("No overdue cards found! Check back later.");
        setIsSyncing(false);
        return;
      }

      setSessionQueue(initialQueue);
      logQueueToConsole(initialQueue, cardsForQueue);
      setAppState(AppState.Studying);
    } catch (err: any) {
      console.error(err);
      const msg = err.result?.error?.message || err.message || "Unknown error";
      setAppError("Failed to load cards: " + msg);
      setDataSource(DataSource.Mock); 
    } finally {
      setIsSyncing(false);
    }
  }, [pendingUpdates, processBacklog]);

  const handleGoogleLogin = useCallback(async (apiKey: string, clientId: string, silent: boolean = false) => {
    const result = await initializeClient(apiKey, clientId);
    if (result.success && !result.restored && !silent) {
      login();
    }
  }, [initializeClient, login]);

  const handleCardUpdate = useCallback(async (updatedCard: Card) => {
    setIsSyncing(true);
    // Optimistically update local state immediately
    const newCards = allCards.map(card => card.id === updatedCard.id ? updatedCard : card);
    setAllCards(newCards);
    const newQueue = calculateStudyQueue(newCards);
    setSessionQueue(newQueue);
    
    // Log resulting queue
    logQueueToConsole(newQueue, newCards);

    try {
      if (dataSource === DataSource.Sheet) {
        const sheetUrl = localStorage.getItem('jantzcard_sheet_url');
        const spreadsheetId = sheetUrl ? extractSpreadsheetId(sheetUrl) : null;
        
        if (!spreadsheetId) {
             throw new Error("Spreadsheet ID lost.");
        }

        try {
            // 1. Try to save the current card
            await updateCardInSheet(spreadsheetId, updatedCard);
            
            // Success: Clear any persistent error messages (like "Sync skipped")
            setSyncMessage(null);
            
            // 2. If successful, check if we need to flush the backlog
            // Use the FRESH pendingUpdates from the ref/state if possible, but here we depend on the prop.
            if (pendingUpdates.length > 0) {
                // If the current save worked, we have connectivity. Try backlog.
                await processBacklog(spreadsheetId, pendingUpdates);
            }
        } catch (sheetError: any) {
            
            // CRITICAL CHANGE: Check for RowNotFoundError
            if (sheetError instanceof RowNotFoundError) {
                console.warn("Card row deleted from Sheet during session. Discarding update to prevent zombie state.");
                
                // If this card happened to be in the backlog previously, remove it.
                // It is not possible to save it, so we stop trying.
                const newBacklog = pendingUpdates.filter(p => p.id !== updatedCard.id);
                updateBacklog(newBacklog);

                setSyncMessage("Sync skipped: Card deleted remotely.");
            } else {
                // For all other errors (Network, Auth, Rate Limit), treat as a transient failure and Backlog it.
                console.warn("Sheet update failed, adding to backlog.", sheetError);
                
                const errMsg = sheetError.result?.error?.message || sheetError.message || "Network request failed";
                console.log("Reason:", errMsg);

                const pending: PendingCardUpdate = {
                    id: updatedCard.id,
                    lastSeen: updatedCard.lastSeen,
                    currentStudyInterval: updatedCard.currentStudyInterval
                };

                const newBacklog = [
                    ...pendingUpdates.filter(p => p.id !== pending.id),
                    pending
                ];
                updateBacklog(newBacklog);
            }
        }
      } else {
        await updateMockCard(updatedCard);
        setSyncMessage(null);
      }
      
    } catch (error: any) {
      console.error("Critical error in handleCardUpdate:", error);
      // This catch block handles system errors (like missing spreadsheet ID), 
      // not the network errors which are handled internally above.
      setSyncMessage(`System Error: ${error.message || 'Unknown'}`);
    } finally {
      setIsSyncing(false);
    }
  }, [allCards, dataSource, pendingUpdates, processBacklog]);

  const handleFinishStudy = useCallback(() => {
    setAppState(AppState.Finished);
    if (dataSource === DataSource.Sheet && pendingUpdates.length > 0) {
         setSyncMessage(`Session complete. Note: ${pendingUpdates.length} cards are saved to this device and will sync when online.`);
    } else {
         setSyncMessage(dataSource === DataSource.Sheet 
            ? 'Session complete! All progress synced to Google Sheets.' 
            : 'Session complete! Progress saved to local mock storage.');
    }
  }, [dataSource, pendingUpdates.length]);

  const handleRestart = () => {
    setSyncMessage(null);
    setAppError(null);
    setAllCards([]);
    setSessionQueue([]);
    setAppState(AppState.Home);
  };

  // Derive the visual status message for StudyScreen
  const getSaveStatusMessage = () => {
    // Priority 1: Backlog Warning
    if (pendingUpdates.length > 0 && dataSource === DataSource.Sheet) {
        return `Cloud Save Failed: ${pendingUpdates.length} card(s) saved to this device`;
    }
    // Priority 2: Generic Sync/System Messages
    return syncMessage;
  };

  const renderContent = () => {
    switch (appState) {
      case AppState.Studying: {
        const currentCardId = sessionQueue[0];
        const currentCard = currentCardId !== undefined 
          ? allCards.find(c => c.id === currentCardId) || null
          : null;

        return (
          <StudyScreen
            queue={sessionQueue}
            currentCard={currentCard}
            onCardUpdate={handleCardUpdate}
            onFinish={handleFinishStudy}
            onExit={handleRestart}
            isSaving={isSyncing}
            dataSource={dataSource}
            saveError={getSaveStatusMessage()}
          />
        );
      }
      case AppState.Finished:
        return (
          <CompletionScreen
            isSyncing={false}
            syncMessage={syncMessage}
            onRestart={handleRestart}
          />
        );
      case AppState.Home:
      default:
        return (
          <HomeScreen 
            onStartMock={handleStartMockStudy}
            onStartSheet={handleStartSheetStudy}
            onGoogleLogin={handleGoogleLogin}
            onGoogleLogout={logout}
            currentUser={currentUser}
            authError={authError || appError}
            isAuthLoading={isAuthLoading}
            isAuthReady={isReady}
            isLoadingCards={isSyncing && dataSource === DataSource.Sheet}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      {renderContent()}
    </div>
  );
};

export default App;
