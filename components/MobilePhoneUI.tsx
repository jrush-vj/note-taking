import React, { memo, useMemo, useState } from "react";
import {
  X,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  FileText,
  MoreVertical,
  Search,
  Plus,
} from "lucide-react";
import type { Note, Notebook as NotebookType } from "../types/note";

type BottomTab = "notes" | "todos";

export function MobilePhoneUI({
  notes,
  notebooks,
  selectedNotebookId,
  onSelectNotebook,
  onSelectNote,
  onCreateNote,
}: {
  notes: Note[];
  notebooks: NotebookType[];
  selectedNotebookId: string | null;
  onSelectNotebook: (id: string | null) => void;
  onSelectNote: (note: Note) => void;
  onCreateNote: () => void;
}) {
  const [activeTab, setActiveTab] = useState<BottomTab>("notes");
  const [activeScreen, setActiveScreen] = useState<"notebooks" | "notes" | "todos">("notes");

  const notebookName = useMemo(() => {
    if (!selectedNotebookId) return "All notes";
    return notebooks.find((n) => n.id === selectedNotebookId)?.name ?? "All notes";
  }, [notebooks, selectedNotebookId]);

  const visibleNotes = useMemo(() => {
    if (!selectedNotebookId) return notes;
    return notes.filter((n) => n.notebookId === selectedNotebookId);
  }, [notes, selectedNotebookId]);

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
            onSelectNotebook={(id) => {
              onSelectNotebook(id);
              goNotes();
            }}
          />
        ) : activeScreen === "todos" ? (
          <TodosScreen onOpenMenu={() => {}} />
        ) : (
          <NotesScreen
            title="Notes"
            subtitle={`${visibleNotes.length} notes`}
            notebookName={notebookName}
            notes={visibleNotes}
            onOpenNotebooks={() => setActiveScreen("notebooks")}
            onSelectNote={onSelectNote}
          />
        )}

        {/* Floating create note button (notes tab) */}
        {activeScreen === "notes" && (
          <FixedRightFab ariaLabel="New note" onClick={onCreateNote}>
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
    </div>
  );
}

const NotebooksScreen = memo(function NotebooksScreen({
  allCount,
  notebooks,
  notebookCounts,
  selectedNotebookId,
  onClose,
  onSelectNotebook,
}: {
  allCount: number;
  notebooks: NotebookType[];
  notebookCounts: ReadonlyMap<string, number>;
  selectedNotebookId: string | null;
  onClose: () => void;
  onSelectNotebook: (id: string | null) => void;
}) {
  return (
    <div className="h-full">
      <header className="h-14 px-4 flex items-center justify-between">
        <IconButton ariaLabel="Close" onClick={onClose}>
          <X className="h-6 w-6 text-gray-300" />
        </IconButton>
        <div className="text-base font-semibold">Notebooks</div>
        <IconButton ariaLabel="Checklist" onClick={() => {}}>
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
          <button className="text-sm font-medium text-yellow-400 active:opacity-80">New</button>
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
  onOpenNotebooks,
  onSelectNote,
}: {
  title: string;
  subtitle: string;
  notebookName: string;
  notes: Note[];
  onOpenNotebooks: () => void;
  onSelectNote: (note: Note) => void;
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
            <IconButton ariaLabel="Search" onClick={() => {}}>
              <Search className="h-6 w-6 text-gray-300" />
            </IconButton>
            <IconButton ariaLabel="Menu" onClick={() => {}}>
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
              <NoteCard key={note.id} note={note} onClick={() => onSelectNote(note)} />
            ))}
            {filteredPinned.length === 0 && <div className="text-sm text-gray-500 px-1">No pinned notes</div>}
          </div>
        )}

        <div className="mt-5">
          <div className="text-sm font-medium text-gray-300 px-1">Other</div>
          <div className="space-y-3 mt-2">
            {filteredOther.map((note) => (
              <NoteCard key={note.id} note={note} onClick={() => onSelectNote(note)} />
            ))}
            {filteredOther.length === 0 && <div className="text-sm text-gray-500 px-1">No notes</div>}
          </div>
        </div>
      </main>
    </div>
  );
});

function TodosScreen({ onOpenMenu }: { onOpenMenu: () => void }) {
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

function NoteCard({ note, onClick }: { note: Note; onClick: () => void }) {
  const title = note.title?.trim() ? note.title : "Untitled";
  const preview = note.content?.trim() ? note.content : "";
  const dateLabel = new Date(note.updatedAt).toLocaleDateString();

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-neutral-900 rounded-2xl px-4 py-3 transition-transform duration-200 ease-out active:scale-[0.99]"
    >
      <div className="text-base font-semibold truncate">{title}</div>
      <div className="mt-1 text-sm text-gray-400 line-clamp-2">{preview}</div>
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        <span>{dateLabel}</span>
        <span>•</span>
        <span className="truncate">{note.notebookId ? "Notebook" : "All notes"}</span>
      </div>
    </button>
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
