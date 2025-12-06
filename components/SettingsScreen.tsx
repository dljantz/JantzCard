import React from 'react';

interface SettingsScreenProps {
    onBack: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <div className="max-w-2xl w-full bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300 mb-6">
                    Settings
                </h1>
                <div className="text-gray-300 space-y-4 text-left mb-8">
                    <p className="italic text-gray-500">
                        Settings functionality coming soon...
                    </p>
                    {/* Placeholder for future settings */}
                    <div className="opacity-50 pointer-events-none">
                        <div className="flex items-center justify-between py-2 border-b border-gray-700">
                            <span>Dark Mode</span>
                            <span className="text-blue-400">On</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-700">
                            <span>Notifications</span>
                            <span className="text-gray-500">Off</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-700">
                            <span>Sync Frequency</span>
                            <span className="text-gray-500">Manual</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={onBack}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                    Back to Home
                </button>
            </div>
        </div>
    );
};

export default SettingsScreen;
