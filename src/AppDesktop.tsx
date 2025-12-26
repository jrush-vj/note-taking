/**
 * Enhanced App with all new features integrated:
 * - Search with filters
 * - Pin/Star/Archive
 * - Templates
 * - Command Palette
 * - Export/Import
 * - Theme system (Light Glass / AMOLED Dark)
 * - Local storage + backups
 * - Keyboard shortcuts
 * - View modes
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Moon,
  Sun,
  Notebook,
  Menu,
  X,
  Settings,
  Shield,
  Search,
  Star,
  Pin,
  Archive,
  FileText,
  Download,
  Sparkles,
  Tags,
  Calendar,
  Upload,
  Network,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Textarea } from "./components/ui/textarea";
import { Input } from "./components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./components/ui/alert-dialog";
import { CommandPalette, COMMAND_ICONS, type Command } from "./components/CommandPalette";
import { TemplateManager } from "./components/TemplateManager";
import { ExportImportModal } from "./components/ExportImportModal";
import { useLocalNotes } from "./hooks/useLocalNotes";
import { NoteSearchService } from "./lib/searchService";
import {
  saveNotesLocally,
  saveNotebooksLocally,
  saveTagsLocally,
  createLocalBackup,
  getPreferences,
  savePreferences,
} from "./lib/localStorage";
import { createNoteFromTemplate } from "./lib/templates";
import { type ImportResult } from "./lib/exportImport";
import type { Note, Notebook as NotebookType, Tag as TagType, SearchFilters, AppPreferences, ThemeMode } from "./types/note";
import { GraphView } from "./components/GraphView";
import { GraphView3D } from "./components/GraphView3D";

export function AppDesktop() {
  // Desktop app - no authentication needed
  const encryptionReady = true;

  // Replace Supabase with local database
  const { notes, notebooks, tags, addNote, addNotebook, addTag, updateNote, deleteNote, deleteNotebook, reload } =
    useLocalNotes();

  const [draggedNote, setDraggedNote] = useState<string | null>(null);

  // UI State
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"notes" | "account" | "security">("notes");
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [notebookToDelete, setNotebookToDelete] = useState<NotebookType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

  // Theme
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Desktop layout state
  const [leftSection, setLeftSection] = useState<"folders" | "tags" | "calendar" | "templates" | "settings">("folders");
  const [topView, setTopView] = useState<"folder" | "graph">("folder");
  const [graphMode, setGraphMode] = useState<"2d" | "3d">("2d");
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: "",
    archived: false,
  });

  // Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [exportImportDefaultTab, setExportImportDefaultTab] = useState<"export" | "import" | undefined>(undefined);

  // Search service
  const searchService = useRef(new NoteSearchService([]));

  // Load preferences
  useEffect(() => {
    void (async () => {
      const prefs = await getPreferences();
      if (prefs) {
        setTheme(prefs.theme);
        setIsSidebarOpen(prefs.sidebarOpen);
      }
    })();
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark-amoled");

    if (theme === "dark-amoled") {
      root.classList.add("dark-amoled");
    } else if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark-amoled");
      }
    }
  }, [theme]);

  // Save preferences
  useEffect(() => {
    const prefs: AppPreferences = {
      viewMode: "list",
      theme,
      sortBy: "updatedAt",
      sortOrder: "desc",
      sidebarOpen: isSidebarOpen,
    };
    void savePreferences(prefs);
  }, [theme, isSidebarOpen]);

  // Update search index when notes change
  useEffect(() => {
    searchService.current.updateIndex(notes);
  }, [notes]);

  // Save to local storage
  useEffect(() => {
    if (notes.length > 0) {
      void saveNotesLocally(notes);
    }
  }, [notes]);

  useEffect(() => {
    if (notebooks.length > 0) {
      void saveNotebooksLocally(notebooks);
    }
  }, [notebooks]);

  useEffect(() => {
    if (tags.length > 0) {
      void saveTagsLocally(tags);
    }
  }, [tags]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }

      // Escape: Close modals
      if (e.key === "Escape") {
        setIsCommandPaletteOpen(false);
        setIsTemplateManagerOpen(false);
        setIsExportImportOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const cycleTheme = useCallback(() => {
    const themes: ThemeMode[] = ["system", "light", "dark-amoled"];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  }, [theme]);

  const handleCreateNote = async (templateNote?: Note) => {
    try {
      let newNote: Note;
      if (templateNote) {
        const created = createNoteFromTemplate(templateNote, undefined);
        newNote = await addNote(created.notebookId);
        await updateNote(newNote.id, { ...newNote, ...created });
      } else {
        newNote = await addNote(selectedNotebook || undefined);
      }
      setSelectedNote(newNote);
      setActivePanel("notes");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create note";
      console.error(msg);
    }
  };

  const handleCreateNotebook = () => {
    const name = prompt("Enter notebook name:");
    if (name) {
      addNotebook(name);
    }
  };

  const handleSaveNote = async (updatedNote: Note) => {
    try {
      await updateNote(updatedNote.id, updatedNote);
      setSelectedNote(updatedNote);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save note";
      console.error(msg);
    }
  };

  const handleTogglePinned = async (note: Note) => {
    await updateNote(note.id, { ...note, pinned: !note.pinned });
  };

  const handleToggleStarred = async (note: Note) => {
    await updateNote(note.id, { ...note, starred: !note.starred });
  };

  const handleToggleArchived = async (note: Note) => {
    await updateNote(note.id, { ...note, archived: !note.archived });
  };

  const handleDeleteNote = (note: Note) => {
    setNoteToDelete(note);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteNotebook = (notebook: NotebookType) => {
    setNotebookToDelete(notebook);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (noteToDelete) {
      deleteNote(noteToDelete.id);
    } else if (notebookToDelete) {
      deleteNotebook(notebookToDelete.id);
    }
    setIsDeleteDialogOpen(false);
    setNoteToDelete(null);
    setNotebookToDelete(null);
    if (selectedNote?.id === noteToDelete?.id) {
      setSelectedNote(null);
    }
    if (selectedNotebook === notebookToDelete?.id) {
      setSelectedNotebook(null);
    }
  };

  const handleBulkDelete = () => {
    if (selectedNoteIds.size === 0) return;
    if (!confirm(`Delete ${selectedNoteIds.size} note(s)?`)) return;
    
    selectedNoteIds.forEach(id => deleteNote(id));
    setSelectedNoteIds(new Set());
    setIsMultiSelectMode(false);
    if (selectedNote && selectedNoteIds.has(selectedNote.id)) {
      setSelectedNote(null);
    }
  };

  const toggleNoteSelection = (noteId: string) => {
    const newSet = new Set(selectedNoteIds);
    if (newSet.has(noteId)) {
      newSet.delete(noteId);
    } else {
      newSet.add(noteId);
    }
    setSelectedNoteIds(newSet);
  };

  // Drag and drop handlers
  const handleDragStart = (noteId: string) => {
    setDraggedNote(noteId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnNotebook = async (notebookId: string | null) => {
    if (!draggedNote) return;
    
    const note = notes.find(n => n.id === draggedNote);
    if (!note) return;

    try {
      await updateNote(draggedNote, { ...note, notebookId: notebookId || undefined });
    } catch (e) {
      console.error('Failed to move note:', e);
    }
    
    setDraggedNote(null);
  };

  const handleDragEnd = () => {
    setDraggedNote(null);
  };

  const handleImport = async (result: ImportResult) => {
    if (!result.success || !result.notes) return;

    for (const incoming of result.notes) {
      const created = await addNote(incoming.notebookId);

      // Ensure tags exist and attach them.
      const incomingTags = (incoming.tags ?? []).filter(Boolean);
      const resolvedTagIds: string[] = [];
      for (const tagIdOrName of incomingTags) {
        // Imported bundles may contain tag IDs; if they don't exist locally, treat as name.
        const existingById = tags.find((t) => t.id === tagIdOrName);
        if (existingById) {
          resolvedTagIds.push(existingById.id);
          continue;
        }
        const existingByName = tags.find((t) => t.name.toLowerCase() === tagIdOrName.toLowerCase());
        if (existingByName) {
          resolvedTagIds.push(existingByName.id);
          continue;
        }
        const newTagId = await addTag(tagIdOrName);
        resolvedTagIds.push(newTagId);
      }

      await updateNote(created.id, {
        ...created,
        title: (incoming.title ?? "").trim(),
        content: incoming.content ?? "",
        notebookId: incoming.notebookId,
        tags: resolvedTagIds,
        pinned: Boolean(incoming.pinned),
        starred: Boolean(incoming.starred),
        archived: Boolean(incoming.archived),
        isTemplate: Boolean(incoming.isTemplate),
        templateVariables: incoming.templateVariables,
        updatedAt: Date.now(),
      });
    }
  };

  const handleCreateBackup = async () => {
    await createLocalBackup(notes, notebooks, tags);
    alert("Backup created successfully!");
  };

  // Command palette commands
  const commands: Command[] = [
    {
      id: "new-note",
      label: "New Note",
      description: "Create a blank note",
      icon: <COMMAND_ICONS.Plus className="h-4 w-4" />,
      action: () => handleCreateNote(),
      keywords: ["create", "add"],
    },
    {
      id: "new-template",
      label: "New from Template",
      description: "Create note from a template",
      icon: <COMMAND_ICONS.FileText className="h-4 w-4" />,
      action: () => setIsTemplateManagerOpen(true),
      keywords: ["template", "journal", "daily"],
    },
    {
      id: "export",
      label: "Export Notes",
      description: "Download your notes",
      icon: <COMMAND_ICONS.Download className="h-4 w-4" />,
      action: () => setIsExportImportOpen(true),
      keywords: ["download", "backup", "save"],
    },
    {
      id: "import",
      label: "Import Notes",
      description: "Upload notes from file",
      icon: <COMMAND_ICONS.Upload className="h-4 w-4" />,
      action: () => setIsExportImportOpen(true),
      keywords: ["upload", "restore"],
    },
    {
      id: "backup",
      label: "Create Local Backup",
      description: "Save backup to browser storage",
      icon: <COMMAND_ICONS.Archive className="h-4 w-4" />,
      action: handleCreateBackup,
      keywords: ["save", "backup"],
    },
    {
      id: "theme",
      label: "Toggle Theme",
      description: `Current: ${theme}`,
      icon: theme === "dark-amoled" ? <COMMAND_ICONS.Moon className="h-4 w-4" /> : <COMMAND_ICONS.Sun className="h-4 w-4" />,
      action: cycleTheme,
      keywords: ["dark", "light", "appearance"],
    },
    {
      id: "starred",
      label: "View Starred Notes",
      description: "Show only starred notes",
      icon: <COMMAND_ICONS.Star className="h-4 w-4" />,
      action: () => {
        setSearchFilters({ ...searchFilters, starred: true });
        setActivePanel("notes");
      },
      keywords: ["favorite", "important"],
    },
    {
      id: "pinned",
      label: "View Pinned Notes",
      description: "Show only pinned notes",
      icon: <COMMAND_ICONS.Pin className="h-4 w-4" />,
      action: () => {
        setSearchFilters({ ...searchFilters, pinned: true });
        setActivePanel("notes");
      },
      keywords: ["pin"],
    },
  ];

  // Search results
  const searchResults = useMemo(() => {
    const dayRange = (() => {
      if (!selectedDate) return null;
      const start = new Date(`${selectedDate}T00:00:00.000Z`).getTime();
      const end = start + 24 * 60 * 60 * 1000 - 1;
      return { start, end };
    })();

    const filters: SearchFilters = {
      ...searchFilters,
      query: deferredSearchQuery,
      notebookId: activePanel === "notes" && selectedNotebook ? selectedNotebook : undefined,
      tagIds: activePanel === "notes" && selectedTag ? [selectedTag] : undefined,
      dateFrom: activePanel === "notes" && leftSection === "calendar" && dayRange ? dayRange.start : searchFilters.dateFrom,
      dateTo: activePanel === "notes" && leftSection === "calendar" && dayRange ? dayRange.end : searchFilters.dateTo,
    };
    return searchService.current.search(filters);
  }, [activePanel, deferredSearchQuery, leftSection, notes, searchFilters, selectedDate, selectedNotebook, selectedTag]);

  const filteredNotes = searchResults.map(r => r.note);

  const selectedNoteFull = selectedNote ? notes.find((n) => n.id === selectedNote.id) ?? selectedNote : null;

  const templates = notes.filter(n => n.isTemplate);

  // Desktop app - no auth needed, start directly
  return (
    <div className="min-h-screen bg-gray-50 dark-amoled:bg-black text-gray-900 dark-amoled:text-white transition-colors duration-300">
      <div className="flex h-screen overflow-hidden">
        {/* Left icon rail */}
        <div className="w-14 glass border-r border-gray-200 dark-amoled:border-gray-900 flex flex-col items-center py-2 gap-1 gradient-bg">
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 hover-lift"
            title="New note"
            onClick={() => {
              setActivePanel("notes");
              setTopView("folder");
              setLeftSection("folders");
              void handleCreateNote();
            }}
          >
            <Plus className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 hover-lift"
            title="Add existing (import)"
            onClick={() => {
              setExportImportDefaultTab("import");
              setIsExportImportOpen(true);
            }}
          >
            <Upload className="h-5 w-5" />
          </Button>

          <div className="my-1 h-px w-9 bg-gray-200 dark-amoled:bg-gray-900" />

          <Button
            variant="ghost"
            size="sm"
            className={`h-10 w-10 p-0 hover-lift ${leftSection === "folders" ? "bg-gray-100 dark-amoled:bg-gray-950 glow" : ""}`}
            title="Folders"
            onClick={() => {
              setActivePanel("notes");
              setTopView("folder");
              setLeftSection("folders");
            }}
          >
            <Notebook className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={`h-10 w-10 p-0 hover-lift ${leftSection === "tags" ? "bg-gray-100 dark-amoled:bg-gray-950 glow" : ""}`}
            title="Tags"
            onClick={() => {
              setActivePanel("notes");
              setTopView("folder");
              setLeftSection("tags");
            }}
          >
            <Tags className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={`h-10 w-10 p-0 hover-lift ${leftSection === "calendar" ? "bg-gray-100 dark-amoled:bg-gray-950 glow" : ""}`}
            title="Calendar"
            onClick={() => {
              setActivePanel("notes");
              setTopView("folder");
              setLeftSection("calendar");
            }}
          >
            <Calendar className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 hover-lift"
            title="Templates"
            onClick={() => {
              setActivePanel("notes");
              setTopView("folder");
              setLeftSection("templates");
              setIsTemplateManagerOpen(true);
            }}
          >
            <Sparkles className="h-5 w-5" />
          </Button>

          <div className="mt-auto flex flex-col items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-10 w-10 p-0 hover-lift ${leftSection === "settings" ? "bg-gray-100 dark-amoled:bg-gray-950 glow" : ""}`}
              title="Settings"
              onClick={() => {
                setLeftSection("settings");
                setActivePanel("account");
                setSelectedNote(null);
              }}
            >
              <Settings className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover-lift" title="Toggle theme" onClick={cycleTheme}>
              {theme === "dark-amoled" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Side panel */}
        {isSidebarOpen && (
          <div className="w-64 glass border-r border-gray-200 dark-amoled:border-gray-900 p-3 flex flex-col animate-slide-down">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold uppercase tracking-wide opacity-70">
                {leftSection === "folders"
                  ? "Folder View"
                  : leftSection === "tags"
                  ? "Tags"
                  : leftSection === "calendar"
                  ? "Calendar"
                  : leftSection === "templates"
                  ? "Templates"
                  : "Settings"}
              </div>
              {leftSection === "folders" ? (
                <Button variant="ghost" size="sm" onClick={handleCreateNotebook} className="h-8 w-8 p-0" title="New folder">
                  <Plus className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            {leftSection === "folders" ? (
              <div className="space-y-2">
                <button
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover-lift ${
                    !selectedNotebook && activePanel === "notes"
                      ? "bg-blue-100 dark-amoled:bg-blue-950"
                      : "hover:bg-gray-100 dark-amoled:hover:bg-gray-900"
                  } ${draggedNote ? "border-2 border-dashed border-blue-400" : ""}`}
                  onClick={() => {
                    setActivePanel("notes");
                    setSelectedNotebook(null);
                    setSelectedTag(null);
                    setSelectedDate("");
                    setSearchFilters((prev) => ({ ...prev, archived: false }));
                  }}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropOnNotebook(null)}
                >
                  <Notebook className="h-4 w-4" />
                  <span>All Notes</span>
                </button>

                {notebooks.map((notebook) => (
                  <div key={notebook.id} className="flex items-center gap-1">
                    <button
                      className={`flex-1 text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover-lift ${
                        selectedNotebook === notebook.id && activePanel === "notes"
                          ? "bg-blue-100 dark-amoled:bg-blue-950"
                          : "hover:bg-gray-100 dark-amoled:hover:bg-gray-900"
                      } ${draggedNote ? "border-2 border-dashed border-blue-400" : ""}`}
                      onClick={() => {
                        setActivePanel("notes");
                        setSelectedNotebook(notebook.id);
                        setSelectedTag(null);
                        setSelectedDate("");
                      }}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropOnNotebook(notebook.id)}
                    >
                      <Notebook className="h-4 w-4" />
                      <span className="truncate">{notebook.name}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNotebook(notebook);
                      }}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      title="Delete folder"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : leftSection === "tags" ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                {tags.length === 0 ? (
                  <div className="text-sm text-gray-600 dark-amoled:text-gray-400">No tags yet.</div>
                ) : (
                  tags.map((tag) => (
                    <button
                      key={tag.id}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm hover-lift ${
                        selectedTag === tag.id && activePanel === "notes"
                          ? "bg-blue-100 dark-amoled:bg-blue-950"
                          : "hover:bg-gray-100 dark-amoled:hover:bg-gray-900"
                      }`}
                      onClick={() => {
                        setActivePanel("notes");
                        setSelectedTag(tag.id);
                        setSelectedNotebook(null);
                        setSelectedDate("");
                      }}
                    >
                      #{tag.name}
                    </button>
                  ))
                )}
              </div>
            ) : leftSection === "calendar" ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-600 dark-amoled:text-gray-400">Filter by updated date</div>
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedDate("");
                  }}
                >
                  Clear
                </Button>
              </div>
            ) : leftSection === "templates" ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-600 dark-amoled:text-gray-400">Create notes from presets or custom templates.</div>
                <Button onClick={() => setIsTemplateManagerOpen(true)} className="w-full">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Open Templates
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover-lift ${
                    activePanel === "account" ? "bg-blue-100 dark-amoled:bg-blue-950" : "hover:bg-gray-100 dark-amoled:hover:bg-gray-900"
                  }`}
                  onClick={() => {
                    setActivePanel("account");
                    setSelectedNote(null);
                  }}
                >
                  <Settings className="h-4 w-4" />
                  Account
                </button>
                <button
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover-lift ${
                    activePanel === "security" ? "bg-blue-100 dark-amoled:bg-blue-950" : "hover:bg-gray-100 dark-amoled:hover:bg-gray-900"
                  }`}
                  onClick={() => {
                    setActivePanel("security");
                    setSelectedNote(null);
                  }}
                >
                  <Shield className="h-4 w-4" />
                  Security
                </button>
                <Button
                  onClick={() => {
                    setExportImportDefaultTab("export");
                    setIsExportImportOpen(true);
                  }}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export & Import
                </Button>
                <Button onClick={signOut} variant="outline" className="w-full justify-start text-red-600">
                  Sign out
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Main area (top bar + content) */}
        <div className="flex-1 glass flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="h-12 border-b border-gray-200 dark-amoled:border-gray-900 flex items-center gap-3 px-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="h-9 w-9 p-0"
              title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {activePanel === "notes" ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${topView === "folder" ? "bg-gray-100 dark-amoled:bg-gray-950" : ""}`}
                  onClick={() => setTopView("folder")}
                >
                  Folder View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${topView === "graph" ? "bg-gray-100 dark-amoled:bg-gray-950" : ""}`}
                  onClick={() => setTopView("graph")}
                >
                  <Network className="h-4 w-4 mr-2" />
                  Graph View
                </Button>
                {topView === "graph" && (
                  <>
                    <div className="mx-2 h-4 w-px bg-gray-200 dark-amoled:bg-gray-800" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`${graphMode === "2d" ? "bg-blue-100 dark-amoled:bg-blue-950 text-blue-600" : ""}`}
                      onClick={() => setGraphMode("2d")}
                    >
                      2D
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`${graphMode === "3d" ? "bg-blue-100 dark-amoled:bg-blue-950 text-blue-600" : ""}`}
                      onClick={() => setGraphMode("3d")}
                    >
                      3D
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="text-sm font-medium">
                {activePanel === "account" ? "Account" : "Security"}
              </div>
            )}

            <div className="flex-1 flex justify-center">
              <div className="relative w-full max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white dark-amoled:bg-gray-950"
                />
              </div>
            </div>

            {activePanel === "notes" ? (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsTemplateManagerOpen(true)}
                  size="sm"
                  variant="ghost"
                  title="New from template"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
                <Button onClick={() => void handleCreateNote()} size="sm" title="New note">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>

          {/* Content row */}
          {activePanel === "notes" && topView === "graph" ? (
            <div className="flex-1 overflow-hidden animate-scale-in">
              {graphMode === "2d" ? (
                <GraphView
                  notes={filteredNotes}
                  onOpenNote={(noteId) => {
                    const n = notes.find((x) => x.id === noteId);
                    if (n) {
                      setSelectedNote(n);
                      setTopView("folder");
                    }
                  }}
                />
              ) : (
                <GraphView3D
                  notes={filteredNotes}
                  onOpenNote={(noteId) => {
                    const n = notes.find((x) => x.id === noteId);
                    if (n) {
                      setSelectedNote(n);
                      setTopView("folder");
                    }
                  }}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* Notes List */}
              <div className="w-80 border-r border-gray-200 dark-amoled:border-gray-900 flex flex-col animate-fade-slide">
                {/* Multiselect toolbar */}
                {activePanel === "notes" && filteredNotes.length > 0 && (
                  <div className="p-2 border-b border-gray-200 dark-amoled:border-gray-900 flex items-center gap-2">
                    {!isMultiSelectMode ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsMultiSelectMode(true)}
                        className="text-xs"
                      >
                        Select Multiple
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsMultiSelectMode(false);
                            setSelectedNoteIds(new Set());
                          }}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                        <span className="text-xs text-gray-600 dark-amoled:text-gray-400">
                          {selectedNoteIds.size} selected
                        </span>
                        {selectedNoteIds.size > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleBulkDelete}
                            className="text-xs text-red-600 hover:text-red-700 ml-auto"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {activePanel !== "notes" ? (
                    <div className="p-4 text-sm text-gray-600 dark-amoled:text-gray-400">
                      {activePanel === "account"
                        ? "Manage your account settings on the right."
                        : "Security and encryption controls are on the right."}
                    </div>
                  ) : filteredNotes.length === 0 ? (
                    <div className="p-4 text-sm text-gray-600 dark-amoled:text-gray-400">No notes found.</div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark-amoled:divide-gray-900">
                      {filteredNotes.map((note) => {
                        const isSelected = selectedNote?.id === note.id;
                        const isChecked = selectedNoteIds.has(note.id);
                        const title = note.title || "Untitled";
                        const preview = note.content.length > 80 ? note.content.slice(0, 80) + "…" : note.content;
                        return (
                          <div
                            key={note.id}
                            draggable={!isMultiSelectMode}
                            onDragStart={() => handleDragStart(note.id)}
                            onDragEnd={handleDragEnd}
                            className={`relative group w-full text-left p-3 hover:bg-gray-50 dark-amoled:hover:bg-gray-950 transition-all duration-200 cursor-move ${
                              isSelected ? "bg-gray-100 dark-amoled:bg-gray-950 border-l-2 border-blue-500" : ""
                            } ${
                              isChecked ? "bg-blue-50 dark-amoled:bg-blue-950/50" : ""
                            } ${
                              draggedNote === note.id ? "opacity-50" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {isMultiSelectMode && (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleNoteSelection(note.id)}
                                  className="mt-1 cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              <button
                                className="flex-1 text-left"
                                onClick={() => {
                                  if (isMultiSelectMode) {
                                    toggleNoteSelection(note.id);
                                  } else {
                                    setSelectedNote(note);
                                  }
                                }}
                              >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="font-medium truncate flex items-center gap-2">
                                    {note.pinned && <Pin className="h-3 w-3 text-blue-500 animate-pulse-slow" />}
                                    {note.starred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                                    {title}
                                  </div>
                                  <div className="text-xs text-gray-500 dark-amoled:text-gray-400 whitespace-nowrap">
                                    {new Date(note.updatedAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="mt-1 text-xs line-clamp-2 text-gray-600 dark-amoled:text-gray-400">{preview || " "}</div>
                              </button>
                              {!isMultiSelectMode && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteNote(note);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-red-600 hover:text-red-700 shrink-0"
                                  title="Delete note"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1 flex flex-col overflow-hidden">
          {activePanel === "account" ? (
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <h2 className="text-xl font-semibold">Account Settings</h2>
              <div className="rounded-md border border-gray-200 dark-amoled:border-gray-800 p-4 glass">
                <div className="text-sm">Email</div>
                <div className="font-medium break-all">{userEmail}</div>
                <div className="mt-3 text-sm">User ID</div>
                <div className="font-mono text-xs break-all">{userId}</div>
              </div>
              <div className="space-y-2">
                <Button onClick={() => setIsExportImportOpen(true)} variant="outline" className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Export & Import
                </Button>
                <Button onClick={handleCreateBackup} variant="outline" className="w-full justify-start">
                  <Archive className="h-4 w-4 mr-2" />
                  Create Local Backup
                </Button>
              </div>
            </div>
          ) : activePanel === "security" ? (
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <h2 className="text-xl font-semibold">Security</h2>
              <div className="rounded-md border border-gray-200 dark-amoled:border-gray-800 p-4 glass">
                <div className="text-sm font-medium">Encryption</div>
                <p className="mt-1 text-sm text-gray-600 dark-amoled:text-gray-400">
                  Notes are encrypted in the browser using your passphrase before they are stored in Supabase.
                </p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    setEncryptionKey(null);
                    setPassphrase("");
                    setPassphraseError(null);
                  }}
                >
                  Lock now
                </Button>
              </div>
            </div>
          ) : selectedNoteFull ? (
            <NoteEditor
              note={selectedNoteFull}
              notebooks={notebooks}
              tags={tags}
              allNotes={notes}
              onSave={handleSaveNote}
              onTogglePinned={() => handleTogglePinned(selectedNoteFull)}
              onToggleStarred={() => handleToggleStarred(selectedNoteFull)}
              onToggleArchived={() => handleToggleArchived(selectedNoteFull)}
              onDelete={() => handleDeleteNote(selectedNoteFull)}
              onCancel={() => setSelectedNote(null)}
              onNavigateToNote={(noteId) => {
                const targetNote = notes.find((n) => n.id === noteId);
                if (targetNote) {
                  setSelectedNote(targetNote);
                }
              }}
              onCreateNote={async (title: string) => {
                try {
                  const newNote = await addNote(selectedNoteFull.notebookId);
                  await updateNote(newNote.id, { ...newNote, title, content: "" });
                  return newNote.id;
                } catch (e) {
                  console.error('Failed to create note:', e);
                  return null;
                }
              }}
              addTag={addTag}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark-amoled:text-gray-400">
              <FileText className="h-16 w-16 mb-4 opacity-50" />
              <p>Select a note or create a new one</p>
              <p className="text-sm mt-2">
                Press <kbd className="px-2 py-1 bg-gray-100 dark-amoled:bg-gray-800 rounded">Cmd/Ctrl+K</kbd> for commands
              </p>
            </div>
          )}
        </div>
            </div>
          )}

        {/* Modals */}
        <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} commands={commands} />

        <TemplateManager
          isOpen={isTemplateManagerOpen}
          onClose={() => setIsTemplateManagerOpen(false)}
          templates={templates}
          onCreateFromTemplate={handleCreateNote}
          onCreateTemplate={async (template) => {
            await addNote(template.notebookId);
          }}
        />

        <ExportImportModal
          isOpen={isExportImportOpen}
          onClose={() => setIsExportImportOpen(false)}
          defaultTab={exportImportDefaultTab}
          notes={notes}
          notebooks={notebooks}
          tags={tags}
          selectedNote={selectedNoteFull}
          onImport={handleImport}
        />

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="glass">
            <AlertDialogHeader>
              <AlertDialogTitle>{noteToDelete ? "Delete Note" : "Delete Notebook"}</AlertDialogTitle>
              <AlertDialogDescription>
                {noteToDelete
                  ? "Are you sure you want to delete this note? This action cannot be undone."
                  : "Are you sure you want to delete this notebook? All notes in this notebook will be moved to \"All Notes\"."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
    </div>
  );
}

// Note Editor Component
function NoteEditor({
  note,
  notebooks,
  tags,
  allNotes,
  onSave,
  onTogglePinned,
  onToggleStarred,
  onToggleArchived,
  onDelete,
  onCancel,
  onNavigateToNote,
  onCreateNote,
  addTag,
}: {
  note: Note;
  notebooks: NotebookType[];
  tags: TagType[];
  allNotes: Note[];
  onSave: (note: Note) => Promise<void>;
  onTogglePinned: () => void;
  onToggleStarred: () => void;
  onToggleArchived: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onNavigateToNote: (noteId: string) => void;
  onCreateNote: (title: string) => Promise<string | null>;
  addTag: (name: string) => Promise<string>;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [selectedNotebook, setSelectedNotebook] = useState(note.notebookId || "");
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(note.tags || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detect Ctrl/Cmd key press for wiki-link activation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleSaveClick = async () => {
    setIsSaving(true);
    
    // Check for wiki-link auto-creation
    const wikiLinks = extractWikiLinks(content);
    for (const link of wikiLinks) {
      const exists = allNotes.find(n => n.title.toLowerCase() === link.title.toLowerCase());
      if (!exists) {
        await onCreateNote(link.title);
      }
    }
    
    try {
      await onSave({
        ...note,
        title: title.trim() || "Untitled",
        content: content.trim(),
        notebookId: selectedNotebook || undefined,
        tags: selectedTags,
        updatedAt: Date.now(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTagInput = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tagId = await addTag(tagInput.trim());
      setSelectedTags((prev) => [...prev, tagId]);
      setTagInput("");
    }
  };

  const removeTag = (tagId: string) => {
    setSelectedTags((prev) => prev.filter((id) => id !== tagId));
  };

  // Extract wiki-links from content
  const extractWikiLinks = (text: string): Array<{ title: string; start: number; end: number }> => {
    const links: Array<{ title: string; start: number; end: number }> = [];
    const regex = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const title = match[1]?.split("|")[0]?.trim();
      if (title) {
        links.push({
          title,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
    return links;
  };

  // Handle wiki-link click
  const handleWikiLinkClick = (linkTitle: string) => {
    // Find note by title (case-insensitive)
    const targetNote = allNotes.find(
      (n) => n.title.toLowerCase() === linkTitle.toLowerCase()
    );
    if (targetNote) {
      onNavigateToNote(targetNote.id);
    } else {
      // Note doesn't exist, could create it here
      alert(`Note "${linkTitle}" not found. Create it first!`);
    }
  };

  const wikiLinks = extractWikiLinks(content);

  return (
    <div className="flex flex-col h-full animate-scale-in">
      <div className="p-4 border-b border-gray-200 dark-amoled:border-gray-900 glass">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePinned}
              className={`p-2 rounded-md hover:bg-gray-100 dark-amoled:hover:bg-gray-900 transition-all ${note.pinned ? "text-blue-500 glow" : ""}`}
              title="Pin note"
            >
              <Pin className="h-4 w-4" />
            </button>
            <button
              onClick={onToggleStarred}
              className={`p-2 rounded-md hover:bg-gray-100 dark-amoled:hover:bg-gray-900 transition-all ${note.starred ? "text-yellow-500 glow" : ""}`}
              title="Star note"
            >
              <Star className={`h-4 w-4 ${note.starred ? "fill-yellow-500" : ""}`} />
            </button>
            <button
              onClick={onToggleArchived}
              className={`p-2 rounded-md hover:bg-gray-100 dark-amoled:hover:bg-gray-900 ${note.archived ? "text-gray-500" : ""}`}
              title="Archive note"
            >
              <Archive className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark-amoled:text-gray-400">
            {isSaving ? (
              <span className="flex items-center gap-1 animate-pulse-slow">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Saving...
              </span>
            ) : null}
            <Button 
              onClick={handleSaveClick} 
              size="sm" 
              className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white glow"
              disabled={isSaving}
            >
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700 h-7 px-2">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 px-2">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Input
          placeholder="Note title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-xl font-semibold border-none focus-visible:ring-0 bg-transparent px-0 placeholder:text-gray-400"
        />

        <div className="flex flex-wrap gap-4 mt-3">
          <select
            value={selectedNotebook}
            onChange={(e) => setSelectedNotebook(e.target.value)}
            className="px-3 py-2 rounded-md text-sm glass border border-gray-200 dark-amoled:border-gray-800 hover-lift cursor-pointer"
          >
            <option value="">All Notes</option>
            {notebooks.map((notebook) => (
              <option key={notebook.id} value={notebook.id}>
                {notebook.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar relative">
        <Textarea
          ref={textareaRef}
          placeholder="Start writing your note... Use [[Note Title]] to link notes. Hold Ctrl/Cmd and click links to navigate."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="h-full resize-none border-none focus-visible:ring-0 bg-transparent placeholder:text-gray-400"
        />
        {/* Wiki-link overlay - shows when Ctrl/Cmd is pressed */}
        {isCtrlPressed && wikiLinks.length > 0 && (
          <div className="absolute inset-0 p-4 pointer-events-none">
            <div className="relative w-full h-full whitespace-pre-wrap break-words font-mono text-sm">
              {(() => {
                const parts: React.ReactNode[] = [];
                let lastIndex = 0;
                wikiLinks.forEach((link, idx) => {
                  // Text before link
                  if (link.start > lastIndex) {
                    parts.push(
                      <span key={`text-${idx}`} className="invisible">
                        {content.slice(lastIndex, link.start)}
                      </span>
                    );
                  }
                  // Clickable link
                  const linkText = content.slice(link.start, link.end);
                  parts.push(
                    <button
                      key={`link-${idx}`}
                      onClick={() => handleWikiLinkClick(link.title)}
                      className="pointer-events-auto text-blue-600 dark-amoled:text-blue-400 hover:underline cursor-pointer bg-blue-50 dark-amoled:bg-blue-950 px-1 rounded"
                    >
                      {linkText}
                    </button>
                  );
                  lastIndex = link.end;
                });
                // Remaining text
                if (lastIndex < content.length) {
                  parts.push(
                    <span key="text-end" className="invisible">
                      {content.slice(lastIndex)}
                    </span>
                  );
                }
                return parts;
              })()}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark-amoled:border-gray-900 glass">
        <div className="mb-3">
          <label className="text-sm font-medium mb-2 block">Tags</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedTags.map((tagId) => {
              const tag = tags.find((t) => t.id === tagId);
              return tag ? (
                <div key={tag.id} className="px-3 py-1 rounded-full text-xs flex items-center space-x-1 bg-blue-100 dark-amoled:bg-blue-950 text-blue-800 dark-amoled:text-blue-200 hover-lift cursor-pointer">
                  <span>#{tag.name}</span>
                  <button onClick={() => removeTag(tag.id)} className="hover:opacity-70 ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null;
            })}
          </div>
          <Input
            placeholder="Type tag and press Enter..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagInput}
            className="glass"
          />
        </div>
      </div>
    </div>
  );
}
