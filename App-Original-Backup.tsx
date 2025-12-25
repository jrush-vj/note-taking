import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Moon, Sun, Notebook, Menu, X, Settings, Shield } from "lucide-react";
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
import type { Note, Notebook as NotebookType, Tag as TagType } from "./types/note";

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
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"notes" | "account" | "security">("notes");
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [notebookToDelete, setNotebookToDelete] = useState<NotebookType | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

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

      // Token refresh/focus events should NOT force re-unlock.
      // Only clear encryption state when the user actually signs out or changes.
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

      // Not initialized yet; will initialize on first unlock.
      setSaltBase64(null);
      setEncryptedMasterKey(null);
    })();
  }, [userEmail, userId]);

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
      // Existing user_keys row
      if (saltBase64 && encryptedMasterKey) {
        const passphraseKey = await deriveKeyFromPassphrase(passphrase, saltBase64);
        const masterKeyBase64 = await decryptMasterKey(passphraseKey, encryptedMasterKey);
        const masterKey = await importAesKeyFromBase64(masterKeyBase64);
        setEncryptionKey(masterKey);
        return;
      }

      // First-time initialization
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            <Button onClick={signInWithGoogle} className="w-full">
              Continue with Google
            </Button>
            <p className="text-xs text-gray-500">
              You will be asked for a passphrase next. It encrypts your notes before they are stored in Supabase.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!encryptionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Unlock Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">Signed in as {userEmail}</p>
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            {passphraseError && <p className="text-sm text-red-600">{passphraseError}</p>}
            <Input
              type="password"
              placeholder={encryptedMasterKey ? "Enter your passphrase" : "Create a passphrase (you must remember it)"}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={unlockEncryption} className="flex-1">
                Unlock
              </Button>
              <Button variant="outline" onClick={signOut}>
                Sign out
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              This passphrase is never sent to Supabase. If you forget it, existing notes cannot be decrypted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    document.documentElement.classList.toggle('dark', newDarkMode);
  };

  const filteredNotes = notes.filter(note => {
    const notebookMatch = !selectedNotebook || note.notebookId === selectedNotebook;
    const tagMatch = !selectedTag || note.tags?.includes(selectedTag);
    return notebookMatch && tagMatch;
  });

  const selectedNoteFull = selectedNote ? notes.find((n) => n.id === selectedNote.id) ?? selectedNote : null;

  const handleCreateNote = async () => {
    try {
      const newNote = await addNote(selectedNotebook || undefined);
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

  const handleCancelEdit = () => {
    setSelectedNote(null);
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

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} transition-colors duration-200`}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        {isSidebarOpen && (
          <div className={`w-64 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} border-r ${isDarkMode ? 'border-gray-800' : 'border-gray-200'} p-3 flex flex-col`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Folders</h2>
              <Button variant="ghost" size="sm" onClick={handleCreateNotebook} className="h-8 w-8 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <button
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${
                  !selectedNotebook && activePanel === 'notes'
                    ? (isDarkMode ? 'bg-gray-800' : 'bg-white')
                    : (isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-white')
                }`}
                onClick={() => {
                  setActivePanel('notes');
                  setSelectedNotebook(null);
                  setSelectedTag(null);
                }}
              >
                <Notebook className="h-4 w-4" />
                <span>All Notes</span>
              </button>

              {notebooks.map((notebook) => (
                <div key={notebook.id} className="flex items-center gap-1">
                  <button
                    className={`flex-1 text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${
                      selectedNotebook === notebook.id && activePanel === 'notes'
                        ? (isDarkMode ? 'bg-gray-800' : 'bg-white')
                        : (isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-white')
                    }`}
                    onClick={() => {
                      setActivePanel('notes');
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
                    className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                      selectedTag === tag.id && activePanel === 'notes'
                        ? (isDarkMode ? 'bg-gray-800' : 'bg-white')
                        : (isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-white')
                    }`}
                    onClick={() => {
                      setActivePanel('notes');
                      setSelectedTag(tag.id);
                    }}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            </div>

            <div className={`mt-auto pt-3 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'} space-y-1`}>
              <button
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${
                  activePanel === 'account' ? (isDarkMode ? 'bg-gray-800' : 'bg-white') : (isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-white')
                }`}
                onClick={() => {
                  setActivePanel('account');
                  setSelectedNote(null);
                }}
              >
                <Settings className="h-4 w-4" />
                Account Settings
              </button>
              <button
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${
                  activePanel === 'security' ? (isDarkMode ? 'bg-gray-800' : 'bg-white') : (isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-white')
                }`}
                onClick={() => {
                  setActivePanel('security');
                  setSelectedNote(null);
                }}
              >
                <Shield className="h-4 w-4" />
                Security
              </button>
              <button
                className={`w-full text-left px-3 py-2 rounded-md text-sm text-red-600 ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-white'}`}
                onClick={signOut}
              >
                Sign out
              </button>
              <button
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-white'}`}
                onClick={toggleDarkMode}
              >
                {isDarkMode ? (
                  <span className="flex items-center gap-2"><Sun className="h-4 w-4" /> Light mode</span>
                ) : (
                  <span className="flex items-center gap-2"><Moon className="h-4 w-4" /> Dark mode</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Notes List */}
        <div className={`w-80 border-r ${isDarkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'} flex flex-col`}>
          <div className={`p-3 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden h-8 w-8 p-0">
                {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <h1 className="text-base font-semibold">
                {activePanel === 'notes'
                  ? (selectedNotebook
                      ? notebooks.find(n => n.id === selectedNotebook)?.name || 'Notes'
                      : selectedTag
                      ? `#${tags.find(t => t.id === selectedTag)?.name}`
                      : 'All Notes')
                  : activePanel === 'account'
                  ? 'Account'
                  : 'Security'}
              </h1>
            </div>
            {activePanel === 'notes' && (
              <Button onClick={handleCreateNote} size="sm" className={isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activePanel !== 'notes' ? (
              <div className={`p-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {activePanel === 'account'
                  ? 'Manage your account settings on the right.'
                  : 'Security and encryption controls are on the right.'}
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className={`p-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                No notes yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredNotes.map((note) => {
                  const isSelected = selectedNote?.id === note.id;
                  const title = note.title || 'Untitled';
                  const preview = note.content.length > 80 ? note.content.slice(0, 80) + '…' : note.content;
                  return (
                    <button
                      key={note.id}
                      className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-900 ${isSelected ? (isDarkMode ? 'bg-gray-900' : 'bg-gray-100') : ''}`}
                      onClick={() => {
                        setActivePanel('notes');
                        setSelectedNote(note);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{title}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{new Date(note.updatedAt).toLocaleDateString()}</div>
                      </div>
                      <div className={`mt-1 text-xs line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{preview || ' '}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-xs opacity-60"> </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteNote(note);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Editor / Settings Pane */}
        <div className={`flex-1 ${isDarkMode ? 'bg-gray-950' : 'bg-white'} flex flex-col`}>
          {activePanel === 'account' ? (
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-semibold">Account Settings</h2>
              <div className={`rounded-md border p-4 ${isDarkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                <div className="text-sm">Email</div>
                <div className="font-medium break-all">{userEmail}</div>
                <div className="mt-3 text-sm">User ID</div>
                <div className="font-mono text-xs break-all">{userId}</div>
              </div>
            </div>
          ) : activePanel === 'security' ? (
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-semibold">Security</h2>
              <div className={`rounded-md border p-4 ${isDarkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                <div className="text-sm font-medium">Encryption</div>
                <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Notes are encrypted in the browser using your passphrase before they are stored in Supabase.
                </p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    setEncryptionKey(null);
                    setPassphrase('');
                    setPassphraseError(null);
                  }}
                >
                  Lock now
                </Button>
              </div>
            </div>
          ) : selectedNoteFull ? (
            <div className="flex-1 overflow-hidden">
              <NoteEditor
                note={selectedNoteFull}
                notebooks={notebooks}
                tags={tags}
                onSave={handleSaveNote}
                onCancel={handleCancelEdit}
                isDarkMode={isDarkMode}
                addTag={addTag}
              />
            </div>
          ) : (
            <div className={`flex-1 flex items-center justify-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Select a note or create a new one.
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className={isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : ''}>
            <AlertDialogHeader>
              <AlertDialogTitle className={isDarkMode ? 'text-white' : ''}>
                {noteToDelete ? 'Delete Note' : 'Delete Notebook'}
              </AlertDialogTitle>
              <AlertDialogDescription className={isDarkMode ? 'text-gray-300' : ''}>
                {noteToDelete
                  ? 'Are you sure you want to delete this note? This action cannot be undone.'
                  : 'Are you sure you want to delete this notebook? All notes in this notebook will be moved to "All Notes".'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={() => setIsDeleteDialogOpen(false)}
                className={isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 border-gray-600' : ''}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className={`${isDarkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function NoteEditor({ note, notebooks, tags, onSave, onCancel, isDarkMode, addTag }: { 
  note: Note; 
  notebooks: NotebookType[]; 
  tags: TagType[];
  onSave: (note: Note) => Promise<void>; 
  onCancel: () => void;
  isDarkMode: boolean;
  addTag: (name: string) => Promise<string>;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [selectedNotebook, setSelectedNotebook] = useState(note.notebookId || '');
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(note.tags || []);

  const handleSave = async () => {
    await onSave({
      ...note,
      title: title.trim(),
      content: content.trim(),
      notebookId: selectedNotebook || undefined,
      tags: selectedTags,
      updatedAt: Date.now()
    });
  };

  const handleTagInput = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const tagId = await addTag(tagInput.trim());
      setSelectedTags(prev => [...prev, tagId]);
      setTagInput('');
    }
  };

  const removeTag = (tagId: string) => {
    setSelectedTags(prev => prev.filter(id => id !== tagId));
  };

  return (
    <div className="flex flex-col h-full">
      <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <Input
          placeholder="Note title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`text-xl font-semibold border-none focus-visible:ring-0 ${isDarkMode ? 'bg-gray-800 text-white' : ''}`}
        />
        
        <div className="flex flex-wrap gap-4 mt-3">
          <select
            value={selectedNotebook}
            onChange={(e) => setSelectedNotebook(e.target.value)}
            className={`px-3 py-2 rounded-md text-sm ${isDarkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-100 border-gray-200'} border`}
          >
            <option value="">All Notes</option>
            {notebooks.map(notebook => (
              <option key={notebook.id} value={notebook.id}>{notebook.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="flex-1 p-4">
        <Textarea
          placeholder="Start writing your note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={`h-full resize-none border-none focus-visible:ring-0 ${isDarkMode ? 'bg-gray-800 text-white' : 'text-gray-700'}`}
        />
      </div>
      
      <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="mb-3">
          <label className={`text-sm font-medium mb-2 block ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedTags.map(tagId => {
              const tag = tags.find(t => t.id === tagId);
              return tag ? (
                <div
                  key={tag.id}
                  className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 ${isDarkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'}`}
                >
                  <span>#{tag.name}</span>
                  <button
                    onClick={() => removeTag(tag.id)}
                    className="hover:opacity-70"
                  >
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
            className={isDarkMode ? 'bg-gray-700 text-white border-gray-600' : ''}
          />
        </div>
        
        <div className="flex justify-end space-x-3">
          <Button 
            variant="outline" 
            onClick={onCancel}
            className={isDarkMode ? 'border-gray-600 text-white hover:bg-gray-700' : ''}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            className={isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}