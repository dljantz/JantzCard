
import React from 'react';
import { DeckHistoryItem } from '../services/driveService';

interface RecentDeckItemProps {
    deck: DeckHistoryItem;
    onStart: (url: string) => void;
    overdueCount: number | null;
    loading: boolean;
    error: boolean;
}

const RecentDeckItem: React.FC<RecentDeckItemProps> = ({ deck, onStart, overdueCount, loading, error }) => {
    return (
        <button
            onClick={() => onStart(`https://docs.google.com/spreadsheets/d/${deck.spreadsheetId}`)}
            className="w-full text-left p-3 hover:bg-gray-800 rounded border border-gray-700 hover:border-blue-500 transition-all group flex justify-between items-center"
        >
            <div>
                <div className="font-medium text-blue-400 group-hover:text-blue-300 transition-colors">
                    {deck.name || 'Untitled Deck'}
                </div>
                <div className="text-xs text-gray-500">
                    Last visited: {new Date(deck.lastVisited).toLocaleDateString()}
                </div>
            </div>

            <div className="flex items-center text-sm font-semibold">
                {loading ? (
                    <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : error ? (
                    <span title="Could not load count" className="text-gray-600">-</span>
                ) : (
                    <span className={`${(overdueCount || 0) > 0 ? 'text-red-400' : 'text-green-500'}`}>
                        {overdueCount} due
                    </span>
                )}
            </div>
        </button>
    );
};

export default RecentDeckItem;
