
import React from 'react';
import { Card } from '../types';

interface FlashcardProps {
  card: Card;
  isFlipped: boolean;
}

const Flashcard: React.FC<FlashcardProps> = ({ card, isFlipped }) => {
  // Common classes for both faces of the card to ensure consistency.
  const faceClasses = "flex flex-col items-center justify-center p-6 rounded-xl shadow-2xl border min-h-48";

  // Display 'None' (or hide it) if priority is set to the default "infinite" value.
  const displayPriority = card.priorityLevel === Number.MAX_SAFE_INTEGER ? 'Default' : card.priorityLevel;

  return (
    // The perspective container sets up the 3D space for its children.
    <div className="w-full max-w-3xl [perspective:1000px]">
      {/* 
        This is the rotating element. It's now a CSS Grid container.
        - `transform-style: preserve-3d` ensures children are in 3D space.
        - `grid-template-areas` allows us to define a single area for both faces.
        - The grid's height will automatically size to the tallest content in its cells.
      */}
      <div
        className={`w-full transition-transform duration-700 ease-in-out [transform-style:preserve-3d] grid [grid-template-areas:'card'] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
      >
        {/* 
          Front of the card.
          - `gridArea: 'card'` places it in the defined grid area.
          - `backface-visibility: hidden` makes it invisible when it's facing away from the screen.
        */}
        <div
          style={{ gridArea: 'card' }}
          className={`${faceClasses} [backface-visibility:hidden] bg-gray-800 border-gray-700`}
        >
          <p className="text-gray-400 text-sm mb-2">Priority: {displayPriority}</p>
          <p className="text-2xl md:text-4xl text-center text-gray-100 font-['Courier_New',_'Courier',_monospace] whitespace-pre-wrap">{card.front}</p>
        </div>

        {/* 
          Back of the card.
          - Also placed in the 'card' grid area to overlay it perfectly on the front.
          - It's pre-rotated 180 degrees so it's initially facing away.
        */}
        <div
          style={{ gridArea: 'card' }}
          className={`${faceClasses} [backface-visibility:hidden] [transform:rotateY(180deg)] bg-blue-900/50 border-blue-700`}
        >
          <div className="w-full flex flex-col items-center justify-center">
            <p className="text-2xl md:text-4xl text-center font-semibold text-teal-300 font-['Courier_New',_'Courier',_monospace] whitespace-pre-wrap">{card.back}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Flashcard;
