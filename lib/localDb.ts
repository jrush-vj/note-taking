import Database from '@tauri-apps/plugin-sql';
import type { Note, Notebook, Tag } from '../types/note';

class LocalDatabase {
  private db: Database | null = null;

  // Convert database row to Note type
  private dbRowToNote(row: any): Note {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      notebookId: row.notebook_id || undefined,
      archived: Boolean(row.archived),
      pinned: Boolean(row.pinned),
      starred: Boolean(row.starred),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async initialize() {
    // Load SQLite database (will be created if it doesn't exist)
    this.db = await Database.load('sqlite:notes.db');
    
    // Create tables if they don't exist
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        notebook_id TEXT,
        archived INTEGER DEFAULT 0,
        pinned INTEGER DEFAULT 0,
        starred INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS notebooks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS note_tags (
        note_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (note_id, tag_id),
        FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
      )
    `);

    // Create FTS5 virtual table for full-text search
    await this.db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        content=notes,
        content_rowid=rowid
      )
    `);

    // Create triggers to keep FTS table in sync
    await this.db.execute(`
      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, id, title, content)
        VALUES (new.rowid, new.id, new.title, new.content);
      END
    `);

    await this.db.execute(`
      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, id, title, content)
        VALUES('delete', old.rowid, old.id, old.title, old.content);
      END
    `);

    await this.db.execute(`
      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, id, title, content)
        VALUES('delete', old.rowid, old.id, old.title, old.content);
        INSERT INTO notes_fts(rowid, id, title, content)
        VALUES (new.rowid, new.id, new.title, new.content);
      END
    `);

    // Create indexes for better performance
    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC)
    `);

    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_notes_notebook_id ON notes(notebook_id)
    `);

    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_notes_flags ON notes(pinned DESC, starred DESC, archived)
    `);

    console.log('Local database initialized successfully');
  }

  // NOTES
  async getAllNotes(): Promise<Note[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.select<any[]>(`
      SELECT * FROM notes 
      ORDER BY pinned DESC, updated_at DESC
    `);
    
    return result.map(row => this.dbRowToNote(row));
  }

  async createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = crypto.randomUUID();
    const now = Date.now();
    
    await this.db.execute(
      `INSERT INTO notes (id, title, content, notebook_id, archived, pinned, starred, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, note.title, note.content, note.notebookId || null, note.archived ? 1 : 0, note.pinned ? 1 : 0, note.starred ? 1 : 0, now, now]
    );
    
    return {
      id,
      ...note,
      notebookId: note.notebookId,
      createdAt: now,
      updatedAt: now
    };
  }

  async updateNote(id: string, updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.content !== undefined) {
      fields.push(`content = $${paramIndex++}`);
      values.push(updates.content);
    }
    if (updates.notebookId !== undefined) {
      fields.push(`notebook_id = $${paramIndex++}`);
      values.push(updates.notebookId || null);
    }
    if (updates.archived !== undefined) {
      fields.push(`archived = $${paramIndex++}`);
      values.push(updates.archived ? 1 : 0);
    }
    if (updates.pinned !== undefined) {
      fields.push(`pinned = $${paramIndex++}`);
      values.push(updates.pinned ? 1 : 0);
    }
    if (updates.starred !== undefined) {
      fields.push(`starred = $${paramIndex++}`);
      values.push(updates.starred ? 1 : 0);
    }

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(now);
    values.push(id);

    await this.db.execute(
      `UPDATE notes SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }

  async deleteNote(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.execute('DELETE FROM notes WHERE id = $1', [id]);
  }

  async searchNotes(query: string): Promise<Note[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.select<any[]>(
      `SELECT n.* FROM notes n
       JOIN notes_fts fts ON n.id = fts.id
       WHERE notes_fts MATCH $1
       ORDER BY rank, n.updated_at DESC
       LIMIT 50`,
      [query]
    );
    
    return result.map(row => this.dbRowToNote(row));
  }

  // NOTEBOOKS
  async getAllNotebooks(): Promise<Notebook[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.select<Notebook[]>('SELECT * FROM notebooks ORDER BY name ASC');
  }

  async createNotebook(notebook: Omit<Notebook, 'id' | 'createdAt'>): Promise<Notebook> {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = crypto.randomUUID();
    const now = Date.now();
    
    await this.db.execute(
      'INSERT INTO notebooks (id, name, color, created_at) VALUES ($1, $2, $3, $4)',
      [id, notebook.name, notebook.color, now]
    );
    
    return { id, ...notebook, createdAt: now };
  }

  async deleteNotebook(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    // Set all notes in this notebook to null notebook_id
    await this.db.execute('UPDATE notes SET notebook_id = NULL WHERE notebook_id = $1', [id]);
    await this.db.execute('DELETE FROM notebooks WHERE id = $1', [id]);
  }

  // TAGS
  async getAllTags(): Promise<Tag[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.select<Tag[]>('SELECT * FROM tags ORDER BY name ASC');
  }

  async createTag(tag: Omit<Tag, 'id' | 'createdAt'>): Promise<Tag> {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = crypto.randomUUID();
    const now = Date.now();
    
    await this.db.execute(
      'INSERT INTO tags (id, name, color, created_at) VALUES ($1, $2, $3, $4)',
      [id, tag.name, tag.color, now]
    );
    
    return { id, ...tag, createdAt: now };
  }

  async deleteTag(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.execute('DELETE FROM note_tags WHERE tag_id = $1', [id]);
    await this.db.execute('DELETE FROM tags WHERE id = $1', [id]);
  }

  async addTagToNote(noteId: string, tagId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.execute(
      'INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES ($1, $2)',
      [noteId, tagId]
    );
  }

  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.execute(
      'DELETE FROM note_tags WHERE note_id = $1 AND tag_id = $2',
      [noteId, tagId]
    );
  }

  async getTagsForNote(noteId: string): Promise<Tag[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    return await this.db.select<Tag[]>(
      `SELECT t.* FROM tags t
       JOIN note_tags nt ON t.id = nt.tag_id
       WHERE nt.note_id = $1
       ORDER BY t.name ASC`,
      [noteId]
    );
  }
}

export const localDb = new LocalDatabase();
