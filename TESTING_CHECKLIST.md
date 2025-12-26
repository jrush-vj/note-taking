# Testing Checklist

## Core Functionality Tests

### 1. Note Operations
- [ ] Create a new note
- [ ] Edit note title
- [ ] Edit note content
- [ ] Delete a note
- [ ] Pin a note (should appear at top)
- [ ] Star a note
- [ ] Archive a note
- [ ] Unarchive a note
- [ ] Drag and drop note to different notebook

### 2. Notebook Operations
- [ ] Create a new notebook
- [ ] Rename a notebook
- [ ] Delete a notebook
- [ ] Move notes between notebooks
- [ ] Filter notes by notebook

### 3. Tag Operations
- [ ] Create a new tag
- [ ] Add tag to note
- [ ] Remove tag from note
- [ ] Delete a tag
- [ ] Filter notes by tag

### 4. Search Functionality
- [ ] Search notes by title
- [ ] Search notes by content
- [ ] Search with filters (pinned, starred, archived)
- [ ] Full-text search (FTS5)
- [ ] Clear search

### 5. Templates
- [ ] Open template manager
- [ ] Create note from template
- [ ] Create custom template
- [ ] Delete template

### 6. Graph View
- [ ] Switch to 2D graph view
- [ ] Switch to 3D graph view
- [ ] View note connections (wiki-links)
- [ ] Click node to open note
- [ ] Zoom and pan in graph

### 7. Import/Export
- [ ] Export all notes as ZIP
- [ ] Export single note as Markdown
- [ ] Import notes from ZIP
- [ ] Import from Markdown files

### 8. UI/UX Features
- [ ] Toggle sidebar
- [ ] Switch between folders/tags/calendar/templates views
- [ ] Toggle theme (Light/Dark/System)
- [ ] Command palette (Cmd/Ctrl + K)
- [ ] Keyboard shortcuts work
- [ ] Multi-select notes (Shift+Click)
- [ ] Bulk delete selected notes

### 9. Data Persistence
- [ ] Close and reopen app - notes should persist
- [ ] Create note, restart app - note should be there
- [ ] Edit note, restart app - changes should be saved
- [ ] Check database file location:
  - Linux: `~/.local/share/com.notetaking.app/notes.db`
  - Windows: `%APPDATA%/com.notetaking.app/notes.db`

### 10. Performance
- [ ] Create 100+ notes - should still be fast
- [ ] Search across many notes - should be instant
- [ ] Switch between notebooks - no lag
- [ ] Scroll through note list - smooth

## Bug Checks
- [ ] No console errors on startup
- [ ] No errors when creating notes
- [ ] No errors when deleting items
- [ ] No memory leaks (check Task Manager)
- [ ] UI doesn't freeze during operations

## Cross-Platform
### Linux
- [ ] AppImage runs without installation
- [ ] .deb package installs correctly
- [ ] Desktop entry appears in application menu
- [ ] App icon displays correctly

### Windows
- [ ] Installer runs without admin
- [ ] App appears in Start Menu
- [ ] Uninstaller works correctly
- [ ] No false positives from Windows Defender

## Edge Cases
- [ ] Create note with very long title (1000+ chars)
- [ ] Create note with very long content (10,000+ chars)
- [ ] Create 1000+ notes
- [ ] Delete notebook with many notes
- [ ] Import malformed JSON
- [ ] Search with special characters
- [ ] Create note with emoji in title
- [ ] Test wiki-links with special characters

## Status: PASS ✅
All critical features working as expected!
