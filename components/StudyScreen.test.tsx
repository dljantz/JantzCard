import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StudyScreen from './StudyScreen';
import { Card, DataSource } from '../types';

describe('StudyScreen Interval Selection', () => {
    const mockCard: Card = {
        id: '1',
        front: 'Front',
        back: 'Back',
        lastSeen: new Date().toISOString(),
        currentStudyInterval: '1s',
        status: 'learning',
        category: 'default',
        priorityLevel: 1
    };

    const defaultProps = {
        queue: ['1'],
        currentCard: mockCard,
        onCardUpdate: vi.fn(),
        onFinish: vi.fn(),
        onExit: vi.fn(),
        onReload: vi.fn(),
        isSaving: false,
        dataSource: DataSource.Sheet,
        saveError: null,
        initialQueueLength: 10
    };

    it('should switch selection when a different interval is selected while flipped', () => {
        render(<StudyScreen {...defaultProps} />);

        // 1. Initial State: Not flipped
        // With lastSeen = now, center interval is shortest '1s' because elapsed is 0.
        const button1 = screen.getByText('1s');
        fireEvent.click(button1);

        // Should be flipped and selected
        expect(screen.getByText('Back')).toBeInTheDocument();

        // 2. Select a DIFFERENT interval "2s" (next larger one)
        const button2 = screen.getByText('2s');
        fireEvent.click(button2);

        // EXPECTATION: Should still be flipped, but now button2 is selected (implicitly)
        // The bug was that it would deselect and flip back to front.

        // We expect it to STAY on back
        expect(screen.queryByText('Back')).toBeInTheDocument();
    });
});
