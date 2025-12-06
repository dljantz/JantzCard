import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IntervalSelector from './IntervalSelector';
import { DEFAULT_CENTER_INTERVAL } from '../constants';

// Clean up mocks
vi.mock('../hooks/useViewport', () => ({
    default: () => ({ height: 800 }) // Force multi-row layout initially to test that logic
}));

describe('IntervalSelector Interaction', () => {
    const defaultProps = {
        centerIntervalLabel: DEFAULT_CENTER_INTERVAL,
        onSelect: vi.fn(),
        preselection: null,
        isFlipped: false,
        isDisabled: false
    };

    it('should call onSelect only once when clicking a min/max button', () => {
        const onSelectRequest = vi.fn();
        render(<IntervalSelector {...defaultProps} onSelect={onSelectRequest} />);

        // Find a min button (e.g. 1s or similar, depends on default center)
        // With '1d' center, '1s' is way off the left.
        // Let's use 10m center, so 1m is min.
        // Actually simpler: just find the FIRST button in the effective list or similar.
        // The component renders "Press and hold..." titles for min/max.

        // Let's rely on text. With '1d' center:
        // Red: 12hr, 6hr, 3hr, 1hr, 30m? No, constants:
        // 1d (index 14). Reds: 13, 12, 11, 10, 9 -> 12hr, 6hr, 3hr, 1hr, 30m.
        // Wait, implementation: centerIdx - (5 - i).
        // i=0: center-5. i=4: center-1.
        // So if center=1d(14), i=0 is 14-5=9. 
        // array[9] = '30m'. So min is '30m'?
        // Let's check constants.ts carefully in next step if this fails.

        // Assuming '1d' is default center.
        // 0: 1s
        // ...
        // 9: 30m

        // Let's just click the button with 'Shorter interval options' or similar if possible.
        // Or just pick a text we know exists.

        // Better: let's try to click a button that definitely has cycling handlers.
        // Any button at the edge of the range.

        // Let's simply click the FIRST button found, which should be the min in the visible set.
        const buttons = screen.getAllByRole('button');
        const firstButton = buttons[0]; // Should be the min button

        // Simulate a Click (MouseDown + MouseUp + Click)
        // The issue is that MouseUp triggers StopCycling -> onSelect
        // AND Click triggers onClick -> onSelect

        fireEvent.mouseDown(firstButton);
        fireEvent.mouseUp(firstButton);
        fireEvent.click(firstButton);

        expect(onSelectRequest).toHaveBeenCalledTimes(1);

        // If bug exists, it might be called 2 times.
    });
});
