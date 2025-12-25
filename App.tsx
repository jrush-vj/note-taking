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

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Plus,
  Trash2,
  Moon,
  Sun,
  Notebook,
  Menu,
  Settings,
  Shield,
  Search,
  Star,
  Pin,
  Archive,
  FileText,
  Download,
  Upload,
  Sparkles,
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
import { useMediaQuery } from "./hooks/useMediaQuery";
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
import type { ImportResult } from "./lib/exportImport";
import type { Note, Notebook as NotebookType, Tag as TagType, SearchFilters, AppPreferences, ThemeMode } from "./types/note";
import { MobilePhoneUI } from "./components/MobilePhoneUI";

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

  const isMobile = useMediaQuery("(max-width: 768px)");

  // Fast-create UX
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: "",
    archived: false,
  });

  // Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);

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
    setAuthError(null);
    setActivePanel("notes");
    setIsCreatingNote(true);

    const placeholder: Note = {
      id: "__creating__",
      title: "",
      content: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSelectedNote(placeholder);
    if (isMobile) setMobileTab("editor");

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
      setSelectedNote(null);
    } finally {
      setIsCreatingNote(false);
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
      if (updatedNote.id === "__creating__") return;
      await updateNote(updatedNote.id, updatedNote);
      setSelectedNote(updatedNote);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save note";
      setAuthError(msg);
    }
  };

  const handleTogglePinned = async (note: Note) => {
    if (note.id === "__creating__") return;
    await updateNote(note.id, { ...note, pinned: !note.pinned });
  };

  const handleToggleStarred = async (note: Note) => {
    if (note.id === "__creating__") return;
    await updateNote(note.id, { ...note, starred: !note.starred });
  };

  const handleToggleArchived = async (note: Note) => {
    if (note.id === "__creating__") return;
    await updateNote(note.id, { ...note, archived: !note.archived });
  };

  const handleDeleteNote = (note: Note) => {
    if (note.id === "__creating__") return;
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

    for (const note of result.notes) {
      await addNote(note.notebookId);
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
    const filters = { ...searchFilters, query: searchQuery };
    return searchService.current.search(filters);
  }, [searchQuery, searchFilters, notes]);

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

  if (isMobile) {
    return (
      <MobilePhoneUI
        notes={notes}
        notebooks={notebooks}
        selectedNotebookId={selectedNotebook}
        onSelectNotebook={(id) => {
          setActivePanel("notes");
          setSelectedNotebook(id);
          setSelectedTag(null);
          setSelectedNote(null);
        }}
        onSelectNote={(note) => {
          setActivePanel("notes");
          setSelectedNote(note);
        }}
        onCreateNote={() => {
          void handleCreateNote();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark-amoled:bg-black text-gray-900 dark-amoled:text-white transition-colors duration-300">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        {isSidebarOpen && (
          <div className="w-64 glass border-r border-gray-200 dark-amoled:border-gray-900 p-3 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Folders</h2>
              <Button variant="ghost" size="sm" onClick={handleCreateNotebook} className="h-8 w-8 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

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
                  setSearchFilters({ query: "", archived: false });
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
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70 mb-2">Tags</h3>
              <div className="space-y-1">
                {tags.map((tag) => (
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
                    }}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-3 border-t border-gray-200 dark-amoled:border-gray-900 space-y-1">
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
              <button
                className="w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-gray-100 dark-amoled:hover:bg-gray-900 hover-lift"
                onClick={cycleTheme}
              >
                {theme === "dark-amoled" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark-amoled" ? "Light" : theme === "light" ? "System" : "Dark"}
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 dark-amoled:hover:bg-red-950/30 hover-lift"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Notes List */}
        <div className="w-full md:w-80 glass border-r border-gray-200 dark-amoled:border-gray-900 flex flex-col">
          <div className="p-3 border-b border-gray-200 dark-amoled:border-gray-900">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsSidebarOpen(!isSidebarOpen);
                  }}
                  className="md:hidden h-8 w-8 p-0"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-base font-semibold">
                  {activePanel === "notes"
                    ? selectedNotebook
                      ? notebooks.find((n) => n.id === selectedNotebook)?.name || "Notes"
                      : selectedTag
                      ? `#${tags.find((t) => t.id === selectedTag)?.name}`
                      : "All Notes"
                    : activePanel === "account"
                    ? "Account"
                    : "Security"}
                </h1>
              </div>
              {activePanel === "notes" && (
                <div className="flex items-center gap-1">
                  <Button onClick={() => setIsTemplateManagerOpen(true)} size="sm" variant="ghost" title="New from template">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => handleCreateNote()} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {activePanel === "notes" && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white dark-amoled:bg-gray-950"
                />
              </div>
            )}
          </div>

          <NotesList
            activePanel={activePanel}
            filteredNotes={filteredNotes}
            isCreatingNote={isCreatingNote}
            selectedNoteId={selectedNote?.id ?? null}
            onSelect={(note) => {
              setActivePanel("notes");
              setSelectedNote(note);
            }}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 glass flex flex-col overflow-hidden">
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
              isCreating={isCreatingNote || selectedNoteFull.id === "__creating__"}
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
  );
}

function NotesList({
  activePanel,
  filteredNotes,
  selectedNoteId,
  onSelect,
  isCreatingNote,
}: {
  activePanel: "notes" | "account" | "security";
  filteredNotes: Note[];
  selectedNoteId: string | null;
  onSelect: (note: Note) => void;
  isCreatingNote: boolean;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const count = filteredNotes.length;

  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 82,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto custom-scrollbar">
      {activePanel !== "notes" ? (
        <div className="p-4 text-sm text-gray-600 dark-amoled:text-gray-400">
          {activePanel === "account" ? "Manage your account settings on the right." : "Security and encryption controls are on the right."}
        </div>
      ) : isCreatingNote ? (
        <div className="p-4 text-sm text-gray-600 dark-amoled:text-gray-400">Creating note…</div>
      ) : count === 0 ? (
        <div className="p-4 text-sm text-gray-600 dark-amoled:text-gray-400">No notes found.</div>
      ) : (
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const note = filteredNotes[virtualRow.index];
            const isSelected = selectedNoteId === note.id;
            const title = note.title || "Untitled";
            const preview = note.content.length > 80 ? note.content.slice(0, 80) + "…" : note.content;
            return (
              <div
                key={note.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <button
                  className={`w-full text-left p-3 hover:bg-gray-50 dark-amoled:hover:bg-gray-950 transition-colors ${
                    isSelected ? "bg-gray-100 dark-amoled:bg-gray-950" : ""
                  }`}
                  onClick={() => onSelect(note)}
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
              </div>
            );
          })}
        </div>
      )}
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
  isCreating,
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
  isCreating: boolean;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [selectedNotebook, setSelectedNotebook] = useState(note.notebookId || "");
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(note.tags || []);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-save with debounce
  useEffect(() => {
    if (isCreating) return;
    if (title === note.title && content === note.content && selectedNotebook === note.notebookId) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

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
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, content, isCreating, note.content, note.notebookId, note.title, onSave, selectedNotebook, selectedTags]);

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
            {isCreating ? (
              <span>Creating…</span>
            ) : isSaving ? (
              <span>Saving...</span>
            ) : lastSaved ? (
              <span>Saved {new Date(lastSaved).toLocaleTimeString()}</span>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Input
          placeholder="Note title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isCreating}
          className="text-xl font-semibold border-none focus-visible:ring-0 bg-transparent px-0"
        />

        <div className="flex flex-wrap gap-4 mt-3">
          <select
            value={selectedNotebook}
            onChange={(e) => setSelectedNotebook(e.target.value)}
            disabled={isCreating}
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
          disabled={isCreating}
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
            disabled={isCreating}
            className="bg-gray-100 dark-amoled:bg-gray-900"
          />
        </div>
      </div>
    </div>
  );
}
