import { useCallback, useEffect, useMemo, useState } from "react";
import type { Note, Notebook, Tag } from "../types/note";
import { supabase } from "../lib/supabaseClient";
import { decryptString, encryptString } from "../lib/crypto";

type EncryptedObjectRow = {
  id: string;
  type: "notebook" | "note" | "tag";
  ciphertext: string;
  nonce: string;
  created_at: string;
  updated_at: string;
};

type RelationRow = {
  parent_id: string;
  child_id: string;
  relation_type: string;
};

type NotebookPayload = { v: 1; name: string };

type TagPayload = { v: 1; name: string };

type NotePayloadV1 = { v: 1; title: string; content: string };
type NotePayloadV2 = {
  v: 2;
  title: string;
  content: string;
  pinned?: boolean;
  starred?: boolean;
  archived?: boolean;
  isTemplate?: boolean;
  templateVariables?: string[];
};

type NotePayload = NotePayloadV1 | NotePayloadV2;

async function decryptJson<T>(key: CryptoKey, nonce: string, ciphertext: string): Promise<T> {
  const plaintext = await decryptString(key, nonce, ciphertext);
  return JSON.parse(plaintext) as T;
}

async function encryptJson(key: CryptoKey, value: unknown): Promise<{ nonceBase64: string; ciphertextBase64: string }> {
  return encryptString(key, JSON.stringify(value));
}

