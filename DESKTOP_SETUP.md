# Convert to Desktop App with Tauri

## Quick Setup (5 minutes)

### 1. Install Tauri CLI
```bash
npm install -D @tauri-apps/cli
```

### 2. Initialize Tauri
```bash
npm run tauri init
```

**Configuration prompts:**
- App name: `Note Taking`
- Window title: `Note Taking`
- Web assets: `dist`
- Dev server: `http://localhost:5173`
- Dev command: `npm run dev`
- Build command: `npm run build`

### 3. Update package.json
```json
{
  "scripts": {
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  }
}
```

### 4. Install SQLite for local storage
```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

## Architecture Changes

### Current (Web):
- Supabase for storage + auth → High latency
- Network calls for every save
- Online-only

### Desktop (Local-first):
- **SQLite** for local storage → Zero latency
- **Supabase Auth** only (login/signup)
- **Optional sync** when online
- Works offline

## File Structure
```
src/
├── lib/
│   ├── localDb.ts          # NEW: SQLite operations
│   ├── supabaseClient.ts   # Keep for auth only
│   └── sync.ts             # NEW: Optional cloud sync
├── tauri/
│   ├── src/
│   │   ├── main.rs         # Rust backend
│   │   └── db.rs           # Database commands
│   └── tauri.conf.json     # Config
```

## Benefits

### Performance:
- **0ms latency** for CRUD operations (was 100-500ms)
- **Instant search** with local SQLite FTS5
- **Fast startup** (no network calls)
- **Smooth animations** (no waiting for DB)

### Features:
- **Offline-first**: Works without internet
- **File system access**: Export/import anywhere
- **System tray**: Quick access
- **Auto-updates**: Built-in updater
- **Native notifications**: System integration

### Security:
- **Local encryption**: AES-256 for database
- **No data leaks**: Everything stays local
- **Supabase Auth**: Secure login via browser

## Build Commands

### Development:
```bash
npm run tauri:dev
```

### Production Build:
```bash
npm run tauri:build
```

**Output:**
- Windows: `target/release/bundle/msi/note-taking_1.0.0_x64_en-US.msi`
- Or: `target/release/bundle/nsis/note-taking_1.0.0_x64-setup.exe`

## File Sizes

### Web App:
- Bundle: ~1.5MB (but needs browser)

### Electron:
- Bundle: ~150MB (includes Chromium)

### Tauri:
- Bundle: ~3MB installer
- Installed: ~5-8MB
- **50x smaller than Electron!**

## Next Steps

1. Run `npm install -D @tauri-apps/cli`
2. Run `npm run tauri init`
3. Create local database layer (see localDb.ts below)
4. Test with `npm run tauri:dev`
5. Build with `npm run tauri:build`

## Optional: Cloud Sync

Keep Supabase integration for:
- ✅ Authentication (login/signup)
- ✅ Cloud backup (optional sync)
- ✅ Multi-device sync
- ❌ Remove: Primary storage

Users can choose:
- Local-only (fast, offline)
- Local + cloud sync (best of both)
