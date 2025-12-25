/**
 * Template utilities for creating notes from templates with variable substitution.
 */

import type { Note } from "../types/note";

export interface TemplateVariable {
  name: string;
  value: string;
}

/**
 * Built-in template variables that are auto-populated.
 */
export function getBuiltInVariables(userEmail?: string): Record<string, string> {
  const now = new Date();
  
  return {
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    datetime: now.toLocaleString(),
    weekday: now.toLocaleDateString("en-US", { weekday: "long" }),
    month: now.toLocaleDateString("en-US", { month: "long" }),
    year: now.getFullYear().toString(),
    user: userEmail || "User",
    timestamp: Date.now().toString(),
    iso: now.toISOString(),
  };
}

/**
 * Replace template variables in text.
 * Variables are in the format {{variableName}}
 */
export function substituteVariables(
  text: string,
  variables: Record<string, string>
): string {
  let result = text;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Extract variable names from template text.
 */
export function extractVariables(text: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = text.matchAll(regex);
  const variables = new Set<string>();

  for (const match of matches) {
    if (match[1]) {
      variables.add(match[1]);
    }
  }

  return Array.from(variables);
}

/**
 * Create a new note from a template.
 */
export function createNoteFromTemplate(
  template: Note,
  userEmail?: string,
  customVariables?: Record<string, string>
): Note {
  const builtInVars = getBuiltInVariables(userEmail);
  const allVars = { ...builtInVars, ...customVariables };

  const newNote: Note = {
    id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: substituteVariables(template.title, allVars),
    content: substituteVariables(template.content, allVars),
    notebookId: template.notebookId,
    tags: template.tags,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return newNote;
}

/**
 * Pre-defined template presets for common use cases.
 */
export const TEMPLATE_PRESETS = {
  "daily-log": {
    title: "Daily Log - {{date}}",
    content: `# Daily Log - {{date}} ({{weekday}})

## Morning
- 

## Afternoon
- 

## Evening
- 

## Notes
- 

## Tomorrow
- `,
  },
  "meeting-notes": {
    title: "Meeting Notes - {{date}}",
    content: `# Meeting Notes - {{date}}

**Time:** {{time}}  
**Attendees:**  
- 

## Agenda
1. 

## Discussion
- 

## Action Items
- [ ] 

## Next Steps
- `,
  },
  "study-notes": {
    title: "Study Notes - {{date}}",
    content: `# Study Notes - {{date}}

**Topic:**  
**Source:**  

## Key Concepts
- 

## Important Points
- 

## Examples
- 

## Questions
- 

## Summary
`,
  },
  "project-planning": {
    title: "Project Plan - {{date}}",
    content: `# Project Plan

**Created:** {{datetime}}  
**Status:** Planning

## Overview
- **Goal:** 
- **Deadline:** 

## Milestones
- [ ] 

## Tasks
- [ ] 

## Resources
- 

## Notes
- `,
  },
  "weekly-review": {
    title: "Weekly Review - Week of {{date}}",
    content: `# Weekly Review - Week of {{date}}

## Accomplishments
- 

## Challenges
- 

## Learnings
- 

## Next Week's Goals
- 

## Reflections
`,
  },
  "blank": {
    title: "New Note",
    content: "",
  },
};

/**
 * Create a template note from a preset.
 */
export function createTemplateFromPreset(
  presetKey: keyof typeof TEMPLATE_PRESETS,
  notebookId?: string
): Note {
  const preset = TEMPLATE_PRESETS[presetKey];

  const template: Note = {
    id: `template-${presetKey}-${Date.now()}`,
    title: preset.title,
    content: preset.content,
    isTemplate: true,
    templateVariables: extractVariables(preset.title + " " + preset.content),
    notebookId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return template;
}