export function useZkNotes(userId: string | null, encryptionKey: CryptoKey | null, accessToken: string | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isReady, setIsReady] = useState(false);

  const tagsByName = useMemo(() => {
    const map = new Map<string, Tag>();
    for (const t of tags) map.set(t.name.toLowerCase(), t);
    return map;
  }, [tags]);

  const loadAll = useCallback(async () => {
    if (!userId || !encryptionKey) return;

    const [objRes, relRes] = await Promise.all([
      supabase
        .from("encrypted_objects")
        .select("id,type,ciphertext,nonce,created_at,updated_at")
        .order("updated_at", { ascending: false }),
      supabase.from("object_relations").select("parent_id,child_id,relation_type"),
    ]);

    if (objRes.error) throw objRes.error;
    if (relRes.error) throw relRes.error;

    const objects = objRes.data as EncryptedObjectRow[];
    const relations = relRes.data as RelationRow[];

    const noteToNotebook = new Map<string, string>();
    const noteToTags = new Map<string, string[]>();

    for (const r of relations) {
      if (r.relation_type === "contains") {
        noteToNotebook.set(r.child_id, r.parent_id);
      } else if (r.relation_type === "tagged") {
        const prev = noteToTags.get(r.parent_id) ?? [];
        prev.push(r.child_id);
        noteToTags.set(r.parent_id, prev);
      }
    }

    const nextNotebooks: Notebook[] = [];
    const nextTags: Tag[] = [];
    const nextNotes: Note[] = [];

    for (const row of objects) {
      if (row.type === "notebook") {
        const payload = await decryptJson<NotebookPayload>(encryptionKey, row.nonce, row.ciphertext);
        nextNotebooks.push({
          id: row.id,
          name: payload?.name ?? "",
          createdAt: new Date(row.created_at).getTime(),
        });
      }

      if (row.type === "tag") {
        const payload = await decryptJson<TagPayload>(encryptionKey, row.nonce, row.ciphertext);
        nextTags.push({
          id: row.id,
          name: payload?.name ?? "",
          createdAt: new Date(row.created_at).getTime(),
        });
      }

      if (row.type === "note") {
        const payload = await decryptJson<NotePayload>(encryptionKey, row.nonce, row.ciphertext);

        const title = payload?.title ?? "";
        const content = payload?.content ?? "";
        const flags = payload && "v" in payload && payload.v === 2 ? payload : undefined;

        nextNotes.push({
          id: row.id,
          title,
          content,
          notebookId: noteToNotebook.get(row.id) ?? undefined,
          tags: noteToTags.get(row.id) ?? [],
          pinned: flags?.pinned ?? false,
          starred: flags?.starred ?? false,
          archived: flags?.archived ?? false,
          isTemplate: flags?.isTemplate ?? false,
          templateVariables: flags?.templateVariables ?? [],
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime(),
        });
      }
    }

    setNotebooks(nextNotebooks);
    setTags(nextTags);
    setNotes(nextNotes);
    setIsReady(true);

    // One-time best-effort cleanup: remove encrypted objects in Storage that no longer exist in DB.
    // This is safe because we only ever store under objects/<uuid>.md.
    if (accessToken) {
      const liveObjectIds = objects.map((o) => o.id);
      void fetch("/api/storage/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ liveObjectIds }),
      });
    }
  }, [accessToken, encryptionKey, userId]);

  useEffect(() => {
    setIsReady(false);
    setNotes([]);
    setNotebooks([]);
    setTags([]);

    if (!userId || !encryptionKey) return;
    void loadAll();
  }, [encryptionKey, loadAll, userId]);

  const uploadEncryptedNoteToStorage = useCallback(
    async (noteId: string, nonceBase64: string, ciphertextBase64: string) => {
      if (!accessToken) return;

      const res = await fetch("/api/storage/note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ objectId: noteId, nonceBase64, ciphertextBase64 }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Storage upload failed");
      }
    },
    [accessToken]
  );

  const deleteEncryptedObjectFromStorage = useCallback(
    async (objectId: string) => {
      if (!accessToken) return;
      try {
        const res = await fetch("/api/storage/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ objectId }),
        });
        // Best-effort: ignore failures so the UI doesn't break.
        if (!res.ok) return;
      } catch {
        return;
      }
    },
    [accessToken]
  );

  const addNotebook = useCallback(
    async (name: string) => {
      if (!userId) throw new Error("Not authenticated");
      if (!encryptionKey) throw new Error("Missing encryption key");

      const payload: NotebookPayload = { v: 1, name: name.trim() };
      const { nonceBase64, ciphertextBase64 } = await encryptJson(encryptionKey, payload);

      const res = await supabase
        .from("encrypted_objects")
        .insert({ user_id: userId, type: "notebook", nonce: nonceBase64, ciphertext: ciphertextBase64 })
        .select("id,created_at")
        .single();

      if (res.error) throw res.error;

      const notebook: Notebook = {
        id: res.data.id,
        name: payload.name,
        createdAt: new Date(res.data.created_at).getTime(),
      };

      setNotebooks((prev) => [notebook, ...prev]);
      return notebook;
    },
    [encryptionKey, userId]
  );

  const addTag = useCallback(
    async (name: string) => {
      if (!userId) throw new Error("Not authenticated");
      if (!encryptionKey) throw new Error("Missing encryption key");

      const trimmed = name.trim();
      const existing = tagsByName.get(trimmed.toLowerCase());
      if (existing) return existing.id;

      const payload: TagPayload = { v: 1, name: trimmed };
      const { nonceBase64, ciphertextBase64 } = await encryptJson(encryptionKey, payload);

      const res = await supabase
        .from("encrypted_objects")
        .insert({ user_id: userId, type: "tag", nonce: nonceBase64, ciphertext: ciphertextBase64 })
        .select("id,created_at")
        .single();

      if (res.error) throw res.error;

      const tag: Tag = {
        id: res.data.id,
        name: payload.name,
        createdAt: new Date(res.data.created_at).getTime(),
      };

      setTags((prev) => [tag, ...prev]);
      return tag.id;
    },
    [encryptionKey, tagsByName, userId]
  );

  const addNote = useCallback(
    async (notebookId?: string) => {
      if (!userId) throw new Error("Not authenticated");
      if (!encryptionKey) throw new Error("Missing encryption key");

      const payload: NotePayload = {
        v: 2,
        title: "",
        content: "",
        pinned: false,
        starred: false,
        archived: false,
        isTemplate: false,
        templateVariables: [],
      };
      const { nonceBase64, ciphertextBase64 } = await encryptJson(encryptionKey, payload);

      const insertRes = await supabase
        .from("encrypted_objects")
        .insert({ user_id: userId, type: "note", nonce: nonceBase64, ciphertext: ciphertextBase64 })
        .select("id,created_at,updated_at")
        .single();

      if (insertRes.error) throw insertRes.error;

      const noteId = insertRes.data.id as string;

      if (notebookId) {
        const relRes = await supabase.from("object_relations").insert({
          user_id: userId,
          parent_id: notebookId,
          child_id: noteId,
          relation_type: "contains",
        });
        if (relRes.error) throw relRes.error;
      }

      await uploadEncryptedNoteToStorage(noteId, nonceBase64, ciphertextBase64);

      const newNote: Note = {
        id: noteId,
        title: "",
        content: "",
        notebookId,
        tags: [],
        pinned: false,
        starred: false,
        archived: false,
        isTemplate: false,
        templateVariables: [],
        createdAt: new Date(insertRes.data.created_at).getTime(),
        updatedAt: new Date(insertRes.data.updated_at).getTime(),
      };

      setNotes((prev) => [newNote, ...prev]);
      return newNote;
    },
    [encryptionKey, uploadEncryptedNoteToStorage, userId]
  );

  const updateNote = useCallback(
    async (_id: string, updated: Note) => {
      if (!userId) throw new Error("Not authenticated");
      if (!encryptionKey) throw new Error("Missing encryption key");

      const payload: NotePayload = {
        v: 2,
        title: updated.title ?? "",
        content: updated.content ?? "",
        pinned: Boolean(updated.pinned),
        starred: Boolean(updated.starred),
        archived: Boolean(updated.archived),
        isTemplate: Boolean(updated.isTemplate),
        templateVariables: updated.templateVariables ?? [],
      };
      const { nonceBase64, ciphertextBase64 } = await encryptJson(encryptionKey, payload);

      const upRes = await supabase
        .from("encrypted_objects")
        .update({ nonce: nonceBase64, ciphertext: ciphertextBase64 })
        .eq("id", updated.id)
        .eq("user_id", userId);

      if (upRes.error) throw upRes.error;

      // Notebook relation (contains): keep at most one.
      const delContains = await supabase
        .from("object_relations")
        .delete()
        .eq("user_id", userId)
        .eq("child_id", updated.id)
        .eq("relation_type", "contains");

      if (delContains.error) throw delContains.error;

      if (updated.notebookId) {
        const insContains = await supabase.from("object_relations").insert({
          user_id: userId,
          parent_id: updated.notebookId,
          child_id: updated.id,
          relation_type: "contains",
        });
        if (insContains.error) throw insContains.error;
      }

      // Tags (tagged): rewrite to match selected tag IDs.
      const delTags = await supabase
        .from("object_relations")
        .delete()
        .eq("user_id", userId)
        .eq("parent_id", updated.id)
        .eq("relation_type", "tagged");

      if (delTags.error) throw delTags.error;

      const tagIds = updated.tags ?? [];
      if (tagIds.length > 0) {
        const insTags = await supabase.from("object_relations").insert(
          tagIds.map((tagId) => ({
            user_id: userId,
            parent_id: updated.id,
            child_id: tagId,
            relation_type: "tagged",
          }))
        );
        if (insTags.error) throw insTags.error;
      }

      await uploadEncryptedNoteToStorage(updated.id, nonceBase64, ciphertextBase64);

      setNotes((prev) => prev.map((n) => (n.id === updated.id ? { ...updated } : n)));
    },
    [encryptionKey, uploadEncryptedNoteToStorage, userId]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("Not authenticated");

      setNotes((prev) => prev.filter((n) => n.id !== id));

      const res = await supabase.from("encrypted_objects").delete().eq("id", id).eq("user_id", userId);
      if (res.error) throw res.error;

      // Best-effort: also remove the encrypted blob from Storage.
      void deleteEncryptedObjectFromStorage(id);
    },
    [deleteEncryptedObjectFromStorage, userId]
  );

  const deleteNotebook = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("Not authenticated");

      const res = await supabase.from("encrypted_objects").delete().eq("id", id).eq("user_id", userId);
      if (res.error) throw res.error;

      // If a notebook was ever mirrored to Storage, clean it up as well.
      void deleteEncryptedObjectFromStorage(id);

      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      setNotes((prev) => prev.map((note) => (note.notebookId === id ? { ...note, notebookId: undefined } : note)));
    },
    [deleteEncryptedObjectFromStorage, userId]
  );

  return {
    isReady,
    notes,
    notebooks,
    tags,
    addNote,
    addNotebook,
    addTag,
    updateNote,
    deleteNote,
    deleteNotebook,
    reload: loadAll,
  };
}
