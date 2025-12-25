import { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Moon, Sun, Notebook, Tag, Menu, X } from "lucide-react";
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
import { useNotes } from "./hooks/useNotes";
import type { Note, Notebook as NotebookType, Tag as TagType } from "./types/note";

export default function App() {
  const { notes, notebooks, tags, addNote, addNotebook, addTag, updateNote, deleteNote, deleteNotebook } = useNotes();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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

  const handleCreateNote = () => {
    const newNote = addNote(selectedNotebook || undefined);
    setSelectedNote(newNote);
    setIsEditing(true);
  };

  const handleCreateNotebook = () => {
    const name = prompt("Enter notebook name:");
    if (name) {
      addNotebook(name);
    }
  };

  const handleSaveNote = (updatedNote: Note) => {
    updateNote(updatedNote.id, updatedNote);
    setIsEditing(false);
    setSelectedNote(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
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
      setIsEditing(false);
    }
    if (selectedNotebook === notebookToDelete?.id) {
      setSelectedNotebook(null);
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} transition-colors duration-200`}>
      <div className="flex h-screen">
        {/* Sidebar */}
        {isSidebarOpen && (
          <div className={`w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} p-4 flex flex-col`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Notebooks</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCreateNotebook}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-4">
              {/* All Notes */}
              <div
                className={`p-2 rounded-lg cursor-pointer transition-colors ${
                  !selectedNotebook ? (isDarkMode ? 'bg-blue-600' : 'bg-blue-100 text-blue-800') : (isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100')
                }`}
                onClick={() => {
                  setSelectedNotebook(null);
                  setSelectedTag(null);
                }}
              >
                <div className="flex items-center space-x-2">
                  <Notebook className="h-4 w-4" />
                  <span className="font-medium">All Notes</span>
                </div>
              </div>

              {/* Notebooks */}
              {notebooks.map((notebook) => (
                <div
                  key={notebook.id}
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedNotebook === notebook.id ? (isDarkMode ? 'bg-blue-600' : 'bg-blue-100 text-blue-800') : (isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100')
                  }`}
                  onClick={() => {
                    setSelectedNotebook(notebook.id);
                    setSelectedTag(null);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Notebook className="h-4 w-4" />
                      <span className="font-medium">{notebook.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNotebook(notebook);
                      }}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Tags Section */}
              <div className="mt-8">
                <h3 className="text-sm font-semibold mb-2 flex items-center space-x-2">
                  <Tag className="h-4 w-4" />
                  <span>Tags</span>
                </h3>
                <div className="space-y-1">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className={`p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedTag === tag.id ? (isDarkMode ? 'bg-blue-600' : 'bg-blue-100 text-blue-800') : (isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100')
                      }`}
                      onClick={() => setSelectedTag(tag.id)}
                    >
                      <span className="text-sm">#{tag.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden"
              >
                {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <h1 className="text-2xl font-bold">
                {selectedNotebook 
                  ? notebooks.find(n => n.id === selectedNotebook)?.name || 'Notes'
                  : selectedTag
                  ? `#${tags.find(t => t.id === selectedTag)?.name}`
                  : 'All Notes'}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleDarkMode}
                className="h-10 w-10 p-0"
              >
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Button
                onClick={handleCreateNote}
                className={`rounded-full p-3 h-12 w-12 shadow-md ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
              >
                <Plus className="h-6 w-6" />
              </Button>
            </div>
          </header>

          {/* Notes Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredNotes.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Notebook className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No notes yet</h3>
                  <p className="text-gray-500 mb-4">Create your first note to get started</p>
                  <Button onClick={handleCreateNote} className={isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}>
                    Create Note
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    notebooks={notebooks}
                    tags={tags}
                    onSelect={() => {
                      setSelectedNote(note);
                      setIsEditing(true);
                    }}
                    onDelete={() => handleDeleteNote(note)}
                    isDarkMode={isDarkMode}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor Modal */}
        {isEditing && selectedNote && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <NoteEditor
                note={selectedNote}
                notebooks={notebooks}
                tags={tags}
                onSave={handleSaveNote}
                onCancel={handleCancelEdit}
                isDarkMode={isDarkMode}
                addTag={addTag}
              />
            </div>
          </div>
        )}

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

function NoteCard({ note, notebooks, tags, onSelect, onDelete, isDarkMode }: { 
  note: Note; 
  notebooks: NotebookType[]; 
  tags: TagType[];
  onSelect: () => void; 
  onDelete: () => void;
  isDarkMode: boolean;
}) {
  const preview = note.content.length > 100 ? note.content.substring(0, 100) + '...' : note.content;
  const notebook = notebooks.find(n => n.id === note.notebookId);
  const noteTags = tags.filter(t => note.tags?.includes(t.id));
  
  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
      onClick={onSelect}
    >
      <CardHeader className="p-4 pb-2">
        <CardTitle className={`text-lg font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          {note.title || 'Untitled Note'}
        </CardTitle>
        {notebook && (
          <div className="flex items-center space-x-1 text-sm">
            <Notebook className="h-3 w-3" />
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>{notebook.name}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className={`text-sm mb-3 line-clamp-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {preview}
        </p>
        
        {noteTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {noteTags.map(tag => (
              <span
                key={tag.id}
                className={`px-2 py-1 rounded-full text-xs ${isDarkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'}`}
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}
        
        <div className={`flex items-center justify-between text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className="h-8 w-8 p-0"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NoteEditor({ note, notebooks, tags, onSave, onCancel, isDarkMode, addTag }: { 
  note: Note; 
  notebooks: NotebookType[]; 
  tags: TagType[];
  onSave: (note: Note) => void; 
  onCancel: () => void;
  isDarkMode: boolean;
  addTag: (name: string) => string;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [selectedNotebook, setSelectedNotebook] = useState(note.notebookId || '');
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(note.tags || []);

  const handleSave = () => {
    onSave({
      ...note,
      title: title.trim(),
      content: content.trim(),
      notebookId: selectedNotebook || undefined,
      tags: selectedTags,
      updatedAt: Date.now()
    });
  };

  const handleTagInput = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const tagId = addTag(tagInput.trim());
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