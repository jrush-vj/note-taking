import { useEffect, useState } from "react";
import { generateId } from "../utils/generateId";
import type { Note, Notebook, Tag } from "../types/note";

const STORAGE_KEYS = {
  notes: "notes",
  notebooks: "notebooks",
  tags: "tags",
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const useNotes = () => {
  const [notes, setNotes] = useState<Note[]>(() => loadFromStorage<Note[]>(STORAGE_KEYS.notes, []));
  const [notebooks, setNotebooks] = useState<Notebook[]>(() =>
    loadFromStorage<Notebook[]>(STORAGE_KEYS.notebooks, [])
  );
  const [tags, setTags] = useState<Tag[]>(() => loadFromStorage<Tag[]>(STORAGE_KEYS.tags, []));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.notebooks, JSON.stringify(notebooks));
  }, [notebooks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.tags, JSON.stringify(tags));
  }, [tags]);

  const addNote = (notebookId?: string): Note => {
    const now = Date.now();
    const newNote: Note = {
      id: generateId(),
      title: "",
      content: "",
      notebookId,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    setNotes((prev) => [newNote, ...prev]);
    return newNote;
  };

  const addNotebook = (name: string): Notebook => {
    const notebook: Notebook = {
      id: generateId(),
      name,
      createdAt: Date.now(),
    };
    setNotebooks((prev) => [notebook, ...prev]);
    return notebook;
  };

  const addTag = (name: string): string => {
    const trimmed = name.trim();
    const existing = tags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;

    const tag: Tag = {
      id: generateId(),
      name: trimmed,
      createdAt: Date.now(),
    };
    setTags((prev) => [tag, ...prev]);
    return tag.id;
  };

  const updateNote = (id: string, updated: Note) => {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, ...updated } : note)));
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
  };

  const deleteNotebook = (id: string) => {
    setNotebooks((prev) => prev.filter((notebook) => notebook.id !== id));
    setNotes((prev) => prev.map((note) => (note.notebookId === id ? { ...note, notebookId: undefined } : note)));
  };

  return {
    notes,
    notebooks,
    tags,
    addNote,
    addNotebook,
    addTag,
    updateNote,
    deleteNote,
    deleteNotebook,
  };
};