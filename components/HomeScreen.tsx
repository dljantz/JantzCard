import React, { useState, useEffect, useRef } from 'react';
import { GoogleUser } from '../types';
import { DeckHistoryItem } from '../services/driveService';

interface HomeScreenProps {
  onStartMock: () => void;
  onStartSheet: (url: string) => void;
  onGoogleLogin: (apiKey: string, clientId: string, silent?: boolean) => void;
  onGoogleLogout: () => void;
  currentUser: GoogleUser | null;
  authError: string | null;
  isAuthLoading: boolean;
  isAuthReady: boolean;
  isLoadingCards: boolean;
  recentDecks: DeckHistoryItem[];
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartMock,
  onStartSheet,
  onGoogleLogin,
  onGoogleLogout,
  currentUser,
  authError,
  isAuthLoading,
  isAuthReady,
  isLoadingCards,
  recentDecks
}) => {
  // Sheet Verification State
  const [sheetUrl, setSheetUrl] = useState('');

  const hasAttemptedAutoLogin = useRef(false);

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
      alert("Configuration Error: API Key or Client ID missing in environment variables.");
      return;
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

          {/* Authenticated State */}
          {currentUser ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <img src={currentUser.picture} alt="Profile" className="w-16 h-16 rounded-full mb-3 border-2 border-green-400" />
                <h3 className="text-2xl text-white font-semibold">Hi, {currentUser.name}!</h3>
                <p className="text-green-400 text-sm">Successfully authenticated with Google</p>
              </div>

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
                    <p className="font-bold">System Error:</p>
                    <p>{authError}</p>
                  </div>
                )}
              </div>

              {/* Recent Decks */}
              {recentDecks.length > 0 && (
                <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-600 text-left space-y-4">
                  <h3 className="text-lg font-semibold text-gray-200 border-b border-gray-700 pb-2">Recent Decks</h3>
                  <div className="space-y-2">
                    {recentDecks.map((deck) => (
                      <button
                        key={deck.spreadsheetId}
                        onClick={() => onStartSheet(`https://docs.google.com/spreadsheets/d/${deck.spreadsheetId}`)}
                        className="w-full text-left p-3 hover:bg-gray-800 rounded border border-gray-700 hover:border-blue-500 transition-all group"
                      >
                        <div className="font-medium text-blue-400 group-hover:text-blue-300">{deck.name || 'Untitled Deck'}</div>
                        <div className="text-xs text-gray-500">Last visited: {new Date(deck.lastVisited).toLocaleDateString()}</div>
                      </button>
                    ))}
                  </div>
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
    </main>
  );
};

export default HomeScreen;
