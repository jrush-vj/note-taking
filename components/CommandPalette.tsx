/**
 * Command Palette - Cmd/Ctrl+K for quick actions
 */

import { useEffect, useState, useCallback } from "react";
import { X, Search, Plus, FileText, Star, Pin, Download, Upload, Trash2, Moon, Sun, Archive } from "lucide-react";
import { Input } from "./ui/input";

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = commands.filter((cmd) => {
    const searchTerm = query.toLowerCase();
    const matchesLabel = cmd.label.toLowerCase().includes(searchTerm);
    const matchesDesc = cmd.description?.toLowerCase().includes(searchTerm);
    const matchesKeywords = cmd.keywords?.some((k) => k.toLowerCase().includes(searchTerm));
    return matchesLabel || matchesDesc || matchesKeywords;
  });

  const executeCommand = useCallback((command: Command) => {
    command.action();
    onClose();
    setQuery("");
    setSelectedIndex(0);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose, executeCommand]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 animate-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl glass-strong rounded-lg shadow-2xl animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark-amoled:border-gray-800">
          <Search className="h-5 w-5 text-gray-400" />
          <Input
            autoFocus
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="border-none focus-visible:ring-0 text-base bg-transparent"
          />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark-amoled:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark-amoled:text-gray-400">
              No commands found
            </div>
          ) : (
            <div className="py-2">
              {filteredCommands.map((cmd, index) => (
                <button
                  key={cmd.id}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                    index === selectedIndex
                      ? "bg-blue-50 dark-amoled:bg-blue-950/30"
                      : "hover:bg-gray-50 dark-amoled:hover:bg-gray-900/50"
                  }`}
                >
                  {cmd.icon && (
                    <span className="text-gray-500 dark-amoled:text-gray-400">
                      {cmd.icon}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark-amoled:text-white">
                      {cmd.label}
                    </div>
                    {cmd.description && (
                      <div className="text-sm text-gray-500 dark-amoled:text-gray-400 truncate">
                        {cmd.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark-amoled:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark-amoled:text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-100 dark-amoled:bg-gray-800 rounded">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-100 dark-amoled:bg-gray-800 rounded">Enter</kbd>
              Execute
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-100 dark-amoled:bg-gray-800 rounded">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const COMMAND_ICONS = {
  Plus,
  FileText,
  Star,
  Pin,
  Download,
  Upload,
  Trash2,
  Moon,
  Sun,
  Archive,
  Search,
};
