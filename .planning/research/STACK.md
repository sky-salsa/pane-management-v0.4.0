# Technology Stack

**Project:** Workspace Resume
**Researched:** 2026-03-28
**Overall Confidence:** HIGH

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tauri | 2.10.x | Desktop app framework (Rust backend + system webview) | Constraint from PROJECT.md. Fast startup, low RAM (~30MB vs Electron's ~150MB+), small binary. v2 is stable since Oct 2024 with active maintenance (2.10.3 released March 2026). | HIGH |
| SolidJS | 1.9.x | Frontend UI framework | Best runtime performance of any JS framework (no VDOM, signal-based fine-grained reactivity). Smallest bundle size alongside Svelte. React-like JSX syntax lowers learning curve. Ideal for a dashboard app that needs to feel native-fast. Official Tauri template support via `create-tauri-app`. | HIGH |
| TypeScript | 5.x | Type safety | Non-negotiable for any project with IPC between Rust and JS. Catches contract drift between frontend and backend commands at compile time. | HIGH |
| Rust | 1.77.2+ | Backend (Tauri core) | Required by Tauri. Handles process spawning, file system access, Win32 API calls for external window management. Version floor set by Tauri plugin requirements. | HIGH |

### Build Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vite | 6.x (LTS) | Frontend bundler/dev server | Official Tauri recommendation. `vite-plugin-solid` explicitly supports Vite 3/4/5/6. Vite 7 and 8 exist but are very new (8 released March 12, 2026). Vite 6 still receives security patches and has the widest plugin ecosystem compatibility. Upgrade to 7+ after ecosystem catches up. | HIGH |
| vite-plugin-solid | 2.11.x | SolidJS Vite integration | Official SolidJS Vite plugin. Provides JSX transform, HMR, and SSR support. Actively maintained. | HIGH |

### Styling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tailwind CSS | 4.x | Utility-first CSS | v4 stable since Jan 2025. CSS-first config (no tailwind.config.js needed). Faster builds via Oxide engine. Perfect for a dashboard with cards and spatial layout -- utility classes map cleanly to free-arrange canvas positioning. | HIGH |

### Tauri Official Plugins

These are first-party plugins maintained in the `tauri-apps/plugins-workspace` monorepo. All follow Tauri's semver and are tested against each Tauri release.

| Plugin | Cargo Crate | npm Package | Purpose | Why | Confidence |
|--------|-------------|-------------|---------|-----|------------|
| **Shell** | `tauri-plugin-shell` ~2.3 | `@tauri-apps/plugin-shell` | Spawn terminal processes | Core requirement: launch Warp/WT/PowerShell with `claude -r`. Provides `Command.create()` with allowlist-based security scoping. Supports stdout/stderr streaming and process lifecycle (spawn/kill). | HIGH |
| **File System** | `tauri-plugin-fs` ~2.x | `@tauri-apps/plugin-fs` | Read Claude Code session files | Core requirement: read JSONL session files from `~/.claude/projects/`. Scope to `$HOME/.claude/**/*` for read access. Tauri's permission model prevents accidental full-disk access. | HIGH |
| **Store** | `tauri-plugin-store` ~2.4 | `@tauri-apps/plugin-store` | Persistent app state (card positions, project pins, settings) | Key-value JSON store with auto-save (100ms debounce). Survives crashes because writes are debounced and atomic. `LazyStore` defers loading until first access for faster startup. | HIGH |
| **Window State** | `tauri-plugin-window-state` ~2.4 | `@tauri-apps/plugin-window-state` | Remember main dashboard window position/size | Automatically saves/restores the dashboard window itself across restarts. Note: this is for the Tauri app's OWN windows, not for spawned terminal windows. | HIGH |
| **Autostart** | `tauri-plugin-autostart` ~2.x | `@tauri-apps/plugin-autostart` | Optional: launch on Windows startup | Nice-to-have for a dashboard app. Uses Windows registry for startup entry. Defer to post-MVP. | MEDIUM |

### Windows-Specific Dependencies (Rust Side)

| Crate | Version | Purpose | Why | Confidence |
|-------|---------|---------|-----|------------|
| `windows` | 0.62.x | Win32 API bindings | Microsoft's official Rust bindings for Windows APIs. Required for tracking/positioning EXTERNAL terminal windows (spawned Warp/WT instances). Key APIs: `FindWindowW`, `EnumWindows`, `GetWindowRect`, `SetWindowPos`, `MonitorFromWindow`, `GetMonitorInfoW`. Cannot be done through Tauri's own window APIs since those only manage Tauri-owned webview windows. | HIGH |
| `serde` | 1.x | Serialization | Foundation for all data interchange: JSONL parsing, IPC between Rust/JS, store data. | HIGH |
| `serde_json` | 1.x | JSON parsing | Parse Claude Code session JSONL files and general JSON handling. | HIGH |
| `serde-jsonlines` | 0.7.x | JSONL streaming | Purpose-built for JSON Lines format. Provides `BufReadExt` for streaming line-by-line parsing of session files without loading entire files into memory. Async support available via feature flag. | HIGH |
| `tokio` | 1.x | Async runtime | Tauri 2 uses tokio internally. Needed for async file watching, periodic position polling, and non-blocking IPC commands. | HIGH |
| `notify` | 6.x | File system watcher | Watch `~/.claude/projects/` for new session files. Triggers auto-discovery without polling. Cross-platform but we only need Windows support. | MEDIUM |
| `glob` | 0.3.x | Path pattern matching | Enumerate session directories matching the Claude Code naming convention (`C--Users-USERNAME-...`). | HIGH |

### Frontend Libraries

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| `@neodrag/solid` | 2.3.x | Free-position dragging for project cards | Lightweight directive-based dragging. Provides `position` prop for controlled dragging with absolute positioning. Supports bounds constraints and grid snapping. Better fit than `@dnd-kit/solid` for free-arrange canvas (dnd-kit is optimized for sortable lists, not free positioning). | HIGH |
| `@tauri-apps/api` | 2.x | Tauri IPC bridge | Core Tauri JavaScript API for invoking Rust commands, listening to events, and managing windows. Installed automatically with Tauri setup. | HIGH |

## Why SolidJS Over Alternatives

| Criterion | SolidJS | React | Svelte |
|-----------|---------|-------|--------|
| **Runtime perf** | Best-in-class (no VDOM, signals) | Good but VDOM overhead | Very good (compiled) |
| **Bundle size** | ~7KB | ~40KB (React+ReactDOM) | ~5KB |
| **DX familiarity** | JSX (React-like) | JSX (most popular) | Custom syntax |
| **Tauri template** | Official support | Official support | Official support |
| **Drag-drop libs** | @neodrag/solid, @dnd-kit/solid | Massive ecosystem | @neodrag/svelte |
| **Learning curve** | Low if you know React | Baseline | Moderate (new paradigm) |
| **Ecosystem size** | Small but growing | Massive | Medium |

**Verdict:** SolidJS wins on performance and bundle size, which matters for a utility app that should feel instant. The smaller ecosystem is acceptable because this app has a narrow UI surface (cards on a canvas, not a complex form-heavy app). React's ecosystem advantage is irrelevant here -- we need one drag library, one UI layer, and Tauri IPC. SolidJS delivers all three with less overhead.

**Risk:** SolidJS 2.0 is in development. Solid 1.9.x is stable and production-ready. The 1.x to 2.x migration path is being designed to be incremental. Low risk for this project's scope.

## Why NOT These Alternatives

| Category | Rejected | Why Not |
|----------|----------|---------|
| Framework | Electron | 5-10x more RAM, larger binary, slower startup. Tauri is a hard constraint anyway. |
| Framework | React | VDOM overhead is unnecessary for a small dashboard. Larger bundle. SolidJS provides the same JSX DX with better perf. |
| Framework | Svelte | Good option but custom syntax adds learning curve. SolidJS's JSX is more transferable knowledge. Svelte 5's runes are a paradigm shift that's still stabilizing. |
| Framework | Angular | Overkill. Massive framework for a single-screen dashboard. |
| Build tool | Vite 8 | Released March 12, 2026 (2 weeks ago). Rolldown integration is exciting but too new. Plugin ecosystem hasn't caught up. `vite-plugin-solid` peer deps list up to Vite 6. Use Vite 6 now, upgrade later when ecosystem stabilizes. |
| Build tool | Webpack | Slower, more configuration. Vite is the standard for Tauri projects. |
| Styling | CSS Modules | Fine but verbose for utility layouts. Tailwind's utility classes are faster to iterate on for spatial positioning. |
| Styling | styled-components | Runtime CSS-in-JS has performance cost. No SolidJS port. |
| Drag library | @dnd-kit/solid | Designed for sortable lists and drop zones, not free-position canvas layout. @neodrag is purpose-built for absolute positioning with coordinate tracking. |
| Drag library | solid-dnd | Focused on drag-and-drop between containers (sortable). Not ideal for free canvas positioning. |
| State | SQLite / sql.js | Overkill for key-value settings. The Store plugin covers our needs (card positions, pinned projects, display names). |
| State | IndexedDB | Not available in Tauri's webview in the same way as browsers. Store plugin is the blessed path. |
| Win32 | `winapi` crate | Older, unmaintained alternative to the `windows` crate. Microsoft's `windows` crate is the official successor with generated bindings directly from Windows metadata. |

## Claude Code Session File Format

Understanding this is critical for the Rust backend implementation.

**Location:** `~/.claude/projects/<encoded-path>/*.jsonl`

**Path encoding:** Absolute project path with non-alphanumeric chars replaced by `-`.
- `C:\Users\USERNAME\Documents\project` becomes `C--Users-USERNAME-Documents-project`

**File format:** JSONL (one JSON object per line). Each line has:
- `type` field (message type: user, assistant, system)
- `sessionId` (groups messages into sessions)
- `timestamp` (ISO 8601)
- `uuid` / `parentUuid` (linked list chain)
- `content` (array of blocks for assistant messages)

**Key behaviors:**
- Each message is written to disk immediately (crash-resilient by design)
- Compaction creates `compact_boundary` records when context window fills up
- Session continuation files may reference parent sessions

**What we need to extract:**
1. List of project directories (enumerate subdirectories of `~/.claude/projects/`)
2. List of sessions per project (group JSONL records by `sessionId`)
3. Most recent session (sort by `timestamp`)
4. Last user message preview (find last record with `type: "human"` or user message type)
5. Session timestamps for the session picker

## Terminal Launcher Architecture

The shell plugin handles process spawning, but terminal positioning requires Win32 APIs because Tauri can only position its own webview windows.

**Warp on Windows:**
- Executable: `%LOCALAPPDATA%\Programs\Warp\warp.exe` or `%PROGRAMFILES%\Warp\warp.exe`
- No documented CLI args for directory or command execution (as of March 2026)
- Workaround: Use Launch Configurations (YAML files with `cwd` and initial commands)
- Alternative: Spawn via shell command: `warp.exe` then send keystrokes/use Warp's URL scheme

**Windows Terminal (fallback):**
- Executable: `wt.exe` (on PATH by default on Windows 11)
- CLI args: `wt.exe -d "C:\path\to\project" cmd /k "claude -r"`
- Much better CLI support than Warp for programmatic launching

**PowerShell (universal fallback):**
- `powershell.exe -NoExit -Command "cd 'C:\path'; claude -r"`

**Terminal abstraction layer:** The Rust backend should define a `TerminalLauncher` trait with implementations for each terminal. Configuration stores which launcher to use. Start with Windows Terminal as the most reliable option, with Warp support added when its CLI matures.

## External Window Position Tracking

This is the hardest technical challenge and requires direct Win32 API usage.

**Approach:**
1. Spawn terminal process via `tauri-plugin-shell`
2. After spawn, use Win32 `EnumWindows` + `GetWindowThreadProcessId` to find the window handle (HWND) belonging to the spawned process
3. Use `SetWindowPos` to move the window to its saved position
4. Poll `GetWindowRect` on a timer (every 2-5 seconds) to detect user-moved windows
5. Persist updated positions to the Store plugin
6. On crash recovery, re-enumerate windows by process name/title and re-associate

**Key Win32 APIs (from `windows` crate):**
```rust
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, FindWindowW, GetWindowRect, SetWindowPos,
    GetWindowThreadProcessId, IsWindowVisible,
};
use windows::Win32::Graphics::Gdi::{
    MonitorFromWindow, GetMonitorInfoW, MONITOR_DEFAULTTONEAREST,
};
```

**Multi-monitor handling:**
- Use `MonitorFromWindow` to determine which monitor a window is on
- Store position as (monitor_id, x, y, width, height) not just absolute coordinates
- On monitor config change, validate stored positions and fall back to primary monitor if the target monitor is gone

## Installation

```bash
# Create project
npm create tauri-app@latest workspace-resume -- --template solid-ts

# Frontend dependencies
cd workspace-resume
npm install @neodrag/solid
npm install -D tailwindcss @tailwindcss/vite

# Tauri plugins (run from project root)
npm run tauri add shell
npm run tauri add fs
npm run tauri add store
npm run tauri add window-state

# Additional Rust dependencies (add to src-tauri/Cargo.toml)
# windows = { version = "0.62", features = [
#   "Win32_UI_WindowsAndMessaging",
#   "Win32_Graphics_Gdi",
#   "Win32_System_Threading",
#   "Win32_Foundation",
# ]}
# serde-jsonlines = "0.7"
# notify = "6"
# glob = "0.3"
```

## Project Structure

```
workspace-resume/
  src/                          # SolidJS frontend
    App.tsx                     # Root component
    components/
      Dashboard.tsx             # Free-arrange canvas
      ProjectCard.tsx           # Draggable project card
      SessionPicker.tsx         # Session list modal
    lib/
      tauri-commands.ts         # Typed IPC wrappers
      store.ts                  # LazyStore for app state
      types.ts                  # Shared TypeScript types
    index.tsx
    index.css                   # Tailwind imports
  src-tauri/                    # Rust backend
    src/
      lib.rs                    # Tauri setup + plugin registration
      commands/
        sessions.rs             # Session discovery + JSONL parsing
        launcher.rs             # Terminal spawning
        windows.rs              # Win32 window position tracking
      models/
        session.rs              # Session/project data types
        position.rs             # Window position types
      terminal/
        mod.rs                  # TerminalLauncher trait
        warp.rs                 # Warp implementation
        windows_terminal.rs     # Windows Terminal implementation
    Cargo.toml
    tauri.conf.json
    capabilities/
      default.json              # Permission scopes
  package.json
  vite.config.ts
  tsconfig.json
```

## Permission Configuration

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "description": "Workspace Resume permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "shell:allow-spawn",
    "fs:allow-read",
    "fs:allow-exists",
    "fs:allow-stat",
    "fs:allow-read-dir",
    "store:default",
    "window-state:default",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$HOME/.claude/**/*" },
        { "path": "$HOME/.claude" }
      ]
    },
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "wt",
          "cmd": "wt",
          "args": true
        },
        {
          "name": "warp",
          "cmd": "warp",
          "args": true
        },
        {
          "name": "powershell",
          "cmd": "powershell",
          "args": true
        }
      ]
    }
  ]
}
```

## Sources

- [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/) - HIGH confidence
- [Tauri GitHub Releases (v2.10.3)](https://github.com/tauri-apps/tauri/releases) - HIGH confidence
- [Tauri Shell Plugin](https://v2.tauri.app/plugin/shell/) - HIGH confidence
- [Tauri File System Plugin](https://v2.tauri.app/plugin/file-system/) - HIGH confidence
- [Tauri Store Plugin](https://v2.tauri.app/plugin/store/) - HIGH confidence
- [Tauri Window State Plugin](https://v2.tauri.app/plugin/window-state/) - HIGH confidence
- [Tauri Autostart Plugin](https://v2.tauri.app/plugin/autostart/) - HIGH confidence
- [Tauri System Tray](https://v2.tauri.app/learn/system-tray/) - HIGH confidence
- [Tauri Create Project (official templates)](https://v2.tauri.app/start/create-project/) - HIGH confidence
- [Tauri Vite Configuration](https://v2.tauri.app/start/frontend/vite/) - HIGH confidence
- [Tauri Permissions](https://v2.tauri.app/security/permissions/) - HIGH confidence
- [SolidJS (v1.9.12)](https://github.com/solidjs/solid/releases) - HIGH confidence
- [vite-plugin-solid](https://github.com/solidjs/vite-plugin-solid) - HIGH confidence
- [Vite Releases](https://vite.dev/releases) - HIGH confidence
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) - HIGH confidence
- [Microsoft windows-rs crate (v0.62.x)](https://github.com/microsoft/windows-rs) - HIGH confidence
- [serde-jsonlines crate](https://crates.io/crates/serde-jsonlines) - HIGH confidence
- [@neodrag/solid](https://www.neodrag.dev/docs/solid) - HIGH confidence
- [Claude Code Local Storage Design](https://milvus.io/blog/why-claude-code-feels-so-stable-a-developers-deep-dive-into-its-local-storage-design.md) - MEDIUM confidence
- [Claude Code Session Continuation](https://blog.fsck.com/releases/2026/02/22/claude-code-session-continuation/) - MEDIUM confidence
- [claudecodeui reference project](https://github.com/siteboon/claudecodeui) - MEDIUM confidence
- [Warp Terminal Windows docs](https://docs.warp.dev/terminal/sessions/launch-configurations) - MEDIUM confidence
- [CrabNebula: Best UI Libraries for Tauri](https://crabnebula.dev/blog/the-best-ui-libraries-for-cross-platform-apps-with-tauri/) - MEDIUM confidence
- [Win32 SetWindowPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos) - HIGH confidence
