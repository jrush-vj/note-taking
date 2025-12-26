/**
 * Fast search service using Fuse.js for fuzzy matching with incremental index updates.
 * Supports filtering, sorting, and highlighting matches.
 */

import Fuse, { type FuseResultMatch, type IFuseOptions } from "fuse.js";
import type { Note, SearchFilters, SortBy, SortOrder } from "../types/note";

export interface SearchResult {
  note: Note;
  score?: number;
  matches?: readonly FuseResultMatch[];
}

export class NoteSearchService {
  private fuse: Fuse<Note> | null = null;
  private notes: Note[] = [];

  private readonly fuseOptions: IFuseOptions<Note> = {
    keys: [
      { name: "title", weight: 2 },
      { name: "content", weight: 1 },
      { name: "tags", weight: 1.5 },
    ],
    threshold: 0.4, // 0 = exact, 1 = match anything
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true, // Search entire string
  };

  constructor(notes: Note[] = []) {
    this.updateIndex(notes);
  }

  /**
   * Rebuild the search index with new notes.
   * Call this when notes change significantly (e.g., after sync).
   */
  updateIndex(notes: Note[]): void {
    this.notes = notes;
    this.fuse = new Fuse(notes, this.fuseOptions);
  }

  /**
   * Incrementally add a note to the index.
   */
  addNote(note: Note): void {
    this.notes.push(note);
    if (this.fuse) {
      this.fuse.setCollection(this.notes);
    }
  }

  /**
   * Incrementally update a note in the index.
   */
  updateNote(note: Note): void {
    const index = this.notes.findIndex((n) => n.id === note.id);
    if (index !== -1) {
      this.notes[index] = note;
      if (this.fuse) {
        this.fuse.setCollection(this.notes);
      }
    }
  }

  /**
   * Incrementally remove a note from the index.
   */
  removeNote(id: string): void {
    this.notes = this.notes.filter((n) => n.id !== id);
    if (this.fuse) {
      this.fuse.setCollection(this.notes);
    }
  }

  /**
   * Perform a search with filters and sorting.
   */
  search(filters: SearchFilters, sortBy: SortBy = "updatedAt", sortOrder: SortOrder = "desc"): SearchResult[] {
    let results: SearchResult[];

    // If there's a query, use Fuse.js fuzzy search
    if (filters.query.trim()) {
      if (!this.fuse) {
        return [];
      }
      const fuseResults = this.fuse.search(filters.query.trim());
      results = fuseResults.map((r) => ({
        note: r.item,
        score: r.score,
        matches: r.matches,
      }));
    } else {
      // No query: return all notes
      results = this.notes.map((note) => ({ note }));
    }

    // Apply filters
    results = results.filter(({ note }) => {
      // Pinned filter (treat undefined as false)
      if (filters.pinned !== undefined && Boolean(note.pinned) !== filters.pinned) {
        return false;
      }

      // Starred filter (treat undefined as false)
      if (filters.starred !== undefined && Boolean(note.starred) !== filters.starred) {
        return false;
      }

      // Archived filter (treat undefined as false)
      if (filters.archived !== undefined && Boolean(note.archived) !== filters.archived) {
        return false;
      }

      // Templates filter (treat undefined as false)
      if (filters.templates !== undefined && Boolean(note.isTemplate) !== filters.templates) {
        return false;
      }

      // Notebook filter
      if (filters.notebookId && note.notebookId !== filters.notebookId) {
        return false;
      }

      // Tag filter (note must have at least one of the specified tags)
      if (filters.tagIds && filters.tagIds.length > 0) {
        const noteTags = note.tags ?? [];
        if (!filters.tagIds.some((tagId) => noteTags.includes(tagId))) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateFrom && note.updatedAt < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && note.updatedAt > filters.dateTo) {
        return false;
      }

      return true;
    });

    // Sort results
    results.sort((a, b) => {
      const noteA = a.note;
      const noteB = b.note;

      // Pinned notes always come first (unless explicitly filtering)
      if (filters.pinned === undefined) {
        if (noteA.pinned && !noteB.pinned) return -1;
        if (!noteA.pinned && noteB.pinned) return 1;
      }

      // Then sort by the specified field
      let comparison = 0;
      switch (sortBy) {
        case "title":
          comparison = (noteA.title || "").localeCompare(noteB.title || "");
          break;
        case "createdAt":
          comparison = noteA.createdAt - noteB.createdAt;
          break;
        case "updatedAt":
        default:
          comparison = noteA.updatedAt - noteB.updatedAt;
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return results;
  }

  /**
   * Get highlighted text for display (simple implementation).
   * In production, you'd use the matches from Fuse to highlight exact positions.
   */
  getHighlightedText(text: string, query: string): string {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  }
}
