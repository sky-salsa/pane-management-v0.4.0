# Architecture Patterns

**Domain:** Desktop session launcher with external window management
**Researched:** 2026-03-28

## Recommended Architecture

Three-layer architecture with a clear boundary between Tauri-managed UI and Win32-managed external windows.

```
+--------------------------------------------------+
|  SolidJS Frontend (WebView2)                      |
|  - Dashboard canvas with draggable project cards  |
|  - Session picker modal                           |
|  - Settings panel                                 |
|  +-- Tauri IPC (invoke/listen) --+                |
+--|-------------------------------|----------------+
   |                               |
+--v-------------------------------v----------------+
|  Rust Backend (Tauri Core)                        |
|                                                   |
|  Commands Layer          Event Layer              |
|  - list_projects()       - session-discovered     |
|  - list_sessions()       - position-updated       |
|  - launch_session()      - terminal-closed        |
|  - save_card_layout()    - monitor-changed        |
|                                                   |
|  +-- Services --+                                 |
|  |              |                                 |
|  v              v                                 |
|  Session        Terminal         Window           |
|  Discovery      Launcher         Tracker          |
|  Service        Service          Service          |
|  (fs plugin)    (shell plugin)   (Win32 APIs)     |
|                                                   |
|  +-- Data Layer --+                               |
|  |                |                               |
|  v                v                               |
|  Claude JSONL     Store Plugin                    |
|  (~/.claude/)     (app state)                     |
+---------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Dashboard (frontend)** | Render project cards on free-arrange canvas, handle drag interactions, dispatch IPC commands | Rust backend via `invoke()` |
| **Session Picker (frontend)** | Display session list with timestamps and previews | Rust backend via `invoke()` |
| **Commands Layer (Rust)** | Typed IPC handlers that validate input and delegate to services | Frontend (IPC), all services |
| **Session Discovery Service** | Read `~/.claude/projects/`, parse JSONL files, extract session metadata | `tauri-plugin-fs`, `serde-jsonlines` |
| **Terminal Launcher Service** | Spawn terminal processes with correct working directory and resume command | `tauri-plugin-shell`, terminal implementations |
| **Window Tracker Service** | Track positions of spawned terminal windows, persist positions, restore on relaunch | `windows` crate (Win32), `tauri-plugin-store` |
| **Store (data)** | Persist card layout, project pins, display names, window positions, terminal preference | `tauri-plugin-store` (JSON file) |

### Data Flow

**Session Discovery (on app start + file watch):**
1. Enumerate directories in `~/.claude/projects/`
2. For each directory, decode path to get original project path
3. Read JSONL files, extract session metadata (sessionId, timestamps, last user message)
4. Group by sessionId, sort by most recent timestamp
5. Emit `session-discovered` events to frontend
6. Frontend merges with stored card layout (positions, pins, display names)

**Launch Session:**
1. User clicks "Resume" on a project card
2. Frontend invokes `launch_session(project_path, session_id)`
3. Rust backend determines terminal type from config
4. Shell plugin spawns terminal process with correct cwd and `claude -r` command
5. Window Tracker begins polling for the new window handle (HWND)
6. Once found, restore saved position via `SetWindowPos`
7. Begin periodic position tracking (poll `GetWindowRect` every 2-5 seconds)
8. Persist position changes to Store plugin

**Position Persistence (crash-resilient):**
1. Window Tracker polls `GetWindowRect` every 2-5 seconds for all tracked windows
2. On position change, debounce (500ms) then write to Store
3. Store plugin auto-saves to disk (100ms debounce built-in)
4. Result: position data survives even hard crashes (at most ~3 seconds stale)

## Patterns to Follow

### Pattern 1: Typed IPC Commands

Every Rust command exposed to the frontend should have a corresponding TypeScript type definition. Use `#[tauri::command]` with strongly-typed parameters and return types.

**What:** Define command signatures in Rust with serde-serializable types. Mirror those types in TypeScript.
**When:** Every IPC boundary crossing.
**Example:**

```rust
// Rust side
#[derive(Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub timestamp: String,
    pub last_message_preview: Option<String>,
}

#[tauri::command]
async fn list_sessions(project_path: String) -> Result<Vec<SessionInfo>, String> {
    // ...
}
```

```typescript
// TypeScript side
interface SessionInfo {
  session_id: string;
  timestamp: string;
  last_message_preview: string | null;
}

async function listSessions(projectPath: string): Promise<SessionInfo[]> {
  return invoke('list_sessions', { projectPath });
}
```

