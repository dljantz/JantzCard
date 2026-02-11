
import React from 'react';
import { DeckHistoryItem } from '../services/driveService';

interface RecentDeckItemProps {
    deck: DeckHistoryItem;
    onStart: (url: string) => void;
    overdueCount: number | null;
    loading: boolean;
    error: boolean;
    onDisconnect: (deck: DeckHistoryItem) => void;
}

const RecentDeckItem: React.FC<RecentDeckItemProps> = ({ deck, onStart, overdueCount, loading, error, onDisconnect }) => {
    return (
        <div
            onClick={() => onStart(`https://docs.google.com/spreadsheets/d/${deck.spreadsheetId}`)}
            className="w-full text-left p-3 hover:bg-gray-800 rounded border border-gray-700 hover:border-blue-500 transition-all group flex justify-between items-center cursor-pointer relative"
        >
            <div>
                <div className="font-medium text-blue-400 group-hover:text-blue-300 transition-colors">
                    {deck.name || 'Untitled Deck'}
                </div>
                <div className="text-xs text-gray-500">
                    Last visited: {new Date(deck.lastVisited).toLocaleDateString()}
                </div>
            </div>

            <div className="flex items-center text-sm font-semibold gap-3">
                {/* Status Indicator */}
                {loading ? (
                    <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : error ? (
                    <span title="Unable to load deck stats" className="text-red-400 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </span>
                ) : (
                    <span className={`${(overdueCount || 0) > 0 ? 'text-red-400' : 'text-green-500'}`}>
                        {overdueCount} due
                    </span>
                )}

                {/* Disconnect Button (Visible on Hover) */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDisconnect(deck);
                    }}
                    title="Disconnect this deck"
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-900/50 text-gray-500 hover:text-red-400 rounded-full transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default RecentDeckItem;
