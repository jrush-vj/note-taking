import { useMemo, useState } from "react";
import { X, Plus, FileText } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import type { Note } from "../types/note";
import { TEMPLATE_PRESETS, createTemplateFromPreset, extractVariables } from "../lib/templates";

export function TemplateManager({
  isOpen,
  onClose,
  templates,
  onCreateFromTemplate,
  onCreateTemplate,
}: {
  isOpen: boolean;
  onClose: () => void;
  templates: Note[];
  onCreateFromTemplate: (template: Note) => void;
  onCreateTemplate: (template: Note) => void | Promise<void>;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const presets = useMemo(() => Object.entries(TEMPLATE_PRESETS), []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-4xl glass-strong rounded-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark-amoled:border-gray-900">
          <div className="text-lg font-semibold">Templates</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {isCreating ? (
            <div className="space-y-3">
              <div className="font-medium">Create template</div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Template title (supports {{date}} etc)" />
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="h-64" placeholder="Template content…" />
              <div className="text-xs text-gray-500 dark-amoled:text-gray-400">
                Variables: {"{{date}}, {{time}}, {{weekday}}, {{user}}"}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const vars = extractVariables(`${title} ${content}`);
                    const template: Note = {
                      id: `template-${Date.now()}`,
                      title: title || "Template",
                      content,
                      isTemplate: true,
                      templateVariables: vars,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    };
                    void onCreateTemplate(template);
                    setTitle("");
                    setContent("");
                    setIsCreating(false);
                  }}
                >
                  Save
                </Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="font-medium">Quick presets</div>
                <Button size="sm" onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create custom
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {presets.map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => onCreateTemplate(createTemplateFromPreset(key as keyof typeof TEMPLATE_PRESETS))}
                    className="text-left p-4 rounded-lg border border-gray-200 dark-amoled:border-gray-900 hover:border-blue-500 hover-lift"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{preset.title}</div>
                        <div className="text-xs text-gray-500 dark-amoled:text-gray-400 line-clamp-2">
                          {preset.content.slice(0, 120)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {templates.length > 0 ? (
                <>
                  <div className="font-medium mt-8 mb-3">Your templates</div>
                  <div className="space-y-2">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onCreateFromTemplate(t)}
                        className="w-full text-left p-4 rounded-lg border border-gray-200 dark-amoled:border-gray-900 hover:border-blue-500 hover-lift"
                      >
                        <div className="font-medium truncate">{t.title}</div>
                        {t.templateVariables?.length ? (
                          <div className="text-xs text-gray-500 dark-amoled:text-gray-400">
                            Vars: {t.templateVariables.join(", ")}
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
