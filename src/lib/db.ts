import type { Note, Notebook, Tag } from '../types/note';
import { browserDb } from './browserDb';
import { localDb } from './localDb';

// Check if running in Tauri
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// Unified database interface that works in both browser and Tauri
class UnifiedDatabase {
  private backend = isTauri() ? localDb : browserDb;

  async initialize() {
    return this.backend.initialize();
  }

  async getAllNotes(): Promise<Note[]> {
    return this.backend.getAllNotes();
  }

  async createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    return this.backend.createNote(note);
  }

  async updateNote(id: string, updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    return this.backend.updateNote(id, updates);
  }

  async deleteNote(id: string): Promise<void> {
    return this.backend.deleteNote(id);
  }

  async searchNotes(query: string): Promise<Note[]> {
    return this.backend.searchNotes(query);
  }

  async getAllNotebooks(): Promise<Notebook[]> {
    return this.backend.getAllNotebooks();
  }

  async createNotebook(notebook: { name: string; color?: string }): Promise<Notebook> {
    return this.backend.createNotebook(notebook);
  }

  async deleteNotebook(id: string): Promise<void> {
    return this.backend.deleteNotebook(id);
  }

  async getAllTags(): Promise<Tag[]> {
    return this.backend.getAllTags();
  }

  async createTag(tag: { name: string; color?: string }): Promise<Tag> {
    return this.backend.createTag(tag);
  }

  async deleteTag(id: string): Promise<void> {
    return this.backend.deleteTag(id);
  }

  async getNoteTagIds(noteId: string): Promise<string[]> {
    return this.backend.getNoteTagIds(noteId);
  }

  async addTagToNote(noteId: string, tagId: string): Promise<void> {
    return this.backend.addTagToNote(noteId, tagId);
  }

  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    return this.backend.removeTagFromNote(noteId, tagId);
  }

  async getTagsForNote(noteId: string): Promise<string[]> {
    return this.backend.getTagsForNote(noteId);
  }

  async setTagsForNote(noteId: string, tagIds: string[]): Promise<void> {
    return this.backend.setTagsForNote(noteId, tagIds);
  }

  isTauriMode(): boolean {
    return isTauri();
  }
}

export const db = new UnifiedDatabase();
export { isTauri };
