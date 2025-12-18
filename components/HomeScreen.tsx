import React, { useState, useEffect, useRef } from 'react';
import { GoogleUser } from '../types';
import { DeckHistoryItem, StreakInfo } from '../services/driveService';
import RecentDeckItem from './RecentDeckItem';
import { loadCardsFromSheet } from '../services/sheetService';
import { calculateStudyQueue } from '../hooks/useStudyQueue';

interface HomeScreenProps {
  onStartSheet: (url: string) => void;
  onGoogleLogin: (apiKey: string, clientId: string, silent?: boolean) => void;
  onGoogleLogout: () => void;
  currentUser: GoogleUser | null;
  authError: string | null;
  isAuthLoading: boolean;
  isAuthReady: boolean;
  isLoadingCards: boolean;
  recentDecks: DeckHistoryItem[];
  streak?: StreakInfo;
  onNavigateToAbout: () => void;
  onNavigateToSettings: () => void;
  syncMessage?: string | null;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartSheet,
  onGoogleLogin,
  onGoogleLogout,
  currentUser,
  authError,
  isAuthLoading,
  isAuthReady,
  isLoadingCards,
  recentDecks,
  streak,
  onNavigateToAbout,
  onNavigateToSettings,
  syncMessage
}) => {
  // Sheet Verification State
  const [sheetUrl, setSheetUrl] = useState('');

  // Deck Statistics State
  const [deckStats, setDeckStats] = useState<Record<string, { overdue: number | null, loading: boolean, error: boolean }>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const hasAttemptedAutoLogin = useRef(false);

  // Refresh Deck Statistics
  const refreshDecks = async (decksToLoad: DeckHistoryItem[]) => {
    if (!decksToLoad.length) return;

    setIsRefreshing(true);
    const newStats: Record<string, { overdue: number | null, loading: boolean, error: boolean }> = {};

    // Initialize loading state for all
    decksToLoad.forEach(deck => {
      newStats[deck.spreadsheetId] = {
        overdue: deckStats[deck.spreadsheetId]?.overdue ?? null, // Keep old value while loading
        loading: true,
        error: false
      };
    });
    setDeckStats(prev => ({ ...prev, ...newStats }));

    // Fetch in parallel
    await Promise.all(decksToLoad.map(async (deck) => {
      try {
        const cards = await loadCardsFromSheet(deck.spreadsheetId);
        const queue = calculateStudyQueue(cards);

        setDeckStats(prev => ({
          ...prev,
          [deck.spreadsheetId]: { overdue: queue.length, loading: false, error: false }
        }));
      } catch (err) {
        console.error(`Failed to refresh deck ${deck.name}`, err);
        setDeckStats(prev => ({
          ...prev,
          [deck.spreadsheetId]: {
            overdue: prev[deck.spreadsheetId]?.overdue ?? null,
            loading: false,
            error: true
          }
        }));
      }
    }));

    setLastUpdated(Date.now());
    setIsRefreshing(false);
  };

  // Initial Load of Stats
  useEffect(() => {
    if (recentDecks.length > 0 && !lastUpdated) {
      refreshDecks(recentDecks);
    }
  }, [recentDecks, lastUpdated]);

  // Format "Last updated" text
  const getLastUpdatedText = () => {
    if (!lastUpdated) return "";
    const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  // Auto-refresh timestamp text every minute
  const [timeText, setTimeText] = useState("");
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeText(getLastUpdatedText());
    }, 60000);
    setTimeText(getLastUpdatedText()); // Initial set
    return () => clearInterval(timer);
  }, [lastUpdated]);

  // Attempt auto-login if auth is ready
  useEffect(() => {
    if (isAuthReady && !currentUser && !hasAttemptedAutoLogin.current) {
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

      if (apiKey && clientId) {
        hasAttemptedAutoLogin.current = true;
        // Silent login triggers initialization and restoration check without popup
        onGoogleLogin(apiKey, clientId, true);
      }
    }
  }, [isAuthReady, currentUser, onGoogleLogin]);

  const handleLoginClick = () => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!apiKey || !clientId) {
      // If keys are missing, we should show the error in the UI instead of an alert.
      // We can reuse the Auth Error display logic or add a specific check.
      if (!apiKey || !clientId) {
        // We will let the UI render the error below
        return;
      }
    }

    // Explicit login (silent=false)
    onGoogleLogin(apiKey, clientId, false);
  };

  return (
    <main className="flex-grow flex flex-col items-center justify-center p-4 text-center overflow-auto">
      <div className="max-w-2xl w-full">
        <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300 mb-4">
          Welcome to JantzCard
        </h1>
        <p className="text-lg text-gray-400 mb-8">
          Train your metacognition. Take control of your learning with spaced repetition powered by you and your Google Sheets.
        </p>

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">

          {/* Sync Message Display */}
          {syncMessage && (
            <div className={`mb-4 px-3 py-3 rounded-lg text-sm animate-pulse border ${
              // Success State
              syncMessage.toLowerCase().includes('success') || syncMessage.toLowerCase().includes('reloaded!')
                ? 'bg-green-900/40 border-green-700 text-green-200'
                : // Error State
                syncMessage.toLowerCase().includes('error') || syncMessage.toLowerCase().includes('failed') || syncMessage.toLowerCase().includes('skipped')
                  ? 'bg-red-900/40 border-red-700 text-red-200'
                  : // Default/Info State (Blue)
                  'bg-blue-900/40 border-blue-700 text-blue-200'
              }`}>
              <p className="font-semibold">{syncMessage.includes('Success') || syncMessage.includes('reloaded') ? 'Status:' : 'Notice:'}</p>
              <p>{syncMessage}</p>
            </div>
          )}

          {/* Authenticated State */}
          {currentUser ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <img src={currentUser.picture} alt="Profile" className="w-16 h-16 rounded-full mb-3 border-2 border-green-400" />
                <h3 className="text-2xl text-white font-semibold">Hi, {currentUser.name}!</h3>
                {/* Streak Badge */}
                <div className={`mt-2 flex items-center gap-2 px-3 py-1 rounded-full border ${streak && streak.count > 0 ? 'bg-orange-900/30 border-orange-700/50' : 'bg-gray-800 border-gray-700'}`}>
                  <span className={`text-lg ${streak && streak.count > 0 ? '' : 'grayscale opacity-50'}`}>🔥</span>
                  <span className={`font-bold ${streak && streak.count > 0 ? 'text-orange-300' : 'text-gray-400'}`}>
                    {streak ? streak.count : 0} Day Streak
                  </span>
                </div>
                <p className="text-green-400 text-sm mt-1">Successfully authenticated with Google</p>
              </div>

              {/* Recent Decks */}
              {recentDecks.length > 0 && (
                <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-600 text-left space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-200">Recent Decks</h3>
                    <div className="flex items-center gap-3">
                      {lastUpdated && <span className="text-xs text-gray-500">{timeText}</span>}
                      <button
                        onClick={() => refreshDecks(recentDecks)}
                        disabled={isRefreshing}
                        className={`p-1.5 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-all ${isRefreshing ? 'animate-spin text-blue-400' : ''}`}
                        title="Reload deck info"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {recentDecks.map((deck) => (
                      <RecentDeckItem
                        key={deck.spreadsheetId}
                        deck={deck}
                        onStart={onStartSheet}
                        overdueCount={deckStats[deck.spreadsheetId]?.overdue ?? null}
                        loading={deckStats[deck.spreadsheetId]?.loading ?? false}
                        error={deckStats[deck.spreadsheetId]?.error ?? false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Sheet Configuration Area */}
              <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-600 text-left space-y-4">
                <h3 className="text-lg font-semibold text-gray-200 border-b border-gray-700 pb-2">Connect New Study Deck</h3>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Google Sheet URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="flex-grow bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Paste the URL of a sheet you have access to. It must have a tab named <strong>Deck</strong>.</p>
                </div>



                {/* Auth Error passed from Parent */}
                {authError && (
                  <div className="bg-red-900/20 border border-red-800 p-3 rounded text-sm text-red-300 break-words">
                    <p className="font-bold">Login Failed:</p>
                    <p>{authError}</p>
                  </div>
                )}
              </div>

              {/* Configuration Error Banner */}
              {(!import.meta.env.VITE_GOOGLE_API_KEY || !import.meta.env.VITE_GOOGLE_CLIENT_ID) && (
                <div className="bg-yellow-900/30 border border-yellow-700 p-3 rounded text-sm text-yellow-200 mt-2">
                  <p className="font-bold">App Configuration Missing:</p>
                  <p>Please set up your API Key and Client ID to continue.</p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => onStartSheet(sheetUrl)}
                  disabled={!sheetUrl || isLoadingCards}
                  className={`w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg transform hover:scale-[1.02] flex items-center justify-center gap-2 ${(!sheetUrl || isLoadingCards) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoadingCards ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading Deck...</span>
                    </>
                  ) : "Start Session (Sheets Data)"}
                </button>

                <button
                  onClick={onGoogleLogout}
                  className="w-full bg-transparent border border-gray-600 hover:bg-gray-700 text-gray-300 font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              </div>

            </div>

          ) : (
            /* Unauthenticated State */
            <div className="space-y-6">

              <div className="space-y-4">
                {authError && (
                  <div className="bg-red-900/30 border border-red-800 text-red-200 text-sm p-3 rounded">
                    {authError}
                  </div>
                )}

                <button
                  onClick={handleLoginClick}
                  disabled={!isAuthReady || isAuthLoading}
                  className={`w-full flex items-center justify-center gap-3 bg-white text-gray-800 hover:bg-gray-100 font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 duration-300 shadow-lg ${(!isAuthReady || isAuthLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isAuthLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-gray-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Connecting...
                    </span>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Sign in with Google
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <footer className="mt-12 text-gray-500 text-sm flex gap-6">
        <button onClick={onNavigateToAbout} className="hover:text-blue-400 transition-colors">About</button>
        <button onClick={onNavigateToSettings} className="hover:text-blue-400 transition-colors">Settings</button>
      </footer>
    </main >
  );
};

export default HomeScreen;
