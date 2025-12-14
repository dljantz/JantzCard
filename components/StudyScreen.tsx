
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, DataSource } from '../types';
import Flashcard from './Flashcard';
import IntervalSelector from './IntervalSelector';
import ProgressBar from './ProgressBar';
import { getProportionalOverdueness } from '../hooks/useStudyQueue';
import { findClosestInterval } from '../utils/timeUtils';
import { DEFAULT_CENTER_INTERVAL, STUDY_INTERVALS } from '../constants';

interface StudyScreenProps {
  queue: string[];
  currentCard: Card | null;
  onCardUpdate: (updatedCard: Card) => void;
  onFinish: () => void;
  onExit: () => void;
  onReload: () => void;
  isSaving: boolean;
  dataSource: DataSource;
  saveError: string | null;
  initialQueueLength: number;
}

const StudyScreen: React.FC<StudyScreenProps> = ({
  queue,
  currentCard,
  onCardUpdate,
  onFinish,
  onExit,
  onReload,
  isSaving,
  dataSource,
  saveError,
  initialQueueLength
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [preselectedInterval, setPreselectedInterval] = useState<string | null>(null);

  // Transition state to hold the previous card's back content during animation
  const [transitionBack, setTransitionBack] = useState<string | null>(null);

  // Delayed flip state
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);
  const revealTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        setRevealCountdown(null);
        if (revealTimerRef.current) {
          clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
        }

        // Clear the override after the CSS transition finishes (700ms matches Flashcard CSS)
        setTimeout(() => {
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
        setRevealCountdown(null);
        if (revealTimerRef.current) {
          clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
        }
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
    if (!currentCard) return;

    const updatedCard: Card = {
      ...currentCard,
      currentStudyInterval: interval,
      lastSeen: new Date().toISOString(),
    };
    onCardUpdate(updatedCard);

    // Reset reveal state on confirm
    setRevealCountdown(null);
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }

  }, [currentCard, onCardUpdate]); // Removed isSaving dependency since we don't use it here now

  const handleIntervalSelect = (interval: string) => {
    // If clicking the ALREADY selected interval, confirm and advance.
    // This allows confirming Green intervals without ever flipping (isFlipped=false),
    // satisfying the requirement to allow fast advancing "without seeing the Back".
    if (preselectedInterval === interval) {
      handleConfirmInterval(interval);
      return;
    }

    // Otherwise, we are changing the selection (or making the first selection)
    setPreselectedInterval(interval);

    // Determine if we should flip or show reveal UI
    // Only applied if we are currently on the Front (!isFlipped).
    // If already flipped (e.g. selected Red then switched to Green), we stay flipped.
    if (!isFlipped) {
      // Determine if this is a "Green" interval (greater than center)
      const intervalLabels = STUDY_INTERVALS.map(i => i.label);
      const currentIndex = intervalLabels.indexOf(interval);
      const centerLabelToUse = centerIntervalLabel || DEFAULT_CENTER_INTERVAL;
      const centerIndex = intervalLabels.indexOf(centerLabelToUse);

      const isGreen = currentIndex > centerIndex;

      if (isGreen) {
        // DO NOT FLIP.
        // Reset reveal countdown if they picked a different green button
        setRevealCountdown(null);
        if (revealTimerRef.current) {
          clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
        }
      } else {
        // Red or Center -> Flip immediately
        setIsFlipped(true);
        // Ensure reveal state is clear
        setRevealCountdown(null);
        if (revealTimerRef.current) {
          clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
        }
      }
    }
  };

  const handleRevealClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent background click

    if (!preselectedInterval) return;

    // Calculate delay based on interval increase 
    // Smallest interval increase (1st green) -> 1s wait
    // ...
    // Largest interval increase (5th green) -> 5s wait

    const intervalLabels = STUDY_INTERVALS.map(i => i.label);
    const currentIndex = intervalLabels.indexOf(preselectedInterval);
    const centerLabelToUse = centerIntervalLabel || DEFAULT_CENTER_INTERVAL;
    const centerIndex = intervalLabels.indexOf(centerLabelToUse);

    // Rank 1 to 5
    let rank = currentIndex - centerIndex;
    if (rank < 1) rank = 1; // Fallback, though shouldn't happen for green buttons
    if (rank > 5) rank = 5;

    setRevealCountdown(rank);

    if (revealTimerRef.current) clearInterval(revealTimerRef.current);

    revealTimerRef.current = setInterval(() => {
      setRevealCountdown(prev => {
        if (prev === null || prev <= 1) {
          // Timer finished
          if (revealTimerRef.current) {
            clearInterval(revealTimerRef.current);
            revealTimerRef.current = null;
          }
          setIsFlipped(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
      }
    };
  }, []);

  const centerIntervalLabel = useMemo(() => {
    if (!currentCard?.lastSeen) {
      return DEFAULT_CENTER_INTERVAL;
    }
    const elapsedMs = Date.now() - new Date(currentCard.lastSeen).getTime();
    return findClosestInterval(elapsedMs);
  }, [currentCard]);

  const handleBackgroundClick = () => {
    // If a selection is active (or card is flipped), 
    // clicking the background should deselect and flip back to front.
    // Note: IntervalButton clicks stop propagation, so they won't trigger this.
    if (isFlipped || preselectedInterval) {
      setPreselectedInterval(null);
      setIsFlipped(false);
      setRevealCountdown(null);
      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    }
  };

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
  const isSuccessMessage = saveError && (saveError === "Deck reloaded!" || saveError.toLowerCase().includes('success'));
  const cardsCompleted = initialQueueLength - queue.length;

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      onClick={handleBackgroundClick}
    >
      <header className="p-4 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 relative">
        <div className="absolute top-4 left-4 z-20 flex gap-2">
          <button
            onClick={onExit}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 p-1 -ml-1 rounded-md hover:bg-gray-700/50"
            title="Return to Home"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span className="hidden sm:inline text-sm font-medium">Home</span>
          </button>

          {dataSource === DataSource.Sheet && (
            <button
              onClick={onReload}
              disabled={isSaving}
              className={`text-gray-400 hover:text-white transition-colors flex items-center gap-1 p-1 rounded-md hover:bg-gray-700/50 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Reload Deck"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span className="hidden sm:inline text-sm font-medium">Reload</span>
            </button>
          )}
        </div>

        <h2 className="text-xl font-bold text-center">JantzCard Study Session</h2>
        <div className="text-center text-sm text-gray-400 mt-1">{`Cards Remaining: ${queue.length}`}</div>

        <div className="text-center text-xs text-blue-200/70 mt-2 font-medium tracking-wide">
          {overdueness === Infinity ? (
            <span>New Card</span>
          ) : (
            <span>
              The last study interval for this card was <span className="text-white font-bold">{parseFloat(overdueness.toPrecision(2))}</span> times longer than your intended interval
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
              className={`flex items-center gap-1 font-semibold ${isSuccessMessage ? 'text-green-500' :
                isSavedLocallyWarning ? 'text-orange-400' : 'text-red-400 animate-pulse'
                }`}
              title={saveError}
            >
              {isSuccessMessage ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : isSavedLocallyWarning ? (
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

      <ProgressBar current={cardsCompleted} total={initialQueueLength} />

      <main className="flex-grow overflow-auto relative">
        <div className="min-h-full flex items-center justify-center p-4">
          {/* We remove the key prop to allow the same component instance to transition its CSS properties */}
          <Flashcard card={displayCard} isFlipped={isFlipped} />

          {/* Delayed Reveal UI */}
          {!isFlipped && preselectedInterval && (
            // Render only if it's a "Green" interval logic applies, which implies preselectedInterval > center.
            // We can re-check or just rely on state. If !isFlipped and preselectedInterval is set, it MUST be green based on handleIntervalSelect logic.
            <div className="absolute inset-x-0 bottom-[calc(50%-140px)] flex justify-center z-10 pointer-events-none">
              <button
                onClick={handleRevealClick}
                disabled={revealCountdown !== null}
                className={`
                  pointer-events-auto
                  px-8 py-3 rounded-full font-bold text-lg shadow-lg transform transition-all duration-200
                  ${revealCountdown !== null
                    ? 'bg-gray-700 text-yellow-400 scale-110 cursor-default'
                    : 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-105 active:scale-95 cursor-pointer'}
                `}
              >
                {revealCountdown !== null ? `Revealing in ${revealCountdown}...` : 'Reveal Answer'}
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="sticky bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 p-2 md:p-4">
        <IntervalSelector
          centerIntervalLabel={centerIntervalLabel}
          lastIntendedInterval={currentCard.currentStudyInterval}
          onSelect={handleIntervalSelect}
          preselection={preselectedInterval}
          isFlipped={isFlipped}
          isDisabled={false}
        />
      </footer>
    </div>
  );
};

export default StudyScreen;
