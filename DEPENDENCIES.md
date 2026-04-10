# Pane Management — Full Dependency Audit

**Date:** 2026-04-06  
**Purpose:** Document everything needed to go from a fresh Windows 11 desktop to a fully working Pane Management + Claude Code + tmux setup.

---

## Tier 1: Windows-Level Prerequisites

These are installed on the Windows side (not in WSL).

| Dependency | Version | What it's for | Install method |
|-----------|---------|---------------|----------------|
| **WSL 2** | 2.6.3+ | Runs Ubuntu for Claude Code (avoids Windows cache bug) | `wsl --install` in admin PowerShell, restart |
| **Windows Terminal** | (bundled Win11) | Terminal to access WSL | Pre-installed on Win11, or Microsoft Store |
| **Warp** | Latest | Primary terminal (optional, WT works too) | Download from warp.dev |
| **Git for Windows** | 2.51+ | Git on Windows side (Tauri builds need it) | git-scm.com installer |
| **Rust toolchain** | 1.94+ (rustc + cargo) | Compiles Tauri backend | `rustup-init.exe` from rustup.rs |
| **Visual Studio Build Tools** | 2022+ | C/C++ linker for Rust compilation on Windows | VS Installer → "Desktop development with C++" workload |
| **WebView2** | (bundled Win10/11) | Tauri's rendering engine | Pre-installed on modern Windows. If missing: evergreen installer from Microsoft |
| **Node.js** | (for npm on Windows, optional) | Only needed if running npm from PowerShell directly | nodejs.org LTS installer |

### Rust Installation Notes
```powershell
# Download and run rustup
# Accept defaults (includes cargo, rustc, rustup)
# Requires VS Build Tools to be installed FIRST
winget install Rustlang.Rustup
# Or download from https://rustup.rs
```

---

## Tier 2: WSL Environment

These are installed inside the Ubuntu WSL instance.

| Dependency | Version | What it's for | Install method |
|-----------|---------|---------------|----------------|
| **Ubuntu (WSL)** | 22.04+ | Linux environment for Claude Code | `wsl --install -d Ubuntu` |
| **nvm** | Latest | Manages Node.js versions | `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh \| bash` |
| **Node.js** | v24.14.1 (via nvm) | Runs Claude Code | `nvm install --lts` |
| **npm** | 11.x (comes with Node) | Package management | Comes with Node |
| **tmux** | 3.4+ | Terminal multiplexer — persistent sessions | `sudo apt install tmux` |
| **git** | 2.43+ | Version control | `sudo apt install git` |
| **Python 3** | 3.12+ | Barkeep statusline script, misc utilities | Usually pre-installed in Ubuntu |
| **inotify-tools** | Latest | File watching (used by config sync, currently disabled) | `sudo apt install inotify-tools` |
| **Claude Code** | 2.1.x | The AI coding assistant | `npm install -g @anthropic-ai/claude-code` |

### Node/nvm Setup
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc

# Install Node LTS
nvm install --lts
nvm use --lts

# Install Claude Code globally
npm install -g @anthropic-ai/claude-code
```

### tmux Plugin Setup
```bash
# Install TPM (tmux plugin manager)
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

# Add to ~/.tmux.conf:
# set -g @plugin 'tmux-plugins/tpm'
# set -g @plugin 'tmux-plugins/tmux-resurrect'
# set -g @plugin 'tmux-plugins/tmux-continuum'
# set -g @plugin 'fabioluciano/tmux-tokyo-night'
# run '~/.tmux/plugins/tpm/tpm'

