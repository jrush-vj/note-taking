import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { Note, Notebook, Tag } from "../types/note";

export type ImportResult =
  | { success: true; notes: Note[]; notebooks: Notebook[]; tags: Tag[] }
  | { success: false; errors: string[] };

export function exportNoteAsMarkdown(note: Note): string {
  const title = note.title || "Untitled";
  const body = note.content || "";
  return `# ${title}\n\n${body}\n`;
}

export function downloadNote(note: Note, format: "md" | "json"): void {
  const name = (note.title || "untitled").replace(/[\\/:*?\"<>|]+/g, "-");
  const filename = `${name}-${note.id}.${format}`;
  const content = format === "md" ? exportNoteAsMarkdown(note) : JSON.stringify(note, null, 2);
  const blob = new Blob([content], { type: format === "md" ? "text/markdown" : "application/json" });
  saveAs(blob, filename);
}

export function exportAllAsJson(notes: Note[], notebooks: Notebook[], tags: Tag[]): void {
  const payload = { version: 1, exportedAt: new Date().toISOString(), notes, notebooks, tags };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  saveAs(blob, `notes-export-${Date.now()}.json`);
}

export async function exportAllAsZip(notes: Note[], notebooks: Notebook[], tags: Tag[]): Promise<void> {
  const zip = new JSZip();
  zip.file("bundle.json", JSON.stringify({ version: 1, notes, notebooks, tags }, null, 2));
  const md = zip.folder("markdown");
  if (md) {
    for (const note of notes) {
      const name = (note.title || "untitled").replace(/[\\/:*?\"<>|]+/g, "-");
      md.file(`${name}-${note.id}.md`, exportNoteAsMarkdown(note));
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `notes-export-${Date.now()}.zip`);
}

export async function importFromFile(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();
    if (file.name.endsWith(".json")) {
      const data = JSON.parse(text);
      if (Array.isArray(data?.notes)) {
        return {
          success: true,
          notes: data.notes as Note[],
          notebooks: (data.notebooks as Notebook[]) ?? [],
          tags: (data.tags as Tag[]) ?? [],
        };
      }
      if (typeof data?.id === "string" && typeof data?.content === "string") {
        return { success: true, notes: [data as Note], notebooks: [], tags: [] };
      }
      if (Array.isArray(data)) {
        return { success: true, notes: data as Note[], notebooks: [], tags: [] };
      }
      return { success: false, errors: ["Unrecognized JSON format"] };
    }

    // Basic markdown import: use first '# ' line as title
    if (file.name.endsWith(".md") || file.name.endsWith(".markdown")) {
      const lines = text.split("\n");
      const first = lines[0] ?? "";
      const title = first.startsWith("# ") ? first.slice(2).trim() : file.name.replace(/\.(md|markdown)$/i, "");
      const content = first.startsWith("# ") ? lines.slice(1).join("\n").trim() : text;
      const note: Note = {
        id: `import-${Date.now()}`,
        title,
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return { success: true, notes: [note], notebooks: [], tags: [] };
    }

    return { success: false, errors: ["Unsupported file type"] };
  } catch (e) {
    return { success: false, errors: [e instanceof Error ? e.message : "Import failed"] };
  }
}
