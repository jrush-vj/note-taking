import localforage from 'localforage';
import type { Note, Notebook, Tag } from '../types/note';

// Browser-compatible database using IndexedDB via localforage
class BrowserDatabase {
  private notesStore = localforage.createInstance({ name: 'note-taking', storeName: 'notes' });
  private notebooksStore = localforage.createInstance({ name: 'note-taking', storeName: 'notebooks' });
  private tagsStore = localforage.createInstance({ name: 'note-taking', storeName: 'tags' });
  private noteTagsStore = localforage.createInstance({ name: 'note-taking', storeName: 'note_tags' });
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    
    // Initialize stores with empty arrays if they don't exist
    const notes = await this.notesStore.getItem<Note[]>('all');
    if (!notes) await this.notesStore.setItem('all', []);
    
    const notebooks = await this.notebooksStore.getItem<Notebook[]>('all');
    if (!notebooks) await this.notebooksStore.setItem('all', []);
    
    const tags = await this.tagsStore.getItem<Tag[]>('all');
    if (!tags) await this.tagsStore.setItem('all', []);
    
    const noteTags = await this.noteTagsStore.getItem<Record<string, string[]>>('all');
    if (!noteTags) await this.noteTagsStore.setItem('all', {});
    
    this.initialized = true;
    console.log('Browser database initialized successfully');
  }

  // NOTES
  async getAllNotes(): Promise<Note[]> {
    const notes = await this.notesStore.getItem<Note[]>('all') || [];
    return notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }

  async createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const notes = await this.notesStore.getItem<Note[]>('all') || [];
    const newNote: Note = {
      id: crypto.randomUUID(),
      ...note,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    notes.push(newNote);
    await this.notesStore.setItem('all', notes);
    return newNote;
  }

  async updateNote(id: string, updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const notes = await this.notesStore.getItem<Note[]>('all') || [];
    const index = notes.findIndex(n => n.id === id);
    if (index !== -1) {
      notes[index] = { ...notes[index], ...updates, updatedAt: Date.now() };
      await this.notesStore.setItem('all', notes);
    }
  }

  async deleteNote(id: string): Promise<void> {
    const notes = await this.notesStore.getItem<Note[]>('all') || [];
    const filtered = notes.filter(n => n.id !== id);
    await this.notesStore.setItem('all', filtered);
    
    // Also remove note-tag associations
    const noteTags = await this.noteTagsStore.getItem<Record<string, string[]>>('all') || {};
    delete noteTags[id];
    await this.noteTagsStore.setItem('all', noteTags);
  }

  async searchNotes(query: string): Promise<Note[]> {
    const notes = await this.getAllNotes();
    const lowerQuery = query.toLowerCase();
    return notes.filter(note =>
      note.title.toLowerCase().includes(lowerQuery) ||
      note.content.toLowerCase().includes(lowerQuery)
    );
  }

  // NOTEBOOKS
  async getAllNotebooks(): Promise<Notebook[]> {
    return await this.notebooksStore.getItem<Notebook[]>('all') || [];
  }

  async createNotebook(notebook: { name: string; color?: string }): Promise<Notebook> {
    const notebooks = await this.notebooksStore.getItem<Notebook[]>('all') || [];
    const newNotebook: Notebook = {
      id: crypto.randomUUID(),
      name: notebook.name,
      color: notebook.color || '#3b82f6',
      createdAt: Date.now()
    };
    notebooks.push(newNotebook);
    await this.notebooksStore.setItem('all', notebooks);
    return newNotebook;
  }

  async deleteNotebook(id: string): Promise<void> {
    const notebooks = await this.notebooksStore.getItem<Notebook[]>('all') || [];
    const filtered = notebooks.filter(n => n.id !== id);
    await this.notebooksStore.setItem('all', filtered);
    
    // Update notes that were in this notebook
    const notes = await this.notesStore.getItem<Note[]>('all') || [];
    const updatedNotes = notes.map(note =>
      note.notebookId === id ? { ...note, notebookId: undefined } : note
    );
    await this.notesStore.setItem('all', updatedNotes);
  }

  // TAGS
  async getAllTags(): Promise<Tag[]> {
    return await this.tagsStore.getItem<Tag[]>('all') || [];
  }

  async createTag(tag: { name: string; color?: string }): Promise<Tag> {
    const tags = await this.tagsStore.getItem<Tag[]>('all') || [];
    const newTag: Tag = {
      id: crypto.randomUUID(),
      name: tag.name,
      color: tag.color || '#8b5cf6',
      createdAt: Date.now()
    };
    tags.push(newTag);
    await this.tagsStore.setItem('all', tags);
    return newTag;
  }

  async deleteTag(id: string): Promise<void> {
    const tags = await this.tagsStore.getItem<Tag[]>('all') || [];
    const filtered = tags.filter(t => t.id !== id);
    await this.tagsStore.setItem('all', filtered);
    
    // Remove tag associations
    const noteTags = await this.noteTagsStore.getItem<Record<string, string[]>>('all') || {};
    for (const noteId in noteTags) {
      noteTags[noteId] = noteTags[noteId].filter(tagId => tagId !== id);
    }
    await this.noteTagsStore.setItem('all', noteTags);
  }

  // NOTE-TAG ASSOCIATIONS
  async getNoteTagIds(noteId: string): Promise<string[]> {
    const noteTags = await this.noteTagsStore.getItem<Record<string, string[]>>('all') || {};
    return noteTags[noteId] || [];
  }

  async addTagToNote(noteId: string, tagId: string): Promise<void> {
    const noteTags = await this.noteTagsStore.getItem<Record<string, string[]>>('all') || {};
    if (!noteTags[noteId]) noteTags[noteId] = [];
    if (!noteTags[noteId].includes(tagId)) {
      noteTags[noteId].push(tagId);
      await this.noteTagsStore.setItem('all', noteTags);
    }
  }

  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    const noteTags = await this.noteTagsStore.getItem<Record<string, string[]>>('all') || {};
    if (noteTags[noteId]) {
      noteTags[noteId] = noteTags[noteId].filter(id => id !== tagId);
      await this.noteTagsStore.setItem('all', noteTags);
    }
  }

  async getTagsForNote(noteId: string): Promise<string[]> {
    return this.getNoteTagIds(noteId);
  }

  async setTagsForNote(noteId: string, tagIds: string[]): Promise<void> {
    const noteTags = await this.noteTagsStore.getItem<Record<string, string[]>>('all') || {};
    noteTags[noteId] = tagIds;
    await this.noteTagsStore.setItem('all', noteTags);
  }
}

export const browserDb = new BrowserDatabase();
