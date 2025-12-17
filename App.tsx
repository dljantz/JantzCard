
import React, { useState, useEffect } from 'react';
import { AppState, DataSource } from './types';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { useDeckManager } from './hooks/useDeckManager';
import HomeScreen from './components/HomeScreen';
import StudyScreen from './components/StudyScreen';
import CompletionScreen from './components/CompletionScreen';
import AboutScreen from './components/AboutScreen';
import SettingsScreen from './components/SettingsScreen';
import { getHistory, DeckHistoryItem, StreakInfo } from './services/driveService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Home);
  const [recentDecks, setRecentDecks] = useState<DeckHistoryItem[]>([]);
  const [streak, setStreak] = useState<StreakInfo | undefined>(undefined);

  // Custom Hooks
  const {
    isReady,
    initializeClient,
    login,
    logout,
    currentUser,
    error: authError,
    isLoading: isAuthLoading,
    checkSession,
    ensureToken
  } = useGoogleAuth();

  const {
    queue,
    currentCard,
    isLoading: isDeckLoading,
    isSaving: isDeckSaving,
    syncMessage,
    error: deckError,
    pendingUpdatesCount,
    dataSource,
    loadDeck,
    reloadDeck,
    updateCard,
    clearDeck,
    initialQueueLength,
    deckName
  } = useDeckManager(ensureToken);

  // Load History on Login and Return to Home
  useEffect(() => {
    if (currentUser && appState === AppState.Home) {
      getHistory().then(data => {
        setRecentDecks(data.recentDecks);
        setStreak(data.streak);
      });
    } else if (!currentUser) {
      setRecentDecks([]);
      setStreak(undefined);
    }
  }, [currentUser, appState]);

  // Reactive Session Check (On Error)
  useEffect(() => {
    const hasDeckError = !!deckError;
    const hasSyncError = syncMessage && (
      syncMessage.toLowerCase().includes('error') ||
      syncMessage.toLowerCase().includes('failed')
    );

    if ((hasDeckError || hasSyncError) && currentUser) {
      // If we have an error that COULD be auth related, check session.
      // We rely on the hook to logout (and thus trigger UI update) if invalid.
      checkSession();
    }
  }, [deckError, syncMessage, currentUser, checkSession]);

  // Redirect to Home if user logs out (or session expires)
  useEffect(() => {
    if (!currentUser && appState !== AppState.Home) {
      setAppState(AppState.Home);
    }
  }, [currentUser, appState]);

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
      return `Offline Mode: ${pendingUpdatesCount} change(s) saved locally. Syncing when online...`;
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
          streak={streak}
          onNavigateToAbout={() => setAppState(AppState.About)}
          onNavigateToSettings={() => setAppState(AppState.Settings)}
          syncMessage={syncMessage}
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
            isSaving={isDeckSaving}
            dataSource={dataSource}
            saveError={getSaveStatusMessage()}
            initialQueueLength={initialQueueLength}
            deckName={deckName}
          />
        );
      case AppState.Finished:
        return (
          <CompletionScreen
            syncMessage={syncMessage}
            onRestart={handleRestart}
          />
        );
      case AppState.About:
        return <AboutScreen onBack={() => setAppState(AppState.Home)} />;
      case AppState.Settings:
        return <SettingsScreen onBack={() => setAppState(AppState.Home)} />;
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
            streak={streak}
            onNavigateToAbout={() => setAppState(AppState.About)}
            onNavigateToSettings={() => setAppState(AppState.Settings)}
            syncMessage={syncMessage}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans w-full overflow-x-hidden">
      {renderContent()}
    </div>
  );
};

export default App;
