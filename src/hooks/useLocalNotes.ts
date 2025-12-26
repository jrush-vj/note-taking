import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import type { Note, Notebook, Tag } from '../types/note';

export function useLocalNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load all data on mount
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [notesData, notebooksData, tagsData] = await Promise.all([
        db.getAllNotes(),
        db.getAllNotebooks(),
        db.getAllTags(),
      ]);
      
      setNotes(notesData);
      setNotebooks(notebooksData);
      setTags(tagsData);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  // NOTES
  const addNote = async (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newNote = await db.createNote(note);
      setNotes(prev => [newNote, ...prev]);
      return newNote;
    } catch (err) {
      console.error('Failed to create note:', err);
      throw err;
    }
  };

  const updateNote = async (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      await db.updateNote(id, updates);
      setNotes(prev =>
        prev.map(note =>
          note.id === id
            ? { ...note, ...updates, updatedAt: Date.now() }
            : note
        )
      );
    } catch (err) {
      console.error('Failed to update note:', err);
      throw err;
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await db.deleteNote(id);
      setNotes(prev => prev.filter(note => note.id !== id));
    } catch (err) {
      console.error('Failed to delete note:', err);
      throw err;
    }
  };

  const searchNotes = async (query: string): Promise<Note[]> => {
    try {
      return await db.searchNotes(query);
    } catch (err) {
      console.error('Failed to search notes:', err);
      return [];
    }
  };

  // NOTEBOOKS
  const addNotebook = async (name: string, color: string = '#3b82f6') => {
    try {
      const newNotebook = await db.createNotebook({ name, color });
      setNotebooks(prev => [...prev, newNotebook]);
      return newNotebook;
    } catch (err) {
      console.error('Failed to create notebook:', err);
      throw err;
    }
  };

  const deleteNotebook = async (id: string) => {
    try {
      await db.deleteNotebook(id);
      setNotebooks(prev => prev.filter(nb => nb.id !== id));
      // Update notes that were in this notebook
      setNotes(prev =>
        prev.map(note =>
          note.notebookId === id ? { ...note, notebookId: undefined } : note
        )
      );
    } catch (err) {
      console.error('Failed to delete notebook:', err);
      throw err;
    }
  };

  // TAGS
  const addTag = async (name: string, color: string = '#8b5cf6') => {
    try {
      const newTag = await db.createTag({ name, color });
      setTags(prev => [...prev, newTag]);
      return newTag;
    } catch (err) {
      console.error('Failed to create tag:', err);
      throw err;
    }
  };

  const deleteTag = async (id: string) => {
    try {
      await db.deleteTag(id);
      setTags(prev => prev.filter(tag => tag.id !== id));
    } catch (err) {
      console.error('Failed to delete tag:', err);
      throw err;
    }
  };

  const reload = loadAll;

  return {
    notes,
    notebooks,
    tags,
    loading,
    error,
    addNote,
    updateNote,
    deleteNote,
    searchNotes,
    addNotebook,
    deleteNotebook,
    addTag,
    deleteTag,
    reload,
  };
}
