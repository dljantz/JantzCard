
export interface Card {
  id: string;
  front: string;
  back: string;
  category: string;
  currentStudyInterval: string | null;
  lastSeen: string | null; // ISO 8601 string
  priorityLevel: number;
}

export enum AppState {
  Home,
  Studying,
  Finished,
}

export enum DataSource {
  Mock,
  Sheet,
}

export interface StudyInterval {
  label: string;
  ms: number;
}

export interface GoogleUser {
  name: string;
  picture: string;
  email?: string;
}