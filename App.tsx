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
import { supabase } from "./lib/supabaseClient";
import {
  decryptMasterKey,
  deriveKeyFromPassphrase,
  encryptMasterKey,
  generateMasterKeyBase64,
  generateSaltBase64,
  importAesKeyFromBase64,
} from "./lib/crypto";
import { useZkNotes } from "./hooks/useZkNotes";
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

export default function App() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] | null>(null);
  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;
  const lastUserIdRef = useRef<string | null>(null);

  const [saltBase64, setSaltBase64] = useState<string | null>(null);
  const [encryptedMasterKey, setEncryptedMasterKey] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState<string>("");
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);

  const encryptionReady = useMemo(() => Boolean(userId && encryptionKey), [encryptionKey, userId]);

  const accessToken = session?.access_token ?? null;
  const { notes, notebooks, tags, addNote, addNotebook, addTag, updateNote, deleteNote, deleteNotebook } =
    useZkNotes(userId, encryptionKey, accessToken);

  // UI State
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"notes" | "account" | "security">("notes");
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [notebookToDelete, setNotebookToDelete] = useState<NotebookType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Theme
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Desktop layout state
  const [leftSection, setLeftSection] = useState<"folders" | "tags" | "calendar" | "templates" | "settings">("folders");
  const [topView, setTopView] = useState<"folder" | "graph">("folder");
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

  // Auth setup
  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) setAuthError(error.message);
      setSession(data.session);
      lastUserIdRef.current = data.session?.user?.id ?? null;
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      const nextUserId = nextSession?.user?.id ?? null;
      const lastUserId = lastUserIdRef.current;

      const userChanged = Boolean(lastUserId && nextUserId && lastUserId !== nextUserId);
      const signedOut = event === "SIGNED_OUT" || !nextUserId;

      if (signedOut || userChanged) {
        setSaltBase64(null);
        setEncryptedMasterKey(null);
        setEncryptionKey(null);
        setPassphrase("");
        setAuthError(null);
        setPassphraseError(null);
      }

      lastUserIdRef.current = nextUserId;
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;

    void (async () => {
      const { data, error } = await supabase
        .from("user_keys")
        .select("salt,encrypted_master_key")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        setAuthError(error.message);
        return;
      }

      if (data?.salt && data?.encrypted_master_key) {
        setSaltBase64(data.salt);
        setEncryptedMasterKey(data.encrypted_master_key);
        return;
      }

      setSaltBase64(null);
      setEncryptedMasterKey(null);
    })();
  }, [userEmail, userId]);

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

  const signInWithGoogle = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) setAuthError(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const unlockEncryption = async () => {
    if (passphrase.trim().length < 8) {
      setPassphraseError("Passphrase must be at least 8 characters.");
      return;
    }
    setPassphraseError(null);

    try {
      if (saltBase64 && encryptedMasterKey) {
        const passphraseKey = await deriveKeyFromPassphrase(passphrase, saltBase64);
        const masterKeyBase64 = await decryptMasterKey(passphraseKey, encryptedMasterKey);
        const masterKey = await importAesKeyFromBase64(masterKeyBase64);
        setEncryptionKey(masterKey);
        return;
      }

      if (!userId) throw new Error("Not authenticated");
      const newSalt = generateSaltBase64();
      const passphraseKey = await deriveKeyFromPassphrase(passphrase, newSalt);
      const masterKeyBase64 = generateMasterKeyBase64();
      const encrypted = await encryptMasterKey(passphraseKey, masterKeyBase64);

      const upsertRes = await supabase.from("user_keys").upsert(
        {
          user_id: userId,
          encrypted_master_key: encrypted,
          salt: newSalt,
          kdf: "pbkdf2-sha256",
          kdf_params: { iterations: 210000 },
          key_version: 1,
        },
        { onConflict: "user_id" }
      );

      if (upsertRes.error) throw upsertRes.error;

      setSaltBase64(newSalt);
      setEncryptedMasterKey(encrypted);

      const masterKey = await importAesKeyFromBase64(masterKeyBase64);
      setEncryptionKey(masterKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to unlock";
      setPassphraseError(msg);
    }
  };

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
        const created = createNoteFromTemplate(templateNote, userEmail ?? undefined);
        newNote = await addNote(created.notebookId);
        await updateNote(newNote.id, { ...newNote, ...created });
      } else {
        newNote = await addNote(selectedNotebook || undefined);
      }
      setSelectedNote(newNote);
      setActivePanel("notes");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create note";
      setAuthError(msg);
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
      setAuthError(msg);
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark-amoled:bg-black">
        <Card className="w-full max-w-md glass">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            <Button onClick={signInWithGoogle} className="w-full">
              Continue with Google
            </Button>
            <p className="text-xs text-gray-500 dark-amoled:text-gray-400">
              You will be asked for a passphrase next. It encrypts your notes before they are stored in Supabase.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!encryptionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark-amoled:bg-black">
        <Card className="w-full max-w-md glass">
          <CardHeader>
            <CardTitle>Unlock Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600 dark-amoled:text-gray-300">Signed in as {userEmail}</p>
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            {passphraseError && <p className="text-sm text-red-600">{passphraseError}</p>}
            <Input
              type="password"
              placeholder={encryptedMasterKey ? "Enter your passphrase" : "Create a passphrase (you must remember it)"}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlockEncryption()}
            />
            <div className="flex gap-2">
              <Button onClick={unlockEncryption} className="flex-1">
                Unlock
              </Button>
              <Button variant="outline" onClick={signOut}>
                Sign out
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark-amoled:text-gray-400">
              This passphrase is never sent to Supabase. If you forget it, existing notes cannot be decrypted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark-amoled:bg-black text-gray-900 dark-amoled:text-white transition-colors duration-300">
      <div className="flex h-screen overflow-hidden">
        {/* Left icon rail */}
        <div className="w-14 glass border-r border-gray-200 dark-amoled:border-gray-900 flex flex-col items-center py-2 gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0"
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
            className="h-10 w-10 p-0"
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
            className={`h-10 w-10 p-0 ${leftSection === "folders" ? "bg-gray-100 dark-amoled:bg-gray-950" : ""}`}
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
            className={`h-10 w-10 p-0 ${leftSection === "tags" ? "bg-gray-100 dark-amoled:bg-gray-950" : ""}`}
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
            className={`h-10 w-10 p-0 ${leftSection === "calendar" ? "bg-gray-100 dark-amoled:bg-gray-950" : ""}`}
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
            className="h-10 w-10 p-0"
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
              className={`h-10 w-10 p-0 ${leftSection === "settings" ? "bg-gray-100 dark-amoled:bg-gray-950" : ""}`}
              title="Settings"
              onClick={() => {
                setLeftSection("settings");
                setActivePanel("account");
                setSelectedNote(null);
              }}
            >
              <Settings className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="sm" className="h-10 w-10 p-0" title="Toggle theme" onClick={cycleTheme}>
              {theme === "dark-amoled" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Side panel */}
        {isSidebarOpen && (
          <div className="w-64 glass border-r border-gray-200 dark-amoled:border-gray-900 p-3 flex flex-col">
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
                  }`}
                  onClick={() => {
                    setActivePanel("notes");
                    setSelectedNotebook(null);
                    setSelectedTag(null);
                    setSelectedDate("");
                    setSearchFilters((prev) => ({ ...prev, archived: false }));
                  }}
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
                      }`}
                      onClick={() => {
                        setActivePanel("notes");
                        setSelectedNotebook(notebook.id);
                        setSelectedTag(null);
                        setSelectedDate("");
                      }}
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
            <div className="flex-1 overflow-hidden">
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
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* Notes List */}
              <div className="w-80 border-r border-gray-200 dark-amoled:border-gray-900 flex flex-col">
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
                        const title = note.title || "Untitled";
                        const preview = note.content.length > 80 ? note.content.slice(0, 80) + "…" : note.content;
                        return (
                          <button
                            key={note.id}
                            className={`w-full text-left p-3 hover:bg-gray-50 dark-amoled:hover:bg-gray-950 transition-colors ${
                              isSelected ? "bg-gray-100 dark-amoled:bg-gray-950" : ""
                            }`}
                            onClick={() => {
                              setSelectedNote(note);
                            }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="font-medium truncate flex items-center gap-2">
                                {note.pinned && <Pin className="h-3 w-3 text-blue-500" />}
                                {note.starred && <Star className="h-3 w-3 text-yellow-500" />}
                                {title}
                              </div>
                              <div className="text-xs text-gray-500 dark-amoled:text-gray-400 whitespace-nowrap">
                                {new Date(note.updatedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="mt-1 text-xs line-clamp-2 text-gray-600 dark-amoled:text-gray-400">{preview || " "}</div>
                          </button>
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
              onSave={handleSaveNote}
              onTogglePinned={() => handleTogglePinned(selectedNoteFull)}
              onToggleStarred={() => handleToggleStarred(selectedNoteFull)}
              onToggleArchived={() => handleToggleArchived(selectedNoteFull)}
              onDelete={() => handleDeleteNote(selectedNoteFull)}
              onCancel={() => setSelectedNote(null)}
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
  onSave,
  onTogglePinned,
  onToggleStarred,
  onToggleArchived,
  onDelete,
  onCancel,
  addTag,
}: {
  note: Note;
  notebooks: NotebookType[];
  tags: TagType[];
  onSave: (note: Note) => Promise<void>;
  onTogglePinned: () => void;
  onToggleStarred: () => void;
  onToggleArchived: () => void;
  onDelete: () => void;
  onCancel: () => void;
  addTag: (name: string) => Promise<string>;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [selectedNotebook, setSelectedNotebook] = useState(note.notebookId || "");
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(note.tags || []);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save with debounce
  useEffect(() => {
    if (title === note.title && content === note.content && selectedNotebook === note.notebookId) {
      return;
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      setIsSaving(true);
      onSave({
        ...note,
        title: title.trim(),
        content: content.trim(),
        notebookId: selectedNotebook || undefined,
        tags: selectedTags,
        updatedAt: Date.now(),
      }).then(() => {
        setIsSaving(false);
        setLastSaved(Date.now());
      });
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [title, content, selectedNotebook, selectedTags]);

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

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark-amoled:border-gray-900">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePinned}
              className={`p-2 rounded-md hover:bg-gray-100 dark-amoled:hover:bg-gray-900 ${note.pinned ? "text-blue-500" : ""}`}
              title="Pin note"
            >
              <Pin className="h-4 w-4" />
            </button>
            <button
              onClick={onToggleStarred}
              className={`p-2 rounded-md hover:bg-gray-100 dark-amoled:hover:bg-gray-900 ${note.starred ? "text-yellow-500" : ""}`}
              title="Star note"
            >
              <Star className="h-4 w-4" />
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
              <span>Saving...</span>
            ) : lastSaved ? (
              <span>Saved {new Date(lastSaved).toLocaleTimeString()}</span>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Input
          placeholder="Note title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-xl font-semibold border-none focus-visible:ring-0 bg-transparent px-0"
        />

        <div className="flex flex-wrap gap-4 mt-3">
          <select
            value={selectedNotebook}
            onChange={(e) => setSelectedNotebook(e.target.value)}
            className="px-3 py-2 rounded-md text-sm bg-gray-100 dark-amoled:bg-gray-900 border border-gray-200 dark-amoled:border-gray-800"
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

      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        <Textarea
          placeholder="Start writing your note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="h-full resize-none border-none focus-visible:ring-0 bg-transparent"
        />
      </div>

      <div className="p-4 border-t border-gray-200 dark-amoled:border-gray-900">
        <div className="mb-3">
          <label className="text-sm font-medium mb-2 block">Tags</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedTags.map((tagId) => {
              const tag = tags.find((t) => t.id === tagId);
              return tag ? (
                <div key={tag.id} className="px-2 py-1 rounded-full text-xs flex items-center space-x-1 bg-blue-100 dark-amoled:bg-blue-950 text-blue-800 dark-amoled:text-blue-200">
                  <span>#{tag.name}</span>
                  <button onClick={() => removeTag(tag.id)} className="hover:opacity-70">
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
            className="bg-gray-100 dark-amoled:bg-gray-900"
          />
        </div>
      </div>
    </div>
  );
}
