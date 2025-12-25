import localforage from "localforage";
import type { AppPreferences, Note, Notebook, Tag } from "../types/note";

const rootName = "note-taking";

const prefsStore = localforage.createInstance({ name: rootName, storeName: "prefs" });
const notesStore = localforage.createInstance({ name: rootName, storeName: "notes" });
const notebooksStore = localforage.createInstance({ name: rootName, storeName: "notebooks" });
const tagsStore = localforage.createInstance({ name: rootName, storeName: "tags" });
const backupsStore = localforage.createInstance({ name: rootName, storeName: "backups" });

export type LocalBackup = {
  id: string;
  timestamp: number;
  notes: Note[];
  notebooks: Notebook[];
  tags: Tag[];
};

export async function getPreferences(): Promise<AppPreferences | null> {
  return await prefsStore.getItem<AppPreferences>("prefs");
}

export async function savePreferences(prefs: AppPreferences): Promise<void> {
  await prefsStore.setItem("prefs", prefs);
}

export async function saveNotesLocally(notes: Note[]): Promise<void> {
  await notesStore.setItem("all", notes);
}

export async function saveNotebooksLocally(notebooks: Notebook[]): Promise<void> {
  await notebooksStore.setItem("all", notebooks);
}

export async function saveTagsLocally(tags: Tag[]): Promise<void> {
  await tagsStore.setItem("all", tags);
}

export async function createLocalBackup(notes: Note[], notebooks: Notebook[], tags: Tag[]): Promise<LocalBackup> {
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
