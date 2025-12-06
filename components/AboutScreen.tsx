import React from 'react';

interface AboutScreenProps {
    onBack: () => void;
}

const AboutScreen: React.FC<AboutScreenProps> = ({ onBack }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <div className="max-w-2xl w-full bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300 mb-6">
                    About JantzCard
                </h1>
                <div className="text-gray-300 space-y-4 text-left mb-8">
                    <p>
                        JantzCard is a spaced repetition study tool designed to help you master any subject using your own Google Sheets as the data source.
                    </p>
                    <p>
                        This project explores the intersection of minimalist design and powerful learning techniques.
                    </p>
                    <p className="text-sm text-gray-500 mt-4">
                        Version 1.0.0
                    </p>
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

export default AboutScreen;
