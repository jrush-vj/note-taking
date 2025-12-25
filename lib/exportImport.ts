/**
 * Export and import utilities for notes, notebooks, and tags.
 * Supports JSON, Markdown, and ZIP formats.
 */

import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { Note, Notebook, Tag } from "../types/note";

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Export a single note as Markdown.
 */
export function exportNoteAsMarkdown(note: Note): string {
  let md = `# ${note.title || "Untitled"}\n\n`;
  if (note.tags && note.tags.length > 0) {
    md += `Tags: ${note.tags.map((t) => `#${t}`).join(", ")}\n\n`;
  }
  md += note.content;
  return md;
}

/**
 * Export a single note as JSON.
 */
export function exportNoteAsJson(note: Note): string {
  return JSON.stringify(note, null, 2);
}

/**
 * Download a single note as a file.
 */
export function downloadNote(note: Note, format: "md" | "json"): void {
  const filename = `${note.title || "untitled"}-${note.id}.${format}`;
  const content = format === "md" ? exportNoteAsMarkdown(note) : exportNoteAsJson(note);
  const blob = new Blob([content], { type: format === "md" ? "text/markdown" : "application/json" });
  saveAs(blob, filename);
}

/**
 * Export all notes as a JSON bundle.
 */
export function exportAllAsJson(notes: Note[], notebooks: Notebook[], tags: Tag[]): void {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes,
    notebooks,
    tags,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  saveAs(blob, `notes-export-${Date.now()}.json`);
}

/**
 * Export all notes as a ZIP file containing both JSON and Markdown files.
 */
export async function exportAllAsZip(notes: Note[], notebooks: Notebook[], tags: Tag[]): Promise<void> {
  const zip = new JSZip();

  // Add metadata
  const meta = {
    version: 1,
    exportedAt: new Date().toISOString(),
    noteCount: notes.length,
    notebookCount: notebooks.length,
    tagCount: tags.length,
  };
  zip.file("metadata.json", JSON.stringify(meta, null, 2));

  // Add all data as JSON
  zip.file("all-data.json", JSON.stringify({ notes, notebooks, tags }, null, 2));

  // Add individual markdown files
  const mdFolder = zip.folder("markdown");
  if (mdFolder) {
    for (const note of notes) {
      const filename = `${note.title || "untitled"}-${note.id}.md`;
      mdFolder.file(filename, exportNoteAsMarkdown(note));
    }
  }

  // Add individual JSON files
  const jsonFolder = zip.folder("json");
  if (jsonFolder) {
    for (const note of notes) {
      const filename = `${note.title || "untitled"}-${note.id}.json`;
      jsonFolder.file(filename, exportNoteAsJson(note));
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `notes-export-${Date.now()}.zip`);
}

// ============================================================================
// IMPORT
// ============================================================================

export interface ImportResult {
  success: boolean;
  notes?: Note[];
  notebooks?: Notebook[];
  tags?: Tag[];
  errors?: string[];
}

/**
 * Import notes from JSON.
 * Supports both single note and full export bundle.
 */
export function importFromJson(jsonString: string): ImportResult {
  try {
    const data = JSON.parse(jsonString);

    // Check if it's a full export bundle
    if (data.version && data.notes && Array.isArray(data.notes)) {
      return {
        success: true,
        notes: data.notes as Note[],
        notebooks: (data.notebooks as Notebook[]) || [],
        tags: (data.tags as Tag[]) || [],
      };
    }

    // Check if it's a single note
    if (data.id && data.title !== undefined && data.content !== undefined) {
      return {
        success: true,
        notes: [data as Note],
        notebooks: [],
        tags: [],
      };
    }

    // Check if it's an array of notes
    if (Array.isArray(data)) {
      return {
        success: true,
        notes: data as Note[],
        notebooks: [],
        tags: [],
      };
    }

    return {
      success: false,
      errors: ["Unrecognized JSON format"],
    };
  } catch (e) {
    return {
      success: false,
      errors: [(e as Error).message],
    };
  }
}

/**
 * Import a note from Markdown.
 * Parses title and tags from front matter if present.
 */
export function importFromMarkdown(markdown: string): ImportResult {
  try {
    const lines = markdown.split("\n");
    let title = "Untitled";
    let content = markdown;
    const tags: string[] = [];

    // Try to extract title from first line if it starts with #
    if (lines[0].startsWith("# ")) {
      title = lines[0].replace(/^#\s*/, "").trim();
      content = lines.slice(1).join("\n").trim();
    }

    // Try to extract tags from "Tags:" line
    const tagsLineIndex = lines.findIndex((line) => line.toLowerCase().startsWith("tags:"));
    if (tagsLineIndex !== -1) {
      const tagsLine = lines[tagsLineIndex];
      const tagMatches = tagsLine.match(/#\w+/g);
      if (tagMatches) {
        tags.push(...tagMatches.map((t) => t.slice(1)));
      }
      // Remove tags line from content
      content = [...lines.slice(0, tagsLineIndex), ...lines.slice(tagsLineIndex + 1)].join("\n").trim();
    }

    const note: Note = {
      id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      content,
      tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return {
      success: true,
      notes: [note],
      notebooks: [],
      tags: [],
    };
  } catch (e) {
    return {
      success: false,
      errors: [(e as Error).message],
    };
  }
}

/**
 * Handle file upload and import.
 */
export async function importFromFile(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();

    if (file.name.endsWith(".json")) {
      return importFromJson(text);
    }

    if (file.name.endsWith(".md") || file.name.endsWith(".markdown")) {
      return importFromMarkdown(text);
    }

    return {
      success: false,
      errors: ["Unsupported file format. Use .json or .md files."],
    };
  } catch (e) {
    return {
      success: false,
      errors: [(e as Error).message],
    };
  }
}

/**
 * Merge imported notes with existing notes.
 * Conflict resolution: 'overwrite', 'skip', or 'duplicate'
 */
export function mergeNotes(
  existing: Note[],
  imported: Note[],
  strategy: "overwrite" | "skip" | "duplicate"
): Note[] {
  const existingMap = new Map(existing.map((n) => [n.id, n]));
  const result = [...existing];

  for (const note of imported) {
    if (existingMap.has(note.id)) {
      switch (strategy) {
        case "overwrite":
          const index = result.findIndex((n) => n.id === note.id);
          if (index !== -1) {
            result[index] = { ...note, updatedAt: Date.now() };
          }
          break;
        case "skip":
          // Do nothing
          break;
        case "duplicate":
          result.push({
            ...note,
            id: `${note.id}-dup-${Date.now()}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          break;
      }
    } else {
      result.push(note);
    }
  }

  return result;
}
