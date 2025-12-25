/**
 * Export/Import Modal
 */

import { useState, useRef } from "react";
import { X, Upload, FileJson, FileText, Archive } from "lucide-react";
import { Button } from "./ui/button";
import type { Note, Notebook, Tag } from "../types/note";
import {
  downloadNote,
  exportAllAsJson,
  exportAllAsZip,
  importFromFile,
  type ImportResult,
} from "../lib/exportImport";

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  notebooks: Notebook[];
  tags: Tag[];
  selectedNote?: Note | null;
  onImport: (result: ImportResult) => void;
}

export function ExportImportModal({
  isOpen,
  onClose,
  notes,
  notebooks,
  tags,
  selectedNote,
  onImport,
}: ExportImportModalProps) {
  const [tab, setTab] = useState<"export" | "import">("export");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExportSingleNote = (format: "md" | "json") => {
    if (!selectedNote) return;
    downloadNote(selectedNote, format);
  };

  const handleExportAllJson = () => {
    exportAllAsJson(notes, notebooks, tags);
  };

  const handleExportAllZip = async () => {
    await exportAllAsZip(notes, notebooks, tags);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);

    try {
      const result = await importFromFile(file);
      if (result.success) {
        onImport(result);
        onClose();
      } else {
        setImportError(result.errors?.join(", ") || "Import failed");
      }
    } catch (error) {
      setImportError((error as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl glass-strong rounded-lg shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark-amoled:border-gray-800">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTab("export")}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                tab === "export"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 dark-amoled:text-gray-300 hover:bg-gray-100 dark-amoled:hover:bg-gray-800"
              }`}
            >
              Export
            </button>
            <button
              onClick={() => setTab("import")}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                tab === "import"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 dark-amoled:text-gray-300 hover:bg-gray-100 dark-amoled:hover:bg-gray-800"
              }`}
            >
              Import
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark-amoled:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {tab === "export" ? (
            <div className="space-y-6">
              {selectedNote && (
                <div>
                  <h3 className="font-medium mb-3">Export Current Note</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleExportSingleNote("md")}
                      className="flex-1"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Markdown (.md)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleExportSingleNote("json")}
                      className="flex-1"
                    >
                      <FileJson className="h-4 w-4 mr-2" />
                      JSON
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-medium mb-3">Export All Notes</h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={handleExportAllJson}
                    className="w-full justify-start"
                  >
                    <FileJson className="h-4 w-4 mr-2" />
                    <div className="text-left flex-1">
                      <div className="font-medium">JSON Bundle</div>
                      <div className="text-xs text-gray-500 dark-amoled:text-gray-400">
                        Single JSON file with all notes, notebooks, and tags
                      </div>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportAllZip}
                    className="w-full justify-start"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    <div className="text-left flex-1">
                      <div className="font-medium">ZIP Archive</div>
                      <div className="text-xs text-gray-500 dark-amoled:text-gray-400">
                        ZIP with individual Markdown + JSON files
                      </div>
                    </div>
                  </Button>
                </div>
              </div>

              <div className="text-sm text-gray-500 dark-amoled:text-gray-400 p-4 bg-gray-50 dark-amoled:bg-gray-900/50 rounded-lg">
                <strong>Note:</strong> Exports are encrypted if your notes are encrypted. Keep them secure.
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-3">Import Notes</h3>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.md,.markdown"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? "Importing..." : "Choose File (.json, .md)"}
                </Button>
              </div>

              {importError && (
                <div className="p-4 bg-red-50 dark-amoled:bg-red-900/20 border border-red-200 dark-amoled:border-red-800 rounded-lg text-red-700 dark-amoled:text-red-300 text-sm">
                  {importError}
                </div>
              )}

              <div className="space-y-2 text-sm text-gray-600 dark-amoled:text-gray-400">
                <p><strong>Supported formats:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>JSON: Single note or full export bundle</li>
                  <li>Markdown: .md or .markdown files</li>
                </ul>
                <p className="mt-4 text-xs">
                  Imported notes will be merged with existing notes. Duplicate IDs will create new notes.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
