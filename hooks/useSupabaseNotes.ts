import { useCallback, useEffect, useState } from "react";
import type { Note, Notebook, Tag } from "../types/note";
import { supabase } from "../lib/supabaseClient";
import { decryptString, encryptString } from "../lib/crypto";

type SupabaseNotebookRow = {
  id: string;
  name: string;
  created_at: string;
};

type SupabaseTagRow = {
  id: string;
  name: string;
  created_at: string;
};

type SupabaseNoteRow = {
  id: string;
  title: string;
  notebook_id: string | null;
  tag_ids: string[];
  content_nonce: string;
  content_ciphertext: string;
  created_at: string;
  updated_at: string;
};

export function useSupabaseNotes(userId: string | null, encryptionKey: CryptoKey | null, accessToken: string | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isReady, setIsReady] = useState(false);

  const loadAll = useCallback(async () => {
    if (!userId || !encryptionKey) return;

    const [nbRes, tagRes, noteRes] = await Promise.all([
      supabase.from("notebooks").select("id,name,created_at").order("created_at", { ascending: false }),
      supabase.from("tags").select("id,name,created_at").order("created_at", { ascending: false }),
      supabase
        .from("notes")
        .select(
          "id,title,notebook_id,tag_ids,content_nonce,content_ciphertext,created_at,updated_at"
        )
        .order("updated_at", { ascending: false }),
    ]);

    if (nbRes.error) throw nbRes.error;
    if (tagRes.error) throw tagRes.error;
    if (noteRes.error) throw noteRes.error;

    const nextNotebooks: Notebook[] = (nbRes.data as SupabaseNotebookRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: new Date(row.created_at).getTime(),
    }));

    const nextTags: Tag[] = (tagRes.data as SupabaseTagRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: new Date(row.created_at).getTime(),
    }));

    const rawNotes = noteRes.data as SupabaseNoteRow[];

    const decryptedNotes: Note[] = await Promise.all(
      rawNotes.map(async (row) => {
        const content = await decryptString(encryptionKey, row.content_nonce, row.content_ciphertext);
        return {
          id: row.id,
          title: row.title ?? "",
          content,
          notebookId: row.notebook_id ?? undefined,
          tags: row.tag_ids ?? [],
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime(),
        };
      })
    );

    setNotebooks(nextNotebooks);
    setTags(nextTags);
    setNotes(decryptedNotes);
    setIsReady(true);
  }, [encryptionKey, userId]);

  useEffect(() => {
    setIsReady(false);
    setNotes([]);
    setNotebooks([]);
    setTags([]);

    if (!userId || !encryptionKey) return;

    void loadAll();
  }, [encryptionKey, loadAll, userId]);

  const addNotebook = useCallback(
    async (name: string) => {
      if (!userId) throw new Error("Not authenticated");
      const res = await supabase.from("notebooks").insert({ user_id: userId, name }).select("id,name,created_at").single();
      if (res.error) throw res.error;

      const notebook: Notebook = {
        id: res.data.id,
        name: res.data.name,
        createdAt: new Date(res.data.created_at).getTime(),
      };

      setNotebooks((prev) => [notebook, ...prev]);
      return notebook;
    },
    [userId]
  );

  const addTag = useCallback(
    async (name: string) => {
      if (!userId) throw new Error("Not authenticated");

      const trimmed = name.trim();
      const existing = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing.id;

      const res = await supabase.from("tags").insert({ user_id: userId, name: trimmed }).select("id,name,created_at").single();
      if (res.error) throw res.error;

      const tag: Tag = {
        id: res.data.id,
        name: res.data.name,
        createdAt: new Date(res.data.created_at).getTime(),
      };
      setTags((prev) => [tag, ...prev]);
      return tag.id;
    },
    [tags, userId]
  );

  const addNote = useCallback(
    async (notebookId?: string) => {
      if (!userId) throw new Error("Not authenticated");
      if (!encryptionKey) throw new Error("Missing encryption key");

      const id = crypto.randomUUID();
      const { nonceBase64, ciphertextBase64 } = await encryptString(encryptionKey, "");

      const insertRes = await supabase
        .from("notes")
        .insert({
          id,
          user_id: userId,
          title: "",
          notebook_id: notebookId ?? null,
          tag_ids: [],
          content_nonce: nonceBase64,
          content_ciphertext: ciphertextBase64,
          bucket_id: null,
          object_path: null,
        })
        .select("id,title,notebook_id,tag_ids,created_at,updated_at")
        .single();

      if (insertRes.error) throw insertRes.error;

      const newNote: Note = {
        id: insertRes.data.id,
        title: "",
        content: "",
        notebookId: insertRes.data.notebook_id ?? undefined,
        tags: insertRes.data.tag_ids ?? [],
        createdAt: new Date(insertRes.data.created_at).getTime(),
        updatedAt: new Date(insertRes.data.updated_at).getTime(),
      };

      setNotes((prev) => [newNote, ...prev]);
      return newNote;
    },
    [encryptionKey, userId]
  );

  const upsertEncryptedNote = useCallback(
    async (note: Note) => {
      if (!userId) throw new Error("Not authenticated");
      if (!encryptionKey) throw new Error("Missing encryption key");

      const { nonceBase64, ciphertextBase64 } = await encryptString(encryptionKey, note.content);

      const dbRes = await supabase
        .from("notes")
        .upsert(
          {
            id: note.id,
            user_id: userId,
            title: note.title,
            notebook_id: note.notebookId ?? null,
            tag_ids: note.tags ?? [],
            content_nonce: nonceBase64,
            content_ciphertext: ciphertextBase64,
          },
          { onConflict: "id" }
        )
        .select("id,title,notebook_id,tag_ids,content_nonce,content_ciphertext,created_at,updated_at")
        .single();

      if (dbRes.error) throw dbRes.error;

      // Upload encrypted markdown to Storage via serverless (service role) so we don't need Storage RLS.
      if (accessToken) {
        const uploadRes = await fetch("/api/storage/note", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            noteId: note.id,
            nonceBase64,
            ciphertextBase64,
          }),
        });

        if (!uploadRes.ok) {
          const text = await uploadRes.text().catch(() => "");
          throw new Error(text || "Storage upload failed");
        }
      }

      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...note } : n)));
    },
    [accessToken, encryptionKey, userId]
  );

  const updateNote = useCallback(
    async (_id: string, updated: Note) => {
      await upsertEncryptedNote(updated);
    },
    [upsertEncryptedNote]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("Not authenticated");
      setNotes((prev) => prev.filter((n) => n.id !== id));

      const dbRes = await supabase.from("notes").delete().eq("id", id);
      if (dbRes.error) throw dbRes.error;
    },
    [userId]
  );

  const deleteNotebook = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("Not authenticated");

      const res = await supabase.from("notebooks").delete().eq("id", id);
      if (res.error) throw res.error;

      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      setNotes((prev) => prev.map((note) => (note.notebookId === id ? { ...note, notebookId: undefined } : note)));
    },
    [userId]
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
