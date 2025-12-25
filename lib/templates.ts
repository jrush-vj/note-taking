import type { Note } from "../types/note";

export const TEMPLATE_PRESETS = {
  "daily-log": {
    title: "Daily Log - {{date}}",
    content: "# Daily Log - {{date}} ({{weekday}})\n\n## Notes\n- ",
  },
  "meeting-notes": {
    title: "Meeting Notes - {{date}}",
    content: "# Meeting Notes - {{date}}\n\nTime: {{time}}\n\n## Agenda\n- ",
  },
  blank: {
    title: "New Note",
    content: "",
  },
} as const;

export function getBuiltInVariables(userEmail?: string): Record<string, string> {
  const now = new Date();
  return {
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    weekday: now.toLocaleDateString("en-US", { weekday: "long" }),
    user: userEmail ?? "User",
  };
}

export function substituteVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => vars[name] ?? `{{${name}}}`);
}

export function extractVariables(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) {
    if (match[1]) out.add(match[1]);
  }
  return [...out];
}

export function createTemplateFromPreset(key: keyof typeof TEMPLATE_PRESETS): Note {
  const preset = TEMPLATE_PRESETS[key];
  const vars = extractVariables(`${preset.title} ${preset.content}`);
  return {
    id: `template-${key}-${Date.now()}`,
    title: preset.title,
    content: preset.content,
    isTemplate: true,
    templateVariables: vars,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function createNoteFromTemplate(template: Note, userEmail?: string): Note {
  const vars = getBuiltInVariables(userEmail);
  return {
    id: `note-${Date.now()}`,
    title: substituteVariables(template.title ?? "", vars),
    content: substituteVariables(template.content ?? "", vars),
    notebookId: template.notebookId,
    tags: template.tags,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
