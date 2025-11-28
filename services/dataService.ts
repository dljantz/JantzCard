
import { Card } from '../types';
import { MOCK_CARDS } from '../data/mockData';

const LOCAL_STORAGE_KEY = 'jantzcard_data';

export const getMockData = (): Card[] => {
  try {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedData) {
      return JSON.parse(savedData);
    } else {
      const initialData = JSON.parse(JSON.stringify(MOCK_CARDS));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialData));
      return initialData;
    }
  } catch (error) {
    console.error("Could not access localStorage. Using default mock data.", error);
    return JSON.parse(JSON.stringify(MOCK_CARDS));
  }
};

/**
 * Updates a single card in localStorage. This simulates a transactional
 * update to a remote database or a single row in a Google Sheet.
 */
export const updateCard = (updatedCard: Card): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log(`Saving card ${updatedCard.id} to localStorage...`);
    try {
      // This "read-modify-write" pattern is typical for such operations.
      const currentCards = getMockData();
      const cardIndex = currentCards.findIndex(c => c.id === updatedCard.id);

      if (cardIndex === -1) {
        // This case should ideally not happen in a controlled environment.
        throw new Error(`Card with ID ${updatedCard.id} not found.`);
      }

      currentCards[cardIndex] = updatedCard;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentCards));

      // Simulate network latency for a more realistic feel.
      setTimeout(() => {
        console.log(`Card ${updatedCard.id} saved.`);
        resolve();
      }, 500);

    } catch (error) {
      console.error("Failed to save card data to localStorage.", error);
      reject(error);
    }
  });
};