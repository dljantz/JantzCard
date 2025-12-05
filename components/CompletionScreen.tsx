import React from 'react';

interface CompletionScreenProps {
  // isSyncing removed as it was unused
  syncMessage: string | null;
  onRestart: () => void;
}

const CompletionScreen: React.FC<CompletionScreenProps> = ({ syncMessage, onRestart }) => {
  return (
    <main className="flex-grow flex flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-2xl border border-gray-700">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400 mb-4">
          Session Complete!
        </h1>
        <p className="text-gray-300 mb-6">
          You've finished all your overdue cards for now. Great work!
        </p>

        <div className="h-16 flex items-center justify-center">
          {syncMessage && (
            <p className={`font-semibold ${syncMessage.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
              {syncMessage}
            </p>
          )}
        </div>

        <button
          onClick={onRestart}
          className="w-full mt-4 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 duration-300 ease-in-out shadow-lg"
        >
          Start Another Session
        </button>
      </div>
    </main>
  );
};

export default CompletionScreen;