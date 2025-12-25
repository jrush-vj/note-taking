import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  X,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  FileText,
  MoreVertical,
  Search,
  Plus,
  Trash2,
  Pin,
  Star,
  Archive,
} from "lucide-react";
import type { Note, Notebook as NotebookType } from "../types/note";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

type BottomTab = "notes" | "todos";

export function MobilePhoneUI({
  notes,
  notebooks,
  selectedNotebookId,
  onSelectNotebook,
  onCreateNotebook,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onReload,
  onSignOut,
}: {
  notes: Note[];
  notebooks: NotebookType[];
  selectedNotebookId: string | null;
  onSelectNotebook: (id: string | null) => void;
  onCreateNotebook: (name: string) => Promise<NotebookType>;
  onCreateNote: (notebookId?: string) => Promise<Note>;
  onUpdateNote: (note: Note) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onReload: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<BottomTab>("notes");
  const [activeScreen, setActiveScreen] = useState<"notebooks" | "notes" | "todos" | "editor">("notes");

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [menuOpen, setMenuOpen] = useState(false);

  const [createNotebookOpen, setCreateNotebookOpen] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState("");
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);

  const [snack, setSnack] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const snackTimerRef = useRef<number | null>(null);

  const showSnack = (message: string, kind: "success" | "error" = "success") => {
    setSnack({ message, kind });
    if (snackTimerRef.current) window.clearTimeout(snackTimerRef.current);
    snackTimerRef.current = window.setTimeout(() => setSnack(null), 2800);
  };

  const notebookNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const nb of notebooks) map.set(nb.id, nb.name);
    return map;
  }, [notebooks]);

  const notebookName = useMemo(() => {
    if (!selectedNotebookId) return "All notes";
    return notebooks.find((n) => n.id === selectedNotebookId)?.name ?? "All notes";
  }, [notebooks, selectedNotebookId]);

  const visibleNotes = useMemo(() => {
    const base = selectedNotebookId ? notes.filter((n) => n.notebookId === selectedNotebookId) : notes;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((n) => {
      const t = (n.title ?? "").toLowerCase();
      const c = (n.content ?? "").toLowerCase();
      return t.includes(q) || c.includes(q);
    });
  }, [notes, searchQuery, selectedNotebookId]);

  const notebookCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) {
      if (!n.notebookId) continue;
      counts.set(n.notebookId, (counts.get(n.notebookId) ?? 0) + 1);
    }
    return counts;
  }, [notes]);

  const allCount = notes.length;

  const goNotes = () => {
    setActiveTab("notes");
    setActiveScreen("notes");
  };

  const goTodos = () => {
    setActiveTab("todos");
    setActiveScreen("todos");
  };

  const openEditor = (noteId: string) => {
    setEditingNoteId(noteId);
    setActiveScreen("editor");
  };

  const closeEditor = () => {
    setEditingNoteId(null);
    setActiveScreen("notes");
  };

  const createNote = async () => {
    try {
      const n = await onCreateNote(selectedNotebookId ?? undefined);
      showSnack("Note created", "success");
      openEditor(n.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create note";
      showSnack(msg, "error");
    }
  };

  const createNotebook = async () => {
    const name = newNotebookName.trim();
    if (!name) {
      showSnack("Notebook name required", "error");
      return;
    }
    try {
      setIsCreatingNotebook(true);
      const nb = await onCreateNotebook(name);
      setCreateNotebookOpen(false);
      setNewNotebookName("");
      showSnack("Notebook created", "success");
      onSelectNotebook(nb.id);
      setActiveTab("notes");
      setActiveScreen("notes");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create notebook";
      showSnack(msg, "error");
    } finally {
      setIsCreatingNotebook(false);
    }
  };

  const runReload = async () => {
    try {
      await onReload();
      showSnack("Synced", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      showSnack(msg, "error");
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-white">
      <div className="mx-auto w-full max-w-[560px] h-screen relative">
        <div className="h-full pb-14">
          {activeScreen === "notebooks" ? (
            <NotebooksScreen
              allCount={allCount}
              notebooks={notebooks}
              notebookCounts={notebookCounts}
              selectedNotebookId={selectedNotebookId}
              onClose={goNotes}
              onGoTodos={goTodos}
              onRequestCreateNotebook={() => {
                setNewNotebookName("");
                setCreateNotebookOpen(true);
              }}
              onSelectNotebook={(id) => {
                onSelectNotebook(id);
                goNotes();
              }}
            />
          ) : activeScreen === "todos" ? (
            <TodosScreen
              onOpenMenu={() => setMenuOpen(true)}
              onShowMessage={(m) => showSnack(m, "success")}
            />
          ) : activeScreen === "editor" && editingNoteId ? (
            <NoteEditorScreen
              noteId={editingNoteId}
              notes={notes}
              notebooks={notebooks}
              notebookNameById={notebookNameById}
              onBack={closeEditor}
              onUpdate={async (n) => {
                try {
                  await onUpdateNote(n);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Save failed";
                  showSnack(msg, "error");
                  throw e;
                }
              }}
              onDelete={async (noteId) => {
                try {
                  await onDeleteNote(noteId);
                  showSnack("Deleted", "success");
                  closeEditor();
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Delete failed";
                  showSnack(msg, "error");
                }
              }}
            />
          ) : (
            <NotesScreen
              title="Notes"
              subtitle={`${visibleNotes.length} notes`}
              notebookName={notebookName}
              notes={visibleNotes}
              notebookNameById={notebookNameById}
              onOpenNotebooks={() => setActiveScreen("notebooks")}
              onOpenSearch={() => setSearchOpen(true)}
              onOpenMenu={() => setMenuOpen(true)}
              onOpenNote={(note) => openEditor(note.id)}
            />
          )}

        {/* Floating create note button (notes tab) */}
        {activeScreen === "notes" && (
          <FixedRightFab ariaLabel="New note" onClick={createNote}>
            <Plus className="h-6 w-6" />
          </FixedRightFab>
        )}
        </div>
      </div>

      <BottomNav
        active={activeTab}
        onNotes={() => {
          setActiveScreen("notes");
          goNotes();
        }}
        onTodos={() => {
          setActiveScreen("todos");
          goTodos();
        }}
      />

      {/* Search dialog */}
      <AlertDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <AlertDialogContent className="bg-neutral-950 text-white border border-neutral-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Search notes</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">Search is performed on-device.</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to search"
              className="w-full h-11 rounded-xl bg-neutral-900 border border-neutral-800 px-3 text-white placeholder:text-gray-500 outline-none focus:border-yellow-400/50"
              autoFocus
            />
            <div className="text-xs text-gray-500">Matches: {visibleNotes.length}</div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-transparent text-white border-neutral-700 hover:bg-neutral-900"
              onClick={() => setSearchQuery("")}
            >
              Clear
            </AlertDialogCancel>
            <AlertDialogAction className="bg-yellow-400 text-black hover:bg-yellow-300" onClick={() => setSearchOpen(false)}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Menu dialog */}
      <AlertDialog open={menuOpen} onOpenChange={setMenuOpen}>
        <AlertDialogContent className="bg-neutral-950 text-white border border-neutral-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Menu</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">Cloud sync + account actions.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <button
              onClick={async () => {
                setMenuOpen(false);
                await runReload();
              }}
              className="w-full h-11 rounded-xl bg-neutral-900 border border-neutral-800 text-left px-3 active:opacity-90"
            >
              Reload from Supabase
            </button>
            <button
              onClick={async () => {
                setMenuOpen(false);
                try {
                  await onSignOut();
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Sign out failed";
                  showSnack(msg, "error");
                }
              }}
              className="w-full h-11 rounded-xl bg-neutral-900 border border-neutral-800 text-left px-3 active:opacity-90"
            >
              Sign out
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-yellow-400 text-black hover:bg-yellow-300" onClick={() => setMenuOpen(false)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create notebook dialog */}
      <AlertDialog open={createNotebookOpen} onOpenChange={setCreateNotebookOpen}>
        <AlertDialogContent className="bg-neutral-950 text-white border border-neutral-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">New notebook</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">Notebooks are stored in Supabase.</AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={newNotebookName}
            onChange={(e) => setNewNotebookName(e.target.value)}
            placeholder="Notebook name"
            className="w-full h-11 rounded-xl bg-neutral-900 border border-neutral-800 px-3 text-white placeholder:text-gray-500 outline-none focus:border-yellow-400/50"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-white border-neutral-700 hover:bg-neutral-900">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-yellow-400 text-black hover:bg-yellow-300"
              onClick={(e) => {
                e.preventDefault();
                if (!isCreatingNotebook) void createNotebook();
              }}
              disabled={isCreatingNotebook}
            >
              {isCreatingNotebook ? "Creating…" : "Create"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Snackbar */}
      {snack ? (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[560px] px-4 pointer-events-none">
          <div
            className={
              "pointer-events-auto w-full rounded-2xl px-4 py-3 border text-sm " +
              (snack.kind === "error"
                ? "bg-red-950/60 border-red-900 text-red-100"
                : "bg-neutral-900/70 border-neutral-800 text-gray-100")
            }
          >
            {snack.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const NotebooksScreen = memo(function NotebooksScreen({
  allCount,
  notebooks,
  notebookCounts,
  selectedNotebookId,
  onClose,
  onGoTodos,
  onRequestCreateNotebook,
  onSelectNotebook,
}: {
  allCount: number;
  notebooks: NotebookType[];
  notebookCounts: ReadonlyMap<string, number>;
  selectedNotebookId: string | null;
  onClose: () => void;
  onGoTodos: () => void;
  onRequestCreateNotebook: () => void;
  onSelectNotebook: (id: string | null) => void;
}) {
  return (
    <div className="h-full">
      <header className="h-14 px-4 flex items-center justify-between">
        <IconButton ariaLabel="Close" onClick={onClose}>
          <X className="h-6 w-6 text-gray-300" />
        </IconButton>
        <div className="text-base font-semibold">Notebooks</div>
        <IconButton ariaLabel="Checklist" onClick={onGoTodos}>
          <CheckSquare className="h-6 w-6 text-gray-300" />
        </IconButton>
      </header>

      <main className="px-4 pt-2 space-y-4 overflow-y-auto no-scrollbar" style={{ height: "calc(100% - 56px)" }}>
        <CardButton
          onClick={() => onSelectNotebook(null)}
          selected={!selectedNotebookId}
          left={<FileText className="h-6 w-6 text-gray-300" />}
          title="All notes"
          right={
            <div className="flex items-center gap-2 text-gray-400">
              <span className="text-sm font-normal">{allCount}</span>
              <ChevronRight className="h-6 w-6" />
            </div>
          }
        />

        <div className="flex items-center justify-between px-1">
          <div className="text-sm font-medium text-gray-300">My notebooks</div>
          <button onClick={onRequestCreateNotebook} className="text-sm font-medium text-yellow-400 active:opacity-80">New</button>
        </div>

        <div className="space-y-2">
          {notebooks.map((nb, idx) => (
            <NotebookRow
              key={nb.id}
              notebook={nb}
              isSelected={selectedNotebookId === nb.id}
              stripColor={PASTEL_STRIPS[idx % PASTEL_STRIPS.length]}
              count={notebookCounts.get(nb.id) ?? 0}
              onClick={() => onSelectNotebook(nb.id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
});

const NotesScreen = memo(function NotesScreen({
  title,
  subtitle,
  notebookName,
  notes,
  notebookNameById,
  onOpenNotebooks,
  onOpenSearch,
  onOpenMenu,
  onOpenNote,
}: {
  title: string;
  subtitle: string;
  notebookName: string;
  notes: Note[];
  notebookNameById: ReadonlyMap<string, string>;
  onOpenNotebooks: () => void;
  onOpenSearch: () => void;
  onOpenMenu: () => void;
  onOpenNote: (note: Note) => void;
}) {
  const [chip, setChip] = useState<string>("All");
  const [pinnedOpen, setPinnedOpen] = useState(true);

  const chips = useMemo(() => ["All", "Pinned", "Starred", "Archived"], []);

  const pinnedNotes = useMemo(() => notes.filter((n) => n.pinned), [notes]);
  const otherNotes = useMemo(() => notes.filter((n) => !n.pinned), [notes]);

  const filteredPinned = useMemo(() => {
    if (chip === "Pinned") return pinnedNotes;
    if (chip === "Starred") return pinnedNotes.filter((n) => n.starred);
    if (chip === "Archived") return pinnedNotes.filter((n) => n.archived);
    if (chip === "All") return pinnedNotes;
    return pinnedNotes;
  }, [chip, pinnedNotes]);

  const filteredOther = useMemo(() => {
    if (chip === "Pinned") return [];
    if (chip === "Starred") return otherNotes.filter((n) => n.starred);
    if (chip === "Archived") return otherNotes.filter((n) => n.archived);
    if (chip === "All") return otherNotes;
    return otherNotes;
  }, [chip, otherNotes]);

  return (
    <div className="h-full">
      <header className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between">
          <button onClick={onOpenNotebooks} className="text-left active:opacity-80">
            <div className="text-2xl font-semibold leading-tight">{title}</div>
            <div className="text-sm text-gray-400 font-normal">{subtitle}</div>
            <div className="text-xs text-gray-500 mt-0.5">{notebookName}</div>
          </button>

          <div className="flex items-center gap-2">
            <IconButton ariaLabel="Search" onClick={onOpenSearch}>
              <Search className="h-6 w-6 text-gray-300" />
            </IconButton>
            <IconButton ariaLabel="Menu" onClick={onOpenMenu}>
              <MoreVertical className="h-6 w-6 text-gray-300" />
            </IconButton>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {chips.map((c) => (
            <Chip key={c} label={c} active={chip === c} onClick={() => setChip(c)} />
          ))}
        </div>
      </header>

      <main className="px-4 pt-2 pb-4 overflow-y-auto no-scrollbar" style={{ height: "calc(100% - 124px)" }}>
        <SectionHeader
          label="Pin"
          open={pinnedOpen}
          onToggle={() => setPinnedOpen((v) => !v)}
        />

        {pinnedOpen && (
          <div className="space-y-3 mt-2">
            {filteredPinned.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                notebookLabel={note.notebookId ? notebookNameById.get(note.notebookId) ?? "Notebook" : "All notes"}
                onClick={() => onOpenNote(note)}
              />
            ))}
            {filteredPinned.length === 0 && <div className="text-sm text-gray-500 px-1">No pinned notes</div>}
          </div>
        )}

        <div className="mt-5">
          <div className="text-sm font-medium text-gray-300 px-1">Other</div>
          <div className="space-y-3 mt-2">
            {filteredOther.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                notebookLabel={note.notebookId ? notebookNameById.get(note.notebookId) ?? "Notebook" : "All notes"}
                onClick={() => onOpenNote(note)}
              />
            ))}
            {filteredOther.length === 0 && <div className="text-sm text-gray-500 px-1">No notes</div>}
          </div>
        </div>
      </main>
    </div>
  );
});

function TodosScreen({
  onOpenMenu,
  onShowMessage,
}: {
  onOpenMenu: () => void;
  onShowMessage: (message: string) => void;
}) {
  const [items, setItems] = useState<Array<{ id: string; task: string; reward: string; done: boolean }>>([
    { id: "1", task: "Drink water", reward: "Feel better", done: false },
    { id: "2", task: "10-minute walk", reward: "Energy boost", done: false },
    { id: "3", task: "Read 5 pages", reward: "Learn something", done: true },
  ]);

  const open = useMemo(() => items.filter((i) => !i.done), [items]);
  const done = useMemo(() => items.filter((i) => i.done), [items]);

  const addTodo = () => {
    const id = String(Date.now());
    setItems((prev) => [{ id, task: "New task", reward: "", done: false }, ...prev]);
    onShowMessage("To-do added (local)");
  };

  return (
    <div className="h-full">
      <header className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-3xl font-semibold leading-tight">To-dos</div>
            <div className="text-sm text-gray-400 font-normal">{open.length} to-dos</div>
          </div>
          <IconButton ariaLabel="Menu" onClick={onOpenMenu}>
            <MoreVertical className="h-6 w-6 text-gray-300" />
          </IconButton>
        </div>
      </header>

      <main className="px-4 pt-2 pb-4 overflow-y-auto no-scrollbar" style={{ height: "calc(100% - 72px)" }}>
        <div className="space-y-3">
          {open.map((t) => (
            <TodoCard
              key={t.id}
              task={t.task}
              reward={t.reward}
              done={t.done}
              onToggle={() => setItems((prev) => prev.map((p) => (p.id === t.id ? { ...p, done: !p.done } : p)))}
            />
          ))}
        </div>

        <div className="mt-6">
          <div className="text-sm font-medium text-gray-300">Completed ({done.length})</div>
          <div className="space-y-3 mt-2">
            {done.map((t) => (
              <TodoCard
                key={t.id}
                task={t.task}
                reward={t.reward}
                done={t.done}
                onToggle={() => setItems((prev) => prev.map((p) => (p.id === t.id ? { ...p, done: !p.done } : p)))}
              />
            ))}
          </div>
        </div>
      </main>

      <FixedRightFab ariaLabel="Add" onClick={addTodo}>
        <Plus className="h-6 w-6" />
      </FixedRightFab>
    </div>
  );
}

const BottomNav = memo(function BottomNav({
  active,
  onNotes,
  onTodos,
}: {
  active: BottomTab;
  onNotes: () => void;
  onTodos: () => void;
}) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[560px] h-14 bg-black px-6 flex items-center justify-around">
      <BottomTabButton active={active === "notes"} label="Notes" onClick={onNotes} icon={<FileText className="h-6 w-6" />} />
      <BottomTabButton active={active === "todos"} label="To-dos" onClick={onTodos} icon={<CheckSquare className="h-6 w-6" />} />
    </nav>
  );
});

function BottomTabButton({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="h-11 min-w-24 px-3 flex items-center justify-center gap-2 rounded-xl transition-colors duration-200 ease-out active:bg-neutral-900"
    >
      <span className={active ? "text-yellow-400" : "text-gray-400"}>{icon}</span>
      <span className={active ? "text-yellow-400 text-sm font-medium" : "text-gray-400 text-sm font-normal"}>{label}</span>
    </button>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "h-9 px-4 rounded-full text-sm transition-colors duration-200 ease-out active:opacity-90 " +
        (active ? "bg-neutral-800 text-white" : "bg-transparent text-gray-400")
      }
    >
      {label}
    </button>
  );
}

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between h-11 px-1 text-left active:opacity-90"
    >
      <span className="text-sm font-medium text-gray-300">{label}</span>
      {open ? <ChevronDown className="h-6 w-6 text-gray-400" /> : <ChevronRight className="h-6 w-6 text-gray-400" />}
    </button>
  );
}

function NoteCard({
  note,
  notebookLabel,
  onClick,
}: {
  note: Note;
  notebookLabel: string;
  onClick: () => void;
}) {
  const title = note.title?.trim() ? note.title : "Untitled";
  const preview = note.content?.trim() ? note.content : "";
  const dateLabel = new Date(note.updatedAt).toLocaleDateString();

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-neutral-900 rounded-2xl px-4 py-3 transition-transform duration-200 ease-out active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold truncate">{title}</div>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          {note.pinned ? <Pin className="h-4 w-4 text-yellow-400" /> : null}
          {note.starred ? <Star className="h-4 w-4 text-yellow-400" /> : null}
          {note.archived ? <Archive className="h-4 w-4" /> : null}
        </div>
      </div>
      <div className="mt-1 text-sm text-gray-400 line-clamp-2">{preview}</div>
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        <span>{dateLabel}</span>
        <span>•</span>
        <span className="truncate">{notebookLabel}</span>
      </div>
    </button>
  );
}

function NoteEditorScreen({
  noteId,
  notes,
  notebooks,
  notebookNameById,
  onBack,
  onUpdate,
  onDelete,
}: {
  noteId: string;
  notes: Note[];
  notebooks: NotebookType[];
  notebookNameById: ReadonlyMap<string, string>;
  onBack: () => void;
  onUpdate: (note: Note) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}) {
  const note = useMemo(() => notes.find((n) => n.id === noteId) ?? null, [notes, noteId]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [savingState, setSavingState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");

  const [pickNotebookOpen, setPickNotebookOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!note) return;
    setTitle(note.title ?? "");
    setContent(note.content ?? "");
    setSavingState("idle");
  }, [note?.id]);

  const currentNotebookLabel = useMemo(() => {
    if (!note?.notebookId) return "All notes";
    return notebookNameById.get(note.notebookId) ?? "Notebook";
  }, [note?.notebookId, notebookNameById]);

  // Debounced autosave for title/content changes.
  useEffect(() => {
    if (!note) return;

    const sameTitle = (note.title ?? "") === title;
    const sameContent = (note.content ?? "") === content;
    if (sameTitle && sameContent) return;

    setSavingState("dirty");

    const t = window.setTimeout(async () => {
      try {
        setSavingState("saving");
        await onUpdate({
          ...note,
          title,
          content,
          updatedAt: Date.now(),
        });
        setSavingState("saved");
      } catch {
        setSavingState("error");
      }
    }, 650);

    return () => window.clearTimeout(t);
  }, [content, note, onUpdate, title]);

  if (!note) {
    return (
      <div className="h-full px-4 py-4">
        <div className="flex items-center gap-2">
          <IconButton ariaLabel="Back" onClick={onBack}>
            <ArrowLeft className="h-6 w-6 text-gray-300" />
          </IconButton>
          <div className="text-sm text-gray-400">Note not found</div>
        </div>
      </div>
    );
  }

  const toggleFlag = async (key: "pinned" | "starred" | "archived") => {
    const next = { ...note, [key]: !Boolean((note as any)[key]), updatedAt: Date.now() } as Note;
    setSavingState("saving");
    try {
      await onUpdate(next);
      setSavingState("saved");
    } catch {
      setSavingState("error");
    }
  };

  const setNotebook = async (notebookId: string | undefined) => {
    setPickNotebookOpen(false);
    const next = { ...note, notebookId, updatedAt: Date.now() };
    setSavingState("saving");
    try {
      await onUpdate(next);
      setSavingState("saved");
    } catch {
      setSavingState("error");
    }
  };

  return (
    <div className="h-full">
      <header className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <IconButton ariaLabel="Back" onClick={onBack}>
            <ArrowLeft className="h-6 w-6 text-gray-300" />
          </IconButton>
          <button
            className="text-left min-w-0 active:opacity-80"
            onClick={() => setPickNotebookOpen(true)}
          >
            <div className="text-sm font-medium truncate">{currentNotebookLabel}</div>
            <div className="text-xs text-gray-500">
              {savingState === "saving"
                ? "Saving…"
                : savingState === "saved"
                  ? "Saved"
                  : savingState === "error"
                    ? "Save failed"
                    : ""}
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <IconButton ariaLabel="Pin" onClick={() => void toggleFlag("pinned")}>
            <Pin className={"h-6 w-6 " + (note.pinned ? "text-yellow-400" : "text-gray-300")} />
          </IconButton>
          <IconButton ariaLabel="Star" onClick={() => void toggleFlag("starred")}>
            <Star className={"h-6 w-6 " + (note.starred ? "text-yellow-400" : "text-gray-300")} />
          </IconButton>
          <IconButton ariaLabel="Archive" onClick={() => void toggleFlag("archived")}>
            <Archive className={"h-6 w-6 " + (note.archived ? "text-yellow-400" : "text-gray-300")} />
          </IconButton>
          <IconButton ariaLabel="Delete" onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 className="h-6 w-6 text-gray-300" />
          </IconButton>
        </div>
      </header>

      <main className="px-4 pt-2 pb-4 overflow-y-auto no-scrollbar" style={{ height: "calc(100% - 56px)" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full text-xl font-semibold bg-transparent outline-none placeholder:text-gray-600"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing…"
          className="w-full mt-3 min-h-[60vh] bg-transparent outline-none text-base text-gray-200 placeholder:text-gray-600 resize-none"
        />
      </main>

      <AlertDialog open={pickNotebookOpen} onOpenChange={setPickNotebookOpen}>
        <AlertDialogContent className="bg-neutral-950 text-white border border-neutral-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Move to notebook</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">Choose a destination notebook.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar">
            <button
              onClick={() => void setNotebook(undefined)}
              className={
                "w-full h-11 rounded-xl border px-3 text-left active:opacity-90 " +
                (!note.notebookId ? "bg-neutral-900 border-yellow-400/40" : "bg-neutral-900 border-neutral-800")
              }
            >
              All notes
            </button>
            {notebooks.map((nb) => (
              <button
                key={nb.id}
                onClick={() => void setNotebook(nb.id)}
                className={
                  "w-full h-11 rounded-xl border px-3 text-left active:opacity-90 " +
                  (note.notebookId === nb.id ? "bg-neutral-900 border-yellow-400/40" : "bg-neutral-900 border-neutral-800")
                }
              >
                {nb.name}
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-yellow-400 text-black hover:bg-yellow-300" onClick={() => setPickNotebookOpen(false)}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent className="bg-neutral-950 text-white border border-neutral-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete note?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">This removes it from Supabase permanently.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-white border-neutral-700 hover:bg-neutral-900">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={(e) => {
                e.preventDefault();
                setConfirmDeleteOpen(false);
                void onDelete(note.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TodoCard({
  task,
  reward,
  done,
  onToggle,
}: {
  task: string;
  reward: string;
  done: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full text-left bg-neutral-900 rounded-2xl px-4 py-3 flex gap-3 items-start transition-transform duration-200 ease-out active:scale-[0.99]"
    >
      <div className="h-11 w-11 grid place-items-center">
        <div
          className={
            "h-6 w-6 rounded-full grid place-items-center border " +
            (done ? "bg-yellow-400 border-yellow-400" : "border-gray-500")
          }
        >
          {done ? <div className="h-2 w-2 rounded-full bg-black" /> : null}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className={done ? "text-base font-semibold text-gray-400 line-through" : "text-base font-semibold"}>{task}</div>
        {reward ? <div className="text-sm text-gray-500 mt-0.5">{reward}</div> : <div className="text-sm text-gray-600 mt-0.5">&nbsp;</div>}
      </div>
    </button>
  );
}

function NotebookRow({
  notebook,
  isSelected,
  stripColor,
  count,
  onClick,
}: {
  notebook: NotebookType;
  isSelected: boolean;
  stripColor: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full h-14 bg-neutral-900 rounded-2xl px-4 flex items-center justify-between transition-transform duration-200 ease-out active:scale-[0.99] " +
        (isSelected ? "ring-1 ring-yellow-400/40" : "")
      }
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={"h-8 w-2 rounded-full " + stripColor} />
        <div className="min-w-0">
          <div className="text-base font-medium truncate">{notebook.name}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-gray-400">
        <span className="text-sm">{count}</span>
        <ChevronRight className="h-6 w-6" />
      </div>
    </button>
  );
}

function CardButton({
  left,
  title,
  right,
  onClick,
  selected,
}: {
  left: React.ReactNode;
  title: string;
  right: React.ReactNode;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full bg-neutral-900 rounded-2xl px-4 py-4 flex items-center justify-between transition-transform duration-200 ease-out active:scale-[0.99] " +
        (selected ? "ring-1 ring-yellow-400/40" : "")
      }
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-11 w-11 grid place-items-center">{left}</div>
        <div className="text-base font-medium truncate">{title}</div>
      </div>
      {right}
    </button>
  );
}

function IconButton({
  children,
  ariaLabel,
  onClick,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      className="h-11 w-11 rounded-full grid place-items-center transition-colors duration-200 ease-out active:bg-neutral-900"
    >
      {children}
    </button>
  );
}

function FixedRightFab({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[560px] px-4 pointer-events-none">
      <div className="flex justify-end pointer-events-auto">
        <button
          aria-label={ariaLabel}
          onClick={onClick}
          className="h-14 w-14 rounded-full bg-yellow-400 text-black shadow-lg grid place-items-center transition-transform duration-200 ease-out active:scale-95"
        >
          {children}
        </button>
      </div>
    </div>
  );
}

const PASTEL_STRIPS = [
  "bg-emerald-300",
  "bg-orange-200",
  "bg-neutral-400",
  "bg-yellow-300",
  "bg-sky-300",
];
