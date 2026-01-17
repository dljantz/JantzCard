import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import IntervalSelector from './IntervalSelector';
import { RED_INTERVAL_COLORS, YELLOW_INTERVAL_COLOR, GREEN_INTERVAL_COLORS } from '../constants';

describe('IntervalSelector 3-Button Layout & Cycling', () => {
    const defaultProps = {
        centerIntervalLabel: '1d', // Center
        lastIntendedInterval: '1d',
        onSelect: vi.fn(),
        preselection: null,
        isFlipped: false,
        isDisabled: false
    };

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should render exactly 3 buttons', () => {
        render(<IntervalSelector {...defaultProps} />);

        // Buttons are button elements
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(3);
    });

    it('should display correct default intervals for "1d" center', () => {
        render(<IntervalSelector {...defaultProps} />);

        // 1d is Center. 
        // Left should be 12hr (index of 1d is 14, 12hr is 13)
        // Right should be 2d (2d is 15)

        expect(screen.getByText('12hr')).toBeInTheDocument();
        expect(screen.getByText('1d')).toBeInTheDocument();
        expect(screen.getByText('2d')).toBeInTheDocument();
    });

    it('should cycle Left button to shorter intervals on press and hold', () => {
        render(<IntervalSelector {...defaultProps} />);

        const leftButton = screen.getByText('12hr');

        // Mouse Down to start cycling
        fireEvent.mouseDown(leftButton);

        // Advance timer by 500ms (interval duration)
        act(() => {
            vi.advanceTimersByTime(500);
        });

        // Should change to '6hr' (prev shorter)
        expect(screen.getByText('6hr')).toBeInTheDocument();
        // '12hr' should be gone
        expect(screen.queryByText('12hr')).not.toBeInTheDocument();

        // Advance again
        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(screen.getByText('3hr')).toBeInTheDocument();

        // Mouse Up to stop
        fireEvent.mouseUp(leftButton);

        // Advance check if it stopped
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        // Should still be '3hr'
        expect(screen.getByText('3hr')).toBeInTheDocument();
    });

    it('should cycle Right button to longer intervals on press and hold', () => {
        render(<IntervalSelector {...defaultProps} />);

        const rightButton = screen.getByText('2d');

        // Mouse Down
        fireEvent.mouseDown(rightButton);

        // Advance
        act(() => {
            vi.advanceTimersByTime(500);
        });

        // 2d -> 4d
        expect(screen.getByText('4d')).toBeInTheDocument();

        // Advance
        act(() => {
            vi.advanceTimersByTime(500);
        });
        // 4d -> 7d
        expect(screen.getByText('7d')).toBeInTheDocument();
    });

    it('should render with correct colors (Red, Yellow, Green)', () => {
        render(<IntervalSelector {...defaultProps} />);

        const buttons = screen.getAllByRole('button');
        const leftBtn = buttons[0];
        const centerBtn = buttons[1];
        const rightBtn = buttons[2];

        // We check styles or classes. 
        // Implementation uses inline style via prop? No, it uses Tailwind class `bg-[${color}]` which is JIT.
        // Wait, verify `IntervalButton` implementation:
        // `const colorClass = \`bg-[${backgroundColor}]\`;`
        // So the class name will be literally `bg-[#F00000]` etc.

        // Red: #F00000
        expect(leftBtn).toHaveClass(`bg-[${RED_INTERVAL_COLORS[0]}]`);

        // Yellow: #787800
        expect(centerBtn).toHaveClass(`bg-[${YELLOW_INTERVAL_COLOR}]`);

        // Green: #007878 (Green[4])
        expect(rightBtn).toHaveClass(`bg-[${GREEN_INTERVAL_COLORS[4]}]`);
    });
});