# Then in tmux: prefix + I (capital i) to install plugins
```

**Installed tmux plugins:**
| Plugin | Purpose |
|--------|---------|
| `tpm` | Plugin manager |
| `tmux-resurrect` | Save/restore sessions, windows, panes. `prefix + Ctrl-s` to save, `prefix + Ctrl-r` to restore |
| `tmux-continuum` | Auto-saves tmux state every 15 minutes |
| `tmux-tokyo-night` | Dark theme for the statusline |

---

## Tier 3: Pane Management App Dependencies

These are the project-level dependencies for building and running the app.

### Frontend (npm — installed via `npm install` in `workspace-resume/`)

| Package | Version | Category | Purpose |
|---------|---------|----------|---------|
| `solid-js` | ^1.9 | Runtime | UI framework (signal-based reactivity) |
| `@tauri-apps/api` | ^2 | Runtime | Tauri IPC bridge (invoke Rust commands) |
| `@tauri-apps/plugin-dialog` | ^2.6 | Runtime | Native folder picker dialog |
| `@tauri-apps/plugin-fs` | ^2 | Runtime | File system access from frontend |
| `@tauri-apps/plugin-store` | ^2 | Runtime | Persistent key-value store (settings.json) |
| `@thisbeyond/solid-dnd` | ^0.7.5 | Runtime | Drag-and-drop (sortable, draggable, droppable) |
| `vite` | ^6 | Dev | Build tool / dev server |
| `vite-plugin-solid` | ^2.11 | Dev | SolidJS Vite integration |
| `typescript` | ^5.7 | Dev | Type checking |
| `tailwindcss` | ^4 | Dev | Utility-first CSS |
| `@tailwindcss/vite` | ^4 | Dev | Tailwind Vite plugin |
| `@tauri-apps/cli` | ^2 | Dev | Tauri CLI (build, dev, bundle) |

### Backend (Cargo — compiled via Tauri build in `workspace-resume/src-tauri/`)

| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | 2 | Desktop app framework |
| `tauri-build` | 2 | Build-time codegen |
| `tauri-plugin-fs` | 2 | File system plugin (with watch feature) |
| `tauri-plugin-store` | 2 | Persistent store plugin |
| `tauri-plugin-global-shortcut` | 2 | Global hotkey registration (Ctrl+Space) |
| `tauri-plugin-window-state` | 2 | Remember window size/position |
| `tauri-plugin-dialog` | 2 | Native dialogs |
| `serde` | 1 | Serialization |
| `serde_json` | 1 | JSON parsing |
| `serde_yaml` | 0.9 | YAML parsing |
| `notify` | 6 | File system watcher (session file changes) |
| `rev_lines` | 0.3 | Reverse-read files (session scanner) |
| `glob` | 0.3 | Path pattern matching |
| `dirs` | 5 | Platform-standard directory paths |
| `tokio` | 1 | Async runtime |
| `open` | 5 | Open files/URLs with system handler |
| `urlencoding` | 2 | URL encoding |
| `windows` | 0.62 | Win32 API bindings |
| `tempfile` | 3 | Temporary files |

---

## Tier 4: Configuration & Auth

| What | How to set up |
|------|---------------|
| **Anthropic API key** | Run `claude` in WSL, follow auth flow. Creates `~/.claude/.credentials.json` |
| **WSL ↔ Windows symlinks** | See Section 9 of `Claude-Local-Config-And-Environment-Notes.md`. Symlink `~/.claude/` contents to Windows `~/.claude/` |
| **settings.json path translation** | WSL `settings.json` needs `/mnt/c/` paths instead of `C:/`. Use `sync-config.sh wsl2win` or manual sed |
| **Cache header patch** | Apply to `cli.js` to fix KV cache bug. See environment notes. |
| **CLAUDE_AUTO_UPDATE_DISABLED=1** | Set in `~/.bashrc` to prevent auto-updates from overwriting the patch |
| **Git config** | `git config --global user.name` / `user.email` in both Windows and WSL |

---

## Quick Start: Fresh Windows 11 → Working Setup

### Phase 1: Windows Prerequisites (~30 min)
```powershell
# 1. Install WSL
wsl --install
# Restart computer

# 2. Install Rust
# Download rustup from https://rustup.rs and run installer
# Make sure VS Build Tools with C++ workload is installed first

# 3. Install Git (if not already)
winget install Git.Git

# 4. Install Warp (optional)
# Download from https://warp.dev
```

### Phase 2: WSL Setup (~15 min)
```bash
# 1. Install nvm + Node
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install --lts

# 2. Install tmux
sudo apt update && sudo apt install -y tmux inotify-tools

# 3. Install Claude Code
npm install -g @anthropic-ai/claude-code

# 4. Authenticate
claude
# Follow the auth flow in browser

# 5. Install tmux plugins
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
# Copy .tmux.conf, then in tmux: prefix + I
```

### Phase 3: Pane Management App (~10 min)
```bash
# Clone the repo
cd /mnt/c/Users/USERNAME/Documents
git clone https://github.com/sky-salsa/pane-management.git
cd pane-management/workspace-resume

# Install frontend deps
npm install

# Run in dev mode
npm run tauri dev
# Or use the loop script:
# powershell.exe -File dev-loop.ps1
```

### Phase 4: Config Bridge (~10 min)
```bash
# Set up ~/.claude/ symlinks to share config between Windows and WSL
# See Claude-Local-Config-And-Environment-Notes.md Section 9
# This step is only needed if you want shared sessions/skills across both environments
```

---

## What's NOT Required

| Thing | Why not |
|-------|---------|
| Docker | Not used anywhere in this stack |
| Python venv | Barkeep script runs with system Python |
| Electron | Tauri uses WebView2 instead |
| Database | Settings stored in JSON via tauri-plugin-store |
| Cloud services | Everything runs locally. Only external call is Anthropic API |
| Admin privileges | WSL install needs admin once. Everything else runs as normal user. Dev mode from admin PowerShell causes UIPI drag-drop issues — avoid. |
