import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StudyScreen from './StudyScreen';
import { Card, DataSource } from '../types';

describe('StudyScreen Interval Logic', () => {
    const baseProps = {
        queue: ['1'],
        onCardUpdate: vi.fn(),
        onFinish: vi.fn(),
        onExit: vi.fn(),
        onReload: vi.fn(),
        isSaving: false,
        dataSource: DataSource.Sheet,
        saveError: null,
        initialQueueLength: 10
    };

    it('should prioritize currentStudyInterval (intended) over elapsed time', () => {
        // Scenario: User intended "1d", but it has been "100 days" (elapsed).
        // Before logic change: Center would be something huge like "3mo" or "1yr".
        // After logic change: Center MUST be "1d".

        const card: Card = {
            id: '1',
            front: 'Front',
            back: 'Back',
            category: 'default',
            priorityLevel: 1,
            // 100 days ago
            lastSeen: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
            // Intended is 1d
            currentStudyInterval: '1d'
        };

        render(<StudyScreen {...baseProps} currentCard={card} />);

        // The center button (Yellow) should be '1d'
        // We can check if '1d' is in the document.
        // Also, if '1d' is the center/intended, it is usually bolded or we can just check presence in the specific layout.
        // For simplicity, just checking '1d' is present and prominent is good. 
        // We can also check that '1yr' (which would be the calculated one) is NOT the center (or maybe present as a longer interval, but 1d is the intended).

        expect(screen.getByText('1d')).toBeInTheDocument();

        // Let's verify it is treated as the "intended" one (logic sets isBold=true for intended).
        // The IntervalButton component applies 'font-black' if isBold is true, 'font-bold' otherwise.

        // Note: The mock card has currentStudyInterval='1d', so '1d' button should have `isBold` prop true.
        // We can't easily check props in integration test, but we can check class.
        // 'font-black' corresponds to font-weight: 900.

        const button = screen.getByText('1d');
        expect(button).toHaveClass('font-black');
    });

    it('should fallback to elapsed time if currentStudyInterval is null (Legacy)', () => {
        // Scenario: Legacy card, no intended interval. Last seen 1 minute ago.
        const card: Card = {
            id: '2',
            front: 'Front',
            back: 'Back',
            category: 'default',
            priorityLevel: 1,
            lastSeen: new Date(Date.now() - 60 * 1000).toISOString(), // 1 min ago
            currentStudyInterval: null
        };

        render(<StudyScreen {...baseProps} currentCard={card} />);

        // Should find closest to 1m -> '1m'
        expect(screen.getByText('1m')).toBeInTheDocument();
        // Since currentStudyInterval is null, no button should be "bold" (intended).
        const button = screen.getByText('1m');
        expect(button).not.toHaveClass('font-black');
    });
});
