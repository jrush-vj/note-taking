# Building for Windows from Linux

Since you're on Arch Linux, you can build Windows executables using cross-compilation. Here's how:

## Option 1: Cross-Compile with MinGW (Recommended for small projects)

### Install MinGW toolchain

```bash
# On Arch Linux
sudo pacman -S mingw-w64-gcc

# Add Windows target to Rust
rustup target add x86_64-pc-windows-gnu
```

### Configure Cargo

Create `~/.cargo/config.toml`:

```toml
[target.x86_64-pc-windows-gnu]
linker = "x86_64-w64-mingw32-gcc"
ar = "x86_64-w64-mingw32-ar"
```

### Build for Windows

```bash
# Build Windows binary
npm run tauri build -- --target x86_64-pc-windows-gnu

# Output: src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/
```

## Option 2: Use GitHub Actions (Recommended for distribution)

Create `.github/workflows/build.yml`:

```yaml
name: Build Desktop Apps

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        platform: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.platform }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        
      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.0-dev \
            build-essential \
            curl \
            wget \
            file \
            libssl-dev \
            libgtk-3-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev
            
      - name: Install Node dependencies
        run: npm install
        
      - name: Build Desktop App
        run: npm run tauri:build
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: desktop-app-${{ matrix.platform }}
          path: |
            src-tauri/target/release/bundle/**/*.AppImage
            src-tauri/target/release/bundle/**/*.deb
            src-tauri/target/release/bundle/**/*.exe
            src-tauri/target/release/bundle/**/*.msi
```

### Trigger build

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Option 3: Build on Windows Machine

If you have access to a Windows machine (physical or VM):

```powershell
# Install Node.js and npm
# Install Rust from https://rustup.rs

# Clone repo
git clone https://github.com/yourusername/note-taking.git
cd note-taking

# Install dependencies
npm install

# Build
npm run tauri:build

# Output: src-tauri\target\release\bundle\nsis\
```

## Option 4: Use Wine (Not Recommended)

Wine can run Windows builds, but it's tricky and error-prone for Tauri apps.

## Recommended Approach for Your Use Case

Since you want to send a Windows .exe to your friend:

1. **Use GitHub Actions** (Option 2) - Best for clean, reproducible builds
2. Wait 5-10 minutes for the action to complete
3. Download the Windows artifacts from the Actions tab
4. Send the .exe to your friend

## Current Build Status

- ✅ **Linux Build**: Running now (`npm run tauri:build`)
- ⏳ **Windows Build**: Need to set up cross-compilation or use GitHub Actions

## What You'll Get

### Linux Packages
- `note-taking_1.0.0_amd64.AppImage` - Portable, runs on any Linux distro
- `note-taking_1.0.0_amd64.deb` - For Debian/Ubuntu

### Windows Packages (after cross-compile or GitHub Actions)
- `Note-Taking_1.0.0_x64-setup.exe` - NSIS installer
- `Note-Taking_1.0.0_x64_en-US.msi` - MSI installer (optional)

## File Locations

```
src-tauri/target/release/bundle/
├── appimage/
│   └── note-taking_1.0.0_amd64.AppImage
├── deb/
│   └── note-taking_1.0.0_amd64.deb
└── nsis/ (Windows)
    └── Note-Taking_1.0.0_x64-setup.exe
```

## Package Sizes

- AppImage: ~8-12 MB
- DEB: ~8-10 MB
- Windows EXE: ~10-15 MB

## Testing the Build

### Linux
```bash
# AppImage
chmod +x src-tauri/target/release/bundle/appimage/*.AppImage
./src-tauri/target/release/bundle/appimage/*.AppImage

# DEB
sudo dpkg -i src-tauri/target/release/bundle/deb/*.deb
note-taking
```

### Windows
Just double-click the .exe file. Windows Defender may show a SmartScreen warning (this is normal for unsigned apps - click "More info" → "Run anyway").

## Code Signing (Optional, for production)

To avoid Windows SmartScreen warnings:
1. Get a code signing certificate (~$100-400/year)
2. Sign with `signtool` on Windows
3. Users won't see SmartScreen warnings

For friends/testing, unsigned is fine!
