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

        const buttons = screen.getAllByRole('button');
        const firstButton = buttons[0];

        fireEvent.mouseDown(firstButton);
        fireEvent.mouseUp(firstButton);
        fireEvent.click(firstButton);

        expect(onSelectRequest).toHaveBeenCalledTimes(1);
    });

    it('should disable the right button when isRightDisabled is true', () => {
        const onSelectRequest = vi.fn();
        render(<IntervalSelector {...defaultProps} isRightDisabled={true} onSelect={onSelectRequest} />);

        const buttons = screen.getAllByRole('button');
        const rightButton = buttons[2]; // Left, Center, Right

        expect(rightButton).toBeDisabled();

        fireEvent.click(rightButton);
        expect(onSelectRequest).not.toHaveBeenCalled();
    });
});
