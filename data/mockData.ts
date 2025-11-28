
import { Card } from '../types';

export const MOCK_CARDS: Card[] = [
  {
    id: 'mock-1',
    front: 'What is the capital of France?',
    back: 'Paris',
    category: 'Geography',
    currentStudyInterval: null,
    lastSeen: null,
    priorityLevel: 1,
  },
  {
    id: 'mock-2',
    front: 'What is 2 + 2?',
    back: '4',
    category: 'Math',
    currentStudyInterval: '1d',
    lastSeen: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago, 1 day interval
    priorityLevel: 2,
  },
  {
    id: 'mock-3',
    front: 'What is the powerhouse of the cell?',
    back: 'Mitochondria',
    category: 'Biology',
    currentStudyInterval: null,
    lastSeen: null,
    priorityLevel: 1,
  },
  {
    id: 'mock-4',
    front: 'What is the chemical symbol for water?',
    back: 'H2O',
    category: 'Chemistry',
    currentStudyInterval: '1hr',
    lastSeen: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago, 1 hr interval
    priorityLevel: 1,
  },
  {
    id: 'mock-5',
    front: 'Who wrote "To Kill a Mockingbird"?',
    back: 'Harper Lee',
    category: 'Literature',
    currentStudyInterval: '7d',
    lastSeen: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago, 7 day interval (not overdue)
    priorityLevel: 3,
  },
   {
    id: 'mock-6',
    front: 'What planet is known as the Red Planet?',
    back: 'Mars',
    category: 'Astronomy',
    currentStudyInterval: '12hr',
    lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago, 12hr interval
    priorityLevel: 2,
  }
];