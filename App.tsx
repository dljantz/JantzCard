
import React, { useState, useEffect } from 'react';
import { AppState, DataSource } from './types';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { useDeckManager } from './hooks/useDeckManager';
import HomeScreen from './components/HomeScreen';
import StudyScreen from './components/StudyScreen';
import CompletionScreen from './components/CompletionScreen';
import { getHistory, DeckHistoryItem } from './services/driveService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Home);
  const [recentDecks, setRecentDecks] = useState<DeckHistoryItem[]>([]);

  // Custom Hooks
  const {
    queue,
    currentCard,
    isLoading: isDeckLoading,
    syncMessage,
    error: deckError,
    pendingUpdatesCount,
    dataSource,
    loadDeck,
    reloadDeck,
    updateCard,
    clearDeck
  } = useDeckManager();

  const {
    isReady,
    initializeClient,
    login,
    logout,
    currentUser,
    error: authError,
    isLoading: isAuthLoading
  } = useGoogleAuth();

  // Load History
  useEffect(() => {
    if (currentUser) {
      getHistory().then(setRecentDecks);
    } else {
      setRecentDecks([]);
    }
  }, [currentUser]);

  // Handlers
  const handleStartSheetStudy = async (sheetUrl: string) => {
    await loadDeck(DataSource.Sheet, sheetUrl);
    setAppState(AppState.Studying);
  };

  // Effect to revert to Home if load fails immediately?
  useEffect(() => {
    if (appState === AppState.Studying && deckError && queue.length === 0) {
      // Logic handled in renderContent
    }
  }, [deckError, appState, queue.length]);


  const handleGoogleLogin = async (apiKey: string, clientId: string, silent: boolean = false) => {
    const result = await initializeClient(apiKey, clientId);
    if (result.success && !result.restored && !silent) {
      login();
    }
  };

  const handleFinishStudy = () => {
    setAppState(AppState.Finished);
  };

  const handleRestart = () => {
    clearDeck();
    setAppState(AppState.Home);
  };

  const getSaveStatusMessage = () => {
    if (pendingUpdatesCount > 0 && dataSource === DataSource.Sheet) {
      return `Cloud Save Failed: ${pendingUpdatesCount} card(s) saved to this device`;
    }
    return syncMessage;
  };

  const renderContent = () => {
    // If we have a critical load error and are "studying", we might want to go back to Home or show error
    if (appState === AppState.Studying && deckError && queue.length === 0) {
      return (
        <HomeScreen
          onStartSheet={handleStartSheetStudy}
          onGoogleLogin={handleGoogleLogin}
          onGoogleLogout={logout}
          currentUser={currentUser}
          authError={authError || deckError}
          isAuthLoading={isAuthLoading}
          isAuthReady={isReady}
          isLoadingCards={isDeckLoading}
          recentDecks={recentDecks}
        />
      );
    }

    switch (appState) {
      case AppState.Studying:
        return (
          <StudyScreen
            queue={queue}
            currentCard={currentCard}
            onCardUpdate={updateCard}
            onFinish={handleFinishStudy}
            onExit={handleRestart}
            onReload={reloadDeck}
            isSaving={isDeckLoading}
            dataSource={dataSource}
            saveError={getSaveStatusMessage()}
          />
        );
      case AppState.Finished:
        return (
          <CompletionScreen
            syncMessage={syncMessage}
            onRestart={handleRestart}
          />
        );
      case AppState.Home:
      default:
        return (
          <HomeScreen
            onStartSheet={handleStartSheetStudy}
            onGoogleLogin={handleGoogleLogin}
            onGoogleLogout={logout}
            currentUser={currentUser}
            authError={authError || deckError}
            isAuthLoading={isAuthLoading}
            isAuthReady={isReady}
            isLoadingCards={isDeckLoading && dataSource === DataSource.Sheet}
            recentDecks={recentDecks}
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
