
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, DataSource } from '../types';
import Flashcard from './Flashcard';
import IntervalSelector from './IntervalSelector';
import { getProportionalOverdueness } from '../hooks/useStudyQueue';
import { findClosestInterval } from '../utils/timeUtils';
import { DEFAULT_CENTER_INTERVAL } from '../constants';

interface StudyScreenProps {
  queue: string[];
  currentCard: Card | null;
  onCardUpdate: (updatedCard: Card) => void;
  onFinish: () => void;
  isSaving: boolean;
  dataSource: DataSource;
  saveError: string | null;
}

const StudyScreen: React.FC<StudyScreenProps> = ({ queue, currentCard, onCardUpdate, onFinish, isSaving, dataSource, saveError }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [preselectedInterval, setPreselectedInterval] = useState<string | null>(null);

  // Transition state to hold the previous card's back content during animation
  const [transitionBack, setTransitionBack] = useState<string | null>(null);
  
  // Refs to track state without triggering effect re-runs prematurely
  const previousCardRef = useRef<Card | null>(null);
  const isFlippedRef = useRef(isFlipped);

  // Keep isFlipped ref in sync for use inside the card change effect
  useEffect(() => {
    isFlippedRef.current = isFlipped;
  }, [isFlipped]);

  // Handle Card Changes and Transitions
  useEffect(() => {
    // Check if the card identity has changed (e.g. moved to next card)
    if (currentCard?.id !== previousCardRef.current?.id) {
      
      const wasFlipped = isFlippedRef.current;
      const prevCard = previousCardRef.current;

      // If we are transitioning from a Flipped card to a new card,
      // we want to animate flipping back to front (180deg -> 0deg).
      // During this animation, the back face is visible for the first half.
      // We must render the OLD card's back on the back face so the user sees "Back A" -> flip -> "Front B".
      if (wasFlipped && prevCard) {
        setTransitionBack(prevCard.back);
        setIsFlipped(false); // Trigger the flip animation (Back to Front)
        setPreselectedInterval(null);

        // Clear the override after the CSS transition finishes (700ms matches Flashcard CSS)
        const timer = setTimeout(() => {
          setTransitionBack(null);
        }, 700);

        // Note: We don't return a cleanup function here that clears the timeout 
        // because we want the timeout to persist even if isFlipped changes state 
        // (which causes a re-render but not a re-run of this specific effect).
      } else {
        // Standard reset (e.g. loading first card, or moving from unflipped state)
        setIsFlipped(false);
        setPreselectedInterval(null);
        setTransitionBack(null);
      }

      previousCardRef.current = currentCard;
    }
  }, [currentCard]); // Only run when currentCard prop specifically changes

  useEffect(() => {
    // When the queue is empty and there's no card, the session is over.
    if (queue.length === 0 && !currentCard) {
      const timer = setTimeout(() => onFinish(), 300);
      return () => clearTimeout(timer);
    }
  }, [queue.length, currentCard, onFinish]);

  const handleConfirmInterval = useCallback((interval: string) => {
    if (!currentCard || isSaving) return;

    const updatedCard: Card = {
      ...currentCard,
      currentStudyInterval: interval,
      lastSeen: new Date().toISOString(),
    };
    onCardUpdate(updatedCard);

  }, [currentCard, onCardUpdate, isSaving]);

  const handleIntervalSelect = (interval: string) => {
    if (isSaving) return; // Prevent selection while saving

    if (!isFlipped) {
      setPreselectedInterval(interval);
      setIsFlipped(true);
    } else {
      if (preselectedInterval) {
        if (interval === preselectedInterval) {
          handleConfirmInterval(interval);
        } else {
          setPreselectedInterval(null);
        }
      } else {
        setPreselectedInterval(interval);
      }
    }
  };

  const centerIntervalLabel = useMemo(() => {
    if (!currentCard?.lastSeen) {
      return DEFAULT_CENTER_INTERVAL;
    }
    const elapsedMs = Date.now() - new Date(currentCard.lastSeen).getTime();
    return findClosestInterval(elapsedMs);
  }, [currentCard]);

  // Construct the display card.
  // If we are in a transition, we overlay the previous card's back content onto the new card
  // so the flip animation looks correct (Back Old -> Front New).
  const displayCard = useMemo(() => {
    if (!currentCard) return null;
    if (transitionBack) {
      return { ...currentCard, back: transitionBack };
    }
    return currentCard;
  }, [currentCard, transitionBack]);
  
  if (!currentCard || !displayCard) {
     return (
      <div className="flex-grow flex items-center justify-center">
        <p className="text-2xl">{queue.length > 0 ? 'Loading card...' : 'Completing session...'}</p>
      </div>
    );
  }

  const overdueness = getProportionalOverdueness(currentCard, Date.now());
  
  // Safe check for string existence before includes
  const isSavedLocallyWarning = saveError && saveError.includes && saveError.includes('saved to this device');

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="p-4 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 relative">
        <h2 className="text-xl font-bold text-center">JantzCard Study Session</h2>
        <div className="text-center text-sm text-gray-400 mt-1">{`Cards Remaining: ${queue.length}`}</div>
        
        <div className="text-center text-xs text-blue-200/70 mt-2 font-medium tracking-wide">
          {overdueness === Infinity ? (
            <span>New Card</span>
          ) : (
            <span>
              The last study interval for this card was <span className="text-white font-bold">{parseFloat(overdueness.toPrecision(2))}</span> times longer than the intended interval
            </span>
          )}
        </div>
        
        <div className="absolute top-1/2 right-4 -translate-y-1/2 flex items-center space-x-2 text-xs md:text-sm">
          {isSaving ? (
            <div className="flex items-center space-x-2 text-gray-400">
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Saving...</span>
            </div>
          ) : saveError ? (
            <span 
                className={`flex items-center gap-1 font-semibold ${isSavedLocallyWarning ? 'text-orange-400' : 'text-red-400 animate-pulse'}`} 
                title={saveError}
            >
               {isSavedLocallyWarning ? (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                   </svg>
               ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
               )}
               <span>{saveError}</span>
            </span>
          ) : (
            <span className="text-gray-400 flex items-center gap-1 transition-opacity duration-500">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
               </svg>
               {dataSource === DataSource.Sheet 
                  ? "All study progress saved to Google Sheets" 
                  : "All study progress saved locally"}
            </span>
          )}
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4 overflow-auto">
        {/* We remove the key prop to allow the same component instance to transition its CSS properties */}
        <Flashcard card={displayCard} isFlipped={isFlipped} />
      </main>

      <footer className="sticky bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 p-2 md:p-4">
        <IntervalSelector
          centerIntervalLabel={centerIntervalLabel}
          lastIntendedInterval={currentCard.currentStudyInterval}
          onSelect={handleIntervalSelect}
          preselection={preselectedInterval}
          isFlipped={isFlipped}
          isDisabled={isSaving}
        />
      </footer>
    </div>
  );
};

export default StudyScreen;
