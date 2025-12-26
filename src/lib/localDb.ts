/**
 * Local SQLite Database for Desktop App
 * Zero-latency operations with encrypted storage
 */

// This will work with Tauri's SQLite plugin
// For now, this is a template showing the API design

import type { Note, Notebook, Tag } from "../types/note";

class LocalDatabase {
  private initialized = false;

  async init() {
    if (this.initialized) return;
    
    // Initialize SQLite database with encryption
    // Tables: notes, notebooks, tags, note_tags
    await this.createTables();
    this.initialized = true;
  }

  private async createTables() {
    // SQL Schema with FTS5 for fast search
    const schema = `
      CREATE TABLE IF NOT EXISTS notebooks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        notebook_id TEXT,
        pinned INTEGER DEFAULT 0,
        starred INTEGER DEFAULT 0,
        archived INTEGER DEFAULT 0,
        is_template INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (notebook_id) REFERENCES notebooks(id)
      );

      CREATE TABLE IF NOT EXISTS note_tags (
        note_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (note_id, tag_id),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      -- Full-text search index for instant search
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        content=notes,
        content_rowid=rowid
      );

      -- Triggers to keep FTS index in sync
      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, id, title, content)
        VALUES (new.rowid, new.id, new.title, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        DELETE FROM notes_fts WHERE rowid = old.rowid;
      END;

      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        UPDATE notes_fts SET title = new.title, content = new.content
        WHERE rowid = new.rowid;
      END;

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id);
      CREATE INDEX IF NOT EXISTS idx_notes_flags ON notes(pinned, starred, archived);
    `;

    // Execute with Tauri command
    // await invoke('execute_sql', { sql: schema });
  }

  // NOTES CRUD - All operations are O(log n) or better

  async getAllNotes(): Promise<Note[]> {
    // SELECT with all relations in single query - O(n)
    const sql = `
      SELECT 
        n.*,
        GROUP_CONCAT(nt.tag_id) as tag_ids
      FROM notes n
      LEFT JOIN note_tags nt ON n.id = nt.note_id
      GROUP BY n.id
      ORDER BY n.updated_at DESC
    `;
    
    // Execute with Tauri
    // const rows = await invoke('query_sql', { sql });
    // return this.parseNotes(rows);
    return [];
  }

  async createNote(note: Partial<Note>): Promise<Note> {
    const id = crypto.randomUUID();
    const now = Date.now();
    
    const newNote: Note = {
      id,
      title: note.title || "",
      content: note.content || "",
      notebookId: note.notebookId,
      tags: note.tags || [],
      pinned: note.pinned || false,
      starred: note.starred || false,
      archived: note.archived || false,
      isTemplate: note.isTemplate || false,
      createdAt: now,
      updatedAt: now,
    };

    const sql = `
      INSERT INTO notes (
        id, title, content, notebook_id, pinned, starred, 
        archived, is_template, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // await invoke('execute_sql', { 
    //   sql, 
    //   params: [
    //     newNote.id, newNote.title, newNote.content, newNote.notebookId,
    //     newNote.pinned ? 1 : 0, newNote.starred ? 1 : 0,
    //     newNote.archived ? 1 : 0, newNote.isTemplate ? 1 : 0,
    //     newNote.createdAt, newNote.updatedAt
    //   ]
    // });

    return newNote;
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<void> {
    const now = Date.now();
    
    const sql = `
      UPDATE notes 
      SET 
        title = COALESCE(?, title),
        content = COALESCE(?, content),
        notebook_id = COALESCE(?, notebook_id),
        pinned = COALESCE(?, pinned),
        starred = COALESCE(?, starred),
        archived = COALESCE(?, archived),
        updated_at = ?
      WHERE id = ?
    `;

    // await invoke('execute_sql', { sql, params: [...] });
  }

  async deleteNote(id: string): Promise<void> {
    // CASCADE will auto-delete from note_tags
    const sql = `DELETE FROM notes WHERE id = ?`;
    // await invoke('execute_sql', { sql, params: [id] });
  }

  // SEARCH - Uses FTS5 for instant results - O(log n)

  async searchNotes(query: string): Promise<Note[]> {
    if (!query.trim()) return this.getAllNotes();

    const sql = `
      SELECT 
        n.*,
        GROUP_CONCAT(nt.tag_id) as tag_ids,
        rank
      FROM notes_fts fts
      JOIN notes n ON fts.id = n.id
      LEFT JOIN note_tags nt ON n.id = nt.note_id
      WHERE notes_fts MATCH ?
      GROUP BY n.id
      ORDER BY rank
      LIMIT 100
    `;

    // const rows = await invoke('query_sql', { sql, params: [query] });
    // return this.parseNotes(rows);
    return [];
  }

  // NOTEBOOKS CRUD

  async getAllNotebooks(): Promise<Notebook[]> {
    const sql = `SELECT * FROM notebooks ORDER BY name`;
    // const rows = await invoke('query_sql', { sql });
    return [];
  }

  async createNotebook(name: string): Promise<Notebook> {
    const id = crypto.randomUUID();
    const now = Date.now();
    
    const sql = `INSERT INTO notebooks (id, name, created_at) VALUES (?, ?, ?)`;
    // await invoke('execute_sql', { sql, params: [id, name, now] });
    
    return { id, name, createdAt: now };
  }

  async deleteNotebook(id: string): Promise<void> {
    // Set notebook_id to NULL for all notes in this notebook
    await this.execute(`UPDATE notes SET notebook_id = NULL WHERE notebook_id = ?`, [id]);
    await this.execute(`DELETE FROM notebooks WHERE id = ?`, [id]);
  }

  // TAGS CRUD

  async getAllTags(): Promise<Tag[]> {
    const sql = `SELECT * FROM tags ORDER BY name`;
    // const rows = await invoke('query_sql', { sql });
    return [];
  }

  async createTag(name: string): Promise<Tag> {
    const id = crypto.randomUUID();
    const now = Date.now();
    
    const sql = `INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)`;
    // await invoke('execute_sql', { sql, params: [id, name, now] });
    
    return { id, name, createdAt: now };
  }

  // UTILITIES

  async getStats() {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM notes) as total_notes,
        (SELECT COUNT(*) FROM notebooks) as total_notebooks,
        (SELECT COUNT(*) FROM tags) as total_tags,
        (SELECT COUNT(*) FROM notes WHERE pinned = 1) as pinned_notes,
        (SELECT COUNT(*) FROM notes WHERE starred = 1) as starred_notes,
        (SELECT COUNT(*) FROM notes WHERE archived = 1) as archived_notes
    `;
    
    // return await invoke('query_sql', { sql });
    return {};
  }

  private async execute(sql: string, params: any[] = []) {
    // await invoke('execute_sql', { sql, params });
  }

  private async query(sql: string, params: any[] = []) {
    // return await invoke('query_sql', { sql, params });
    return [];
  }
}

export const localDb = new LocalDatabase();
