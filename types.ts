
export interface Card {
  id: string;
  front: string;
  back: string;
  category: string;
  currentStudyInterval: string | null;
  lastSeen: string | null; // ISO 8601 string
  priorityLevel: number;
  updatedAt?: string; // ISO 8601 string
  status?: string;
}

export enum AppState {
  Home,
  Studying,
  Finished,
  About,
  Settings,
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