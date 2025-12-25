/**
 * Template Manager Modal
 */

import { useState } from "react";
import { X, FileText, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import type { Note } from "../types/note";
import { TEMPLATE_PRESETS, createTemplateFromPreset, extractVariables } from "../lib/templates";

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Note[];
  onCreateFromTemplate: (template: Note) => void;
  onCreateTemplate: (template: Note) => void;
}

export function TemplateManager({
  isOpen,
  onClose,
  templates,
  onCreateFromTemplate,
  onCreateTemplate,
}: TemplateManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  if (!isOpen) return null;

  const handleCreateFromPreset = (presetKey: keyof typeof TEMPLATE_PRESETS) => {
    const template = createTemplateFromPreset(presetKey);
    onCreateTemplate(template);
  };

  const handleCreateCustomTemplate = () => {
    if (!newTitle.trim() && !newContent.trim()) return;

    const variables = extractVariables(newTitle + " " + newContent);
    const template: Note = {
      id: `template-custom-${Date.now()}`,
      title: newTitle || "Custom Template",
      content: newContent,
      isTemplate: true,
      templateVariables: variables,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onCreateTemplate(template);
    setNewTitle("");
    setNewContent("");
    setIsCreating(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl glass-strong rounded-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark-amoled:border-gray-800">
          <h2 className="text-xl font-semibold">Templates</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark-amoled:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {isCreating ? (
            <div className="space-y-4">
              <h3 className="font-medium">Create Custom Template</h3>
              <Input
                placeholder="Template title (use {{date}}, {{time}}, {{user}}, etc.)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Textarea
                placeholder="Template content..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="h-64 resize-none"
              />
              <div className="text-sm text-gray-500 dark-amoled:text-gray-400">
                Available variables: {`{{date}}, {{time}}, {{datetime}}, {{weekday}}, {{month}}, {{year}}, {{user}}`}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateCustomTemplate}>Save Template</Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-medium">Quick Start Templates</h3>
                <Button size="sm" onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Custom
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {Object.entries(TEMPLATE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => handleCreateFromPreset(key as keyof typeof TEMPLATE_PRESETS)}
                    className="text-left p-4 rounded-lg border border-gray-200 dark-amoled:border-gray-800 hover:border-blue-500 dark-amoled:hover:border-blue-500 hover-lift transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium mb-1">
                          {preset.title.replace(/\{\{.*?\}\}/g, "[Variable]")}
                        </div>
                        <div className="text-sm text-gray-500 dark-amoled:text-gray-400 line-clamp-2">
                          {preset.content.slice(0, 100)}...
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {templates.length > 0 && (
                <>
                  <h3 className="font-medium mb-4">Your Templates</h3>
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => onCreateFromTemplate(template)}
                        className="w-full text-left p-4 rounded-lg border border-gray-200 dark-amoled:border-gray-800 hover:border-blue-500 dark-amoled:hover:border-blue-500 hover-lift transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium mb-1">{template.title}</div>
                            {template.templateVariables && template.templateVariables.length > 0 && (
                              <div className="text-xs text-gray-500 dark-amoled:text-gray-400">
                                Variables: {template.templateVariables.join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