### Pattern 2: Terminal Launcher Trait

Abstract terminal implementations behind a trait so swapping terminals is a config change, not a code change.

**What:** Define a `TerminalLauncher` trait in Rust. Each terminal (Windows Terminal, Warp, PowerShell) implements it.
**When:** Any terminal spawning operation.
**Example:**

```rust
#[async_trait]
pub trait TerminalLauncher: Send + Sync {
    /// Spawn a terminal window at the given directory, running the given command
    async fn launch(
        &self,
        working_dir: &Path,
        command: &str,
        shell: &ShellHandle,
    ) -> Result<TerminalProcess, LaunchError>;

    /// Display name for settings UI
    fn name(&self) -> &str;

    /// Check if this terminal is available on the system
    fn is_available(&self) -> bool;
}
```

### Pattern 3: Event-Driven Frontend Updates

Use Tauri's event system for backend-to-frontend communication rather than polling from the frontend.

**What:** Rust backend emits events when state changes. Frontend listens and updates reactively.
**When:** Session discovery, window position changes, terminal lifecycle events.

### Pattern 4: Debounced Persistence

All writes to the Store plugin should be debounced to avoid disk thrashing.

**What:** Position updates, card layout changes, and settings modifications go through a debounce layer before hitting the Store.
**When:** Any high-frequency state change (window position polling, card dragging).

## Anti-Patterns to Avoid

### Anti-Pattern 1: Frontend File Access

**What:** Reading Claude Code session files directly from the SolidJS frontend via the fs plugin's JavaScript API.
**Why bad:** JSONL parsing is CPU-intensive for large session files. Blocks the UI thread. Also exposes file system details to the frontend layer unnecessarily.
**Instead:** All file reading happens in Rust commands. Frontend receives pre-parsed, typed data via IPC.

### Anti-Pattern 2: On-Close-Only Persistence

**What:** Saving window positions only when the app closes gracefully.
**Why bad:** Hard crashes, force-quit, and power loss lose all position data since last save. This directly violates PROJECT.md requirement for crash-resilient position tracking.
**Instead:** Poll-and-persist pattern with debounced writes. 2-5 second polling interval means at most 5 seconds of data loss on crash.

### Anti-Pattern 3: Absolute Screen Coordinates Without Monitor Context

**What:** Storing window positions as raw (x, y) screen coordinates.
**Why bad:** Multi-monitor setups change. A secondary monitor gets disconnected. Coordinates that were (2560, 400) on the second monitor are now off-screen.
**Instead:** Store as (monitor_identifier, relative_x, relative_y, width, height). On restore, validate the monitor still exists. Fall back to primary monitor center if it doesn't.

### Anti-Pattern 4: Tight Coupling to Warp

**What:** Hard-coding Warp-specific launch logic throughout the codebase.
**Why bad:** Warp's Windows CLI support is immature (no documented CLI args for directory/command as of March 2026). User may want to switch terminals. PROJECT.md explicitly requires terminal abstraction.
**Instead:** Terminal Launcher trait pattern. Start with Windows Terminal (better CLI support), add Warp when its CLI matures.

## Scalability Considerations

This is a local single-user desktop app. "Scalability" means handling growing numbers of projects and sessions, not concurrent users.

| Concern | At 5 projects | At 50 projects | At 200+ projects |
|---------|---------------|----------------|------------------|
| **Session discovery** | Scan all JSONL files on startup (<1s) | Lazy load -- scan directories first, parse JSONL on demand | Index + incremental scan via file watcher |
| **Dashboard rendering** | All cards visible | Scrolling or search needed | Virtual scrolling, search/filter required |
| **JSONL file size** | Read entire file | Stream with serde-jsonlines (already planned) | Stream + cache parsed metadata |
| **Window tracking** | Poll 5 HWNDs trivially | Poll 50 HWNDs (~negligible CPU) | Batch Win32 calls, increase poll interval |
| **Store file size** | <10KB JSON | <100KB JSON | Consider splitting into multiple store files |

## Sources

- [Tauri Architecture](https://v2.tauri.app/concept/architecture/) - HIGH confidence
- [Tauri State Management](https://v2.tauri.app/develop/state-management/) - HIGH confidence
- [Tauri Plugin Development](https://v2.tauri.app/develop/plugins/) - HIGH confidence
- [Claude Code Local Storage Design](https://milvus.io/blog/why-claude-code-feels-so-stable-a-developers-deep-dive-into-its-local-storage-design.md) - MEDIUM confidence
- [Win32 Window Management APIs](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos) - HIGH confidence
