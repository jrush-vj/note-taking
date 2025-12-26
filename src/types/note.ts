export interface Note {
  id: string;
  title: string;
  content: string;
  notebookId?: string;
  tags?: string[];
  pinned?: boolean;
  starred?: boolean;
  archived?: boolean;
  isTemplate?: boolean;
  templateVariables?: string[]; // e.g. ["date", "time", "user"]
  createdAt: number;
  updatedAt: number;
}

export interface Notebook {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

export type ViewMode = "list" | "grid" | "compact";
export type ThemeMode = "system" | "light" | "dark-amoled";
export type SortBy = "updatedAt" | "createdAt" | "title";
export type SortOrder = "asc" | "desc";

export interface SearchFilters {
  query: string;
  pinned?: boolean;
  starred?: boolean;
  archived?: boolean;
  templates?: boolean;
  tagIds?: string[];
  notebookId?: string;
  dateFrom?: number;
  dateTo?: number;
}

export interface AppPreferences {
  viewMode: ViewMode;
  theme: ThemeMode;
  sortBy: SortBy;
  sortOrder: SortOrder;
  sidebarOpen: boolean;
}