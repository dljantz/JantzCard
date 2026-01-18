import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import IntervalSelector from './IntervalSelector';
import { RED_INTERVAL_COLORS, GREEN_INTERVAL_COLORS } from '../constants';

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

    it('should render with correct colors (Red, Gray, Green)', () => {
        render(<IntervalSelector {...defaultProps} />);

        const buttons = screen.getAllByRole('button');
        const leftBtn = buttons[0];
        const centerBtn = buttons[1];
        const rightBtn = buttons[2];

        // Red: #F00000
        expect(leftBtn).toHaveClass(`bg-[${RED_INTERVAL_COLORS[0]}]`);

        // Center: Gray (Default)
        expect(centerBtn).toHaveClass(`bg-[#4B5563]`);

        // Green: #007878 (Green[4])
        expect(rightBtn).toHaveClass(`bg-[${GREEN_INTERVAL_COLORS[4]}]`);
    });

    it('should activate Center button after 5 second hold', () => {
        const onSelectMock = vi.fn();
        render(<IntervalSelector {...defaultProps} onSelect={onSelectMock} />);

        const centerBtn = screen.getByText('1d');

        // Initially Gray
        expect(centerBtn).toHaveClass(`bg-[#4B5563]`);

        // Mouse Down
        fireEvent.mouseDown(centerBtn);

        // Advance 4s - Should not trigger yet
        act(() => {
            vi.advanceTimersByTime(4000);
        });
        expect(onSelectMock).not.toHaveBeenCalled();

        // Advance 1s (Total 5s)
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(onSelectMock).toHaveBeenCalledWith('1d');
    });

    it('should NOT select Center button on quick click (loophole fix)', () => {
        const onSelectMock = vi.fn();
        render(<IntervalSelector {...defaultProps} onSelect={onSelectMock} />);

        const centerBtn = screen.getByText('1d');

        // Mouse Down
        fireEvent.mouseDown(centerBtn);
        // Mouse Up immediately (quick click)
        fireEvent.mouseUp(centerBtn);
        // Also fire click as standard interaction
        fireEvent.click(centerBtn);

        expect(onSelectMock).not.toHaveBeenCalled();
    });

    it('should select on 5s hold but NOT confirm on release (ignore subsequent click)', () => {
        const onSelectMock = vi.fn();
        const { rerender } = render(<IntervalSelector {...defaultProps} onSelect={onSelectMock} />);

        const centerBtn = screen.getByText('1d');

        // 1. Mouse Down
        fireEvent.mouseDown(centerBtn);

        // 2. Hold for 5s -> Should Select
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        expect(onSelectMock).toHaveBeenCalledTimes(1);
        expect(onSelectMock).toHaveBeenCalledWith('1d');

        // Simulate Parent updating the prop
        rerender(<IntervalSelector {...defaultProps} onSelect={onSelectMock} preselection="1d" />);

        // 3. Mouse Up + Click (Simulating release action)
        // The user releases the mouse, which triggers mouseUp and then click
        fireEvent.mouseUp(centerBtn);
        fireEvent.click(centerBtn);

        // 4. Expect NO new calls (Total calls still 1)
        // IF BUGGY: This will fail because the click will trigger onSelect again (confirmation)
        expect(onSelectMock).toHaveBeenCalledTimes(1);
    });

    it('should have correct tooltip on Center button', () => {
        render(<IntervalSelector {...defaultProps} />);
        const centerBtn = screen.getByText('1d');
        expect(centerBtn).toHaveAttribute('title', 'Press and hold for 5 seconds');
    });
});
