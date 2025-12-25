/**
 * Local storage layer using IndexedDB (via localforage) for offline-first persistence.
 * Stores encrypted notes locally as a backup and for offline access.
 */

import localforage from "localforage";
import type { Note, Notebook, Tag, AppPreferences } from "../types/note";

const notesStore = localforage.createInstance({
  name: "note-taking-app",
  storeName: "notes",
});

const notebooksStore = localforage.createInstance({
  name: "note-taking-app",
  storeName: "notebooks",
});

const tagsStore = localforage.createInstance({
  name: "note-taking-app",
  storeName: "tags",
});

const prefsStore = localforage.createInstance({
  name: "note-taking-app",
  storeName: "preferences",
});

const backupsStore = localforage.createInstance({
  name: "note-taking-app",
  storeName: "backups",
});

export interface LocalBackup {
  id: string;
  timestamp: number;
  notes: Note[];
  notebooks: Notebook[];
  tags: Tag[];
}

// ============================================================================
// NOTES
// ============================================================================

export async function saveNoteLocally(note: Note): Promise<void> {
  await notesStore.setItem(note.id, note);
}

export async function saveNotesLocally(notes: Note[]): Promise<void> {
  await Promise.all(notes.map((note) => notesStore.setItem(note.id, note)));
}

export async function getNoteLocally(id: string): Promise<Note | null> {
  return await notesStore.getItem<Note>(id);
}

export async function getAllNotesLocally(): Promise<Note[]> {
  const notes: Note[] = [];
  await notesStore.iterate<Note, void>((note) => {
    notes.push(note);
  });
  return notes;
}

export async function deleteNoteLocally(id: string): Promise<void> {
  await notesStore.removeItem(id);
}

export async function clearAllNotesLocally(): Promise<void> {
  await notesStore.clear();
}

// ============================================================================
// NOTEBOOKS
// ============================================================================

export async function saveNotebookLocally(notebook: Notebook): Promise<void> {
  await notebooksStore.setItem(notebook.id, notebook);
}

export async function saveNotebooksLocally(notebooks: Notebook[]): Promise<void> {
  await Promise.all(notebooks.map((nb) => notebooksStore.setItem(nb.id, nb)));
}

export async function getAllNotebooksLocally(): Promise<Notebook[]> {
  const notebooks: Notebook[] = [];
  await notebooksStore.iterate<Notebook, void>((nb) => {
    notebooks.push(nb);
  });
  return notebooks;
}

export async function deleteNotebookLocally(id: string): Promise<void> {
  await notebooksStore.removeItem(id);
}

export async function clearAllNotebooksLocally(): Promise<void> {
  await notebooksStore.clear();
}

// ============================================================================
// TAGS
// ============================================================================

export async function saveTagLocally(tag: Tag): Promise<void> {
  await tagsStore.setItem(tag.id, tag);
}

export async function saveTagsLocally(tags: Tag[]): Promise<void> {
  await Promise.all(tags.map((tag) => tagsStore.setItem(tag.id, tag)));
}

export async function getAllTagsLocally(): Promise<Tag[]> {
  const tags: Tag[] = [];
  await tagsStore.iterate<Tag, void>((tag) => {
    tags.push(tag);
  });
  return tags;
}

export async function deleteTagLocally(id: string): Promise<void> {
  await tagsStore.removeItem(id);
}

export async function clearAllTagsLocally(): Promise<void> {
  await tagsStore.clear();
}

// ============================================================================
// PREFERENCES
// ============================================================================

export async function savePreferences(prefs: AppPreferences): Promise<void> {
  await prefsStore.setItem("app-preferences", prefs);
}

export async function getPreferences(): Promise<AppPreferences | null> {
  return await prefsStore.getItem<AppPreferences>("app-preferences");
}

// ============================================================================
// BACKUPS
// ============================================================================

export async function createLocalBackup(
  notes: Note[],
  notebooks: Notebook[],
  tags: Tag[]
): Promise<LocalBackup> {
  const backup: LocalBackup = {
    id: `backup-${Date.now()}`,
    timestamp: Date.now(),
    notes,
    notebooks,
    tags,
  };

  await backupsStore.setItem(backup.id, backup);
  return backup;
}

export async function getAllBackups(): Promise<LocalBackup[]> {
  const backups: LocalBackup[] = [];
  await backupsStore.iterate<LocalBackup, void>((backup) => {
    backups.push(backup);
  });
  return backups.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getBackup(id: string): Promise<LocalBackup | null> {
  return await backupsStore.getItem<LocalBackup>(id);
}

export async function deleteBackup(id: string): Promise<void> {
  await backupsStore.removeItem(id);
}

export async function pruneOldBackups(keepCount: number = 10): Promise<void> {
  const backups = await getAllBackups();
  if (backups.length <= keepCount) return;

  const toDelete = backups.slice(keepCount);
  await Promise.all(toDelete.map((b) => deleteBackup(b.id)));
}
