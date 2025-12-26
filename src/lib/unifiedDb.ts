import type { Note, Notebook, Tag } from '../types/note';

// Unified database interface that works across all platforms
export interface UnifiedDatabase {
  initialize(): Promise<void>;
  
  // Notes
  getAllNotes(): Promise<Note[]>;
  createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note>;
  updateNote(id: string, updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void>;
  deleteNote(id: string): Promise<void>;
  searchNotes(query: string): Promise<Note[]>;
  
  // Notebooks
  getAllNotebooks(): Promise<Notebook[]>;
  createNotebook(notebook: Omit<Notebook, 'id' | 'createdAt'>): Promise<Notebook>;
  deleteNotebook(id: string): Promise<void>;
  
  // Tags
  getAllTags(): Promise<Tag[]>;
  createTag(tag: Omit<Tag, 'id' | 'createdAt'>): Promise<Tag>;
  deleteTag(id: string): Promise<void>;
  getTagsForNote(noteId: string): Promise<string[]>;
  setTagsForNote(noteId: string, tagIds: string[]): Promise<void>;
}

// Detect if running in Tauri (desktop) or browser
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// Get the appropriate database implementation
async function getDatabase(): Promise<UnifiedDatabase> {
  if (isTauri()) {
    // Desktop app - use Tauri SQLite
    const { localDb } = await import('./localDb');
    return localDb as UnifiedDatabase;
  } else {
    // Browser/Vercel - use IndexedDB
    const { browserDb } = await import('./browserDb');
    return browserDb as UnifiedDatabase;
  }
}

// Export singleton instance
let dbInstance: UnifiedDatabase | null = null;

export async function getDb(): Promise<UnifiedDatabase> {
  if (!dbInstance) {
    dbInstance = await getDatabase();
    await dbInstance.initialize();
  }
  return dbInstance;
}
