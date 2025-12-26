import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { X, Search, Plus, FileText, Download, Upload, Archive, Moon, Sun, Star, Pin } from "lucide-react";
import { Input } from "./ui/input";

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  action: () => void;
  keywords?: string[];
}

export const COMMAND_ICONS = {
  Search,
  Plus,
  FileText,
  Download,
  Upload,
  Archive,
  Moon,
  Sun,
  Star,
  Pin,
};

export function CommandPalette({
  isOpen,
  onClose,
  commands,
}: {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((cmd) => {
      if (cmd.label.toLowerCase().includes(q)) return true;
      if (cmd.description?.toLowerCase().includes(q)) return true;
      if (cmd.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [commands, query]);

  const run = useCallback(
    (cmd: Command) => {
      cmd.action();
      onClose();
      setQuery("");
      setSelectedIndex(0);
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) run(cmd);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtered, isOpen, onClose, run, selectedIndex]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="w-full max-w-2xl glass-strong rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark-amoled:border-gray-900">
          <Search className="h-5 w-5 text-gray-400" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command…"
            className="border-none focus-visible:ring-0 bg-transparent"
          />
          <button className="text-gray-400 hover:text-gray-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark-amoled:text-gray-400">No results</div>
          ) : (
            <div className="py-2">
              {filtered.map((cmd, idx) => (
                <button
                  key={cmd.id}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => run(cmd)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 ${
                    idx === selectedIndex
                      ? "bg-blue-50 dark-amoled:bg-blue-950/30"
                      : "hover:bg-gray-50 dark-amoled:hover:bg-gray-950"
                  }`}
                >
                  {cmd.icon ? <span className="text-gray-500">{cmd.icon}</span> : null}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{cmd.label}</div>
                    {cmd.description ? (
                      <div className="text-xs text-gray-500 dark-amoled:text-gray-400 truncate">{cmd.description}</div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
