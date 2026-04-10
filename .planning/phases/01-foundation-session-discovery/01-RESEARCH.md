# Phase 1: Foundation + Session Discovery - Research

**Researched:** 2026-03-28
**Domain:** Tauri app scaffolding, Claude Code session file parsing, file system watching (Windows)
**Confidence:** HIGH

## Summary

Phase 1 scaffolds the Tauri desktop app and builds the core session/project discovery engine. The critical research question was the exact structure of Claude Code's local session files -- this has been answered through direct inspection of the user's own `~/.claude/projects/` directory (47 projects, 398 sessions, 228 MB total data).

The session JSONL format is well-understood but undocumented. Records have a `type` field with values including `user`, `assistant`, `system`, `progress`, `file-history-snapshot`, `queue-operation`, and `last-prompt`. The `last-prompt` record is a shortcut (present in ~52% of sessions) containing the last human input. For the remaining 48%, the parser must scan backward for the last non-meta user message with string content (not tool results or command outputs).

File watching should use the `notify` crate directly in Rust (not the FS plugin's JS-facing watch API), consistent with the architecture pattern of keeping all file I/O in the Rust backend. Rust is NOT currently installed on this machine -- that must be addressed as the first setup step.

**Primary recommendation:** Use a reverse-read strategy for JSONL files (seek to end, read backward) to extract timestamps and last user message without loading multi-MB files into memory. Use `notify` 6.x in Rust for file watching. Scaffold with `npm create tauri-app@latest` using the solid-ts template.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **File watcher is preferred** for detecting new sessions/projects. Polling is an acceptable fallback. Manual-only refresh is unacceptable.
- **Light background monitoring**: File watcher runs always, but UI only refreshes when the dashboard is visible. Zero wasted rendering when minimized.
- **Session metadata refresh**: Claude's discretion -- pick whatever balances freshness vs I/O for the parsing approach chosen.
- **Missing folders prompt the user**: When a discovered project's directory no longer exists on disk, show a notification asking the user to remove or re-link the project. Don't silently hide it, don't leave it broken.
- **Corrupted sessions shown with warning**: If a session file is unreadable or corrupted, still show the session entry but mark it with a visual warning indicator. Don't silently skip it.
- **Dev-only view**: Phase 1 builds a raw data dump / debug panel to verify the discovery pipeline works. This UI is throwaway -- it gets replaced by the real dashboard in Phase 3.
- **App chrome**: Claude's discretion. Use whatever makes sense -- default Tauri chrome is fine.
- **Requirements only**: Parse timestamps and the user's last input message from each session. Nothing more for Phase 1.
- **Caching strategy**: Claude's discretion. Pick whatever delivers good performance for 20+ projects and many sessions.

### Claude's Discretion
- Session metadata refresh strategy (balance freshness vs I/O)
- App chrome (default Tauri chrome is fine)
- Caching strategy for parsed session data

### Deferred Ideas (OUT OF SCOPE)
- Extract richer session metadata (model, token counts, duration) -- future enhancement
- Custom app chrome / branding -- Phase 3
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-01 | App auto-discovers all projects from local Claude Code session files (`~/.claude/projects/`) | JSONL format fully documented below; path encoding confirmed via direct inspection of 47 project directories |
| DISC-02 | App decodes encoded project paths to resolve actual directory locations | Path encoding scheme reverse-engineered: replace `-` with path separators using pattern matching (double-dash = drive colon, single-dash = separator) |
| DISC-03 | App parses JSONL session files using stream-based reading (handles large files without loading into memory) | `rev_lines` crate for reverse reading; `last-prompt` record shortcut covers 52% of files; tail-read strategy documented |
| DISC-04 | App detects new sessions and projects without requiring restart | `notify` 6.x crate for file watching from Rust backend; FS plugin watch feature as JS-side alternative |
| PERF-01 | App starts in under 2 seconds | Tauri baseline ~30MB RAM, sub-second webview init; lazy session parsing defers I/O; `LazyStore` defers config load |
| PERF-02 | App uses minimal RAM when idle/background | File watcher + debounced events; no frontend re-renders when minimized; stream parsing avoids loading full JSONL into memory |
</phase_requirements>

## Standard Stack

### Core (Phase 1 Subset)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri | 2.10.x | Desktop app framework | Project constraint. Fast startup, low RAM. |
| SolidJS | 1.9.x | Frontend UI | Best runtime perf, smallest bundle, JSX DX. |
| TypeScript | 5.x | Type safety | Required for IPC contract safety. |
| Rust | stable (1.77.2+) | Backend | Required by Tauri. **NOT CURRENTLY INSTALLED -- must install first.** |
| Vite | 6.x | Bundler/dev server | Official Tauri recommendation. Widest plugin compat. |
| vite-plugin-solid | 2.11.x | SolidJS integration | Official SolidJS Vite plugin. |

### Supporting (Phase 1 Only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tauri-plugin-fs` | ~2.x (with `watch` feature) | Read session files + FS permissions | Core requirement: scoped read access to `~/.claude/` |
| `tauri-plugin-store` | ~2.4 | Persistent app state | Cache parsed session metadata, project list |
| `notify` | 6.x | File system watcher (Rust) | Watch `~/.claude/projects/` for new sessions/projects |
| `serde` | 1.x | Serialization | All data interchange |
| `serde_json` | 1.x | JSON parsing | Parse JSONL lines |
| `rev_lines` | 0.3.x | Reverse file reading | Read last N lines of large JSONL files efficiently |
| `glob` | 0.3.x | Path pattern matching | Enumerate project directories |
| `tokio` | 1.x | Async runtime | Already used by Tauri internally; needed for async commands |
| `@tauri-apps/api` | 2.x | IPC bridge (JS side) | Invoke Rust commands from frontend |

### Not Needed in Phase 1

| Library | Phase | Why Deferred |
|---------|-------|-------------|
| `@neodrag/solid` | Phase 3 | No draggable cards in Phase 1 |
| `tauri-plugin-shell` | Phase 2 | No terminal spawning in Phase 1 |
| `tauri-plugin-window-state` | Phase 2+ | No window position tracking yet |
| `windows` crate | Phase 4 | No Win32 window management yet |
| Tailwind CSS | Phase 1 (optional) | Dev-only UI is throwaway; plain CSS is fine. Install if convenient but don't invest in styling. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `notify` crate (Rust) | `tauri-plugin-fs` watch feature (JS) | FS plugin watch is JS-facing only. Using it means file watching logic lives in the frontend, violating the architecture principle of backend-only file I/O. Use `notify` in Rust. |
| `rev_lines` | Manual `seek` + `BufReader` | `rev_lines` handles edge cases (multi-byte chars, partial lines at buffer boundaries). Small dependency, well-tested. |
| `serde_json::Value` | Strongly-typed structs | Use `Value` for initial parsing since schema is unstable. Deserialize only needed fields. Typed structs can come later once the format stabilizes in our understanding. |

**Installation:**
```bash
# Step 0: Install Rust (NOT currently installed!)
# Download from https://rustup.rs/ -- use default stable toolchain
# On Windows: rustup-init.exe from https://win.rustup.rs/

# Step 1: Create project
npm create tauri-app@latest workspace-resume -- --template solid-ts

# Step 2: Frontend dependencies
cd workspace-resume
# Tailwind optional for Phase 1, include for convenience
npm install -D tailwindcss @tailwindcss/vite

# Step 3: Tauri plugins
npm run tauri add fs
npm run tauri add store

# Step 4: Add Rust dependencies to src-tauri/Cargo.toml
# [dependencies]
# notify = "6"
# rev_lines = "0.3"
# glob = "0.3"
# (serde, serde_json, tokio already included by Tauri)

# Step 5: Enable watch feature for fs plugin in Cargo.toml
# tauri-plugin-fs = { version = "2", features = ["watch"] }
```

## Architecture Patterns

### Phase 1 Project Structure

```
workspace-resume/
  src/                          # SolidJS frontend
    App.tsx                     # Root component
    components/
      DevPanel.tsx              # Throwaway debug view (Phase 1 only)
    lib/
      tauri-commands.ts         # Typed IPC wrappers
      types.ts                  # Shared TypeScript types
    index.tsx
    index.css
  src-tauri/                    # Rust backend
    src/
      lib.rs                    # Tauri setup + plugin registration
      commands/
        discovery.rs            # list_projects, list_sessions commands
      services/
        scanner.rs              # Session file scanner (enumerate + parse)
        watcher.rs              # File watcher (notify crate)
        path_decoder.rs         # Decode encoded project paths
      models/
        project.rs              # Project data types
        session.rs              # Session metadata types
    Cargo.toml
    tauri.conf.json
    capabilities/
      default.json              # Permission scopes
  package.json
  vite.config.ts
  tsconfig.json
```

### Pattern 1: Reverse-Read JSONL Parsing

**What:** Read JSONL files from the end to extract the last user message and timestamps without scanning the entire file.

**When to use:** Every session file read. Critical for files > 1 MB.

**Strategy:**
1. Check for `last-prompt` record in the last 5 KB of the file (covers 52% of sessions).
2. If not found, use `rev_lines` to iterate backward, looking for the last `type: "user"` record that is NOT `isMeta: true` and has string content (not an array/tool result).
3. Extract `sessionId` and first `timestamp` from the first few lines (read forward, first 3 lines).
4. Cache the result keyed by (file_path, file_mtime, file_size).

**Example (Rust pseudocode):**
```rust
use rev_lines::RevLines;
use std::fs::File;
use std::io::BufReader;

fn extract_last_user_message(path: &Path) -> Option<String> {
    let file = File::open(path).ok()?;
    let reader = BufReader::new(file);
    let rev_lines = RevLines::new(reader);

    for line in rev_lines {
        let line = line.ok()?;
        // Try fast path: last-prompt record
        if line.contains("\"last-prompt\"") {
            let val: serde_json::Value = serde_json::from_str(&line).ok()?;
            return val.get("lastPrompt")?.as_str().map(|s| s.to_string());
        }
        // Slow path: find last real user message
        if line.contains("\"type\":\"user\"") && !line.contains("\"isMeta\":true") {
            let val: serde_json::Value = serde_json::from_str(&line).ok()?;
            if val.get("type")?.as_str()? == "user" {
                let content = val.pointer("/message/content")?;
                if let Some(s) = content.as_str() {
                    // Skip tool results (arrays), command tags, stdout
                    if !s.starts_with("[{")
                       && !s.starts_with("<command-")
                       && !s.starts_with("<local-command") {
                        return Some(s.chars().take(200).collect());
                    }
                }
            }
        }
    }
    None
}
```

### Pattern 2: Path Decoding

**What:** Decode Claude Code's encoded project directory names back to actual filesystem paths.

**Observed encoding (verified on this machine):**
- `C--Users-USERNAME-Documents-MAIN-AI-Workspace` = `C:\Users\USERNAME\Documents\MAIN\AI Workspace`
- Double dash (`--`) after drive letter = `:\`
- Single dash (`-`) = path separator `\` (on Windows)
- Spaces in path components become `-` (same as separators)

**Problem:** The encoding is lossy -- `AI-Workspace` and `AI Workspace` both encode to `AI-Workspace`. You cannot reliably decode by string replacement alone.

**Solution:** Don't decode algorithmically. Instead:
1. Enumerate all directories in `~/.claude/projects/`
2. Read the `cwd` field from any JSONL record in that directory (every record has it)
3. Cache the mapping: encoded_name -> actual_path
4. The `cwd` field gives the exact, unambiguous original path

**Verified from real data:** Every JSONL record contains `"cwd":"C:\\Users\\USERNAME\\Documents\\MAIN\\AI Workspace\\Access Directory\\example-project"` -- this is the authoritative source for the project's actual path.

### Pattern 3: File Watcher Architecture

**What:** Use `notify` crate to watch `~/.claude/projects/` for new/modified files.

**Design:**
```rust
use notify::{Watcher, RecursiveMode, RecommendedWatcher, Event};
use tokio::sync::mpsc;

async fn start_watcher(
    app_handle: tauri::AppHandle,
) -> Result<RecommendedWatcher, notify::Error> {
    let (tx, mut rx) = mpsc::channel(100);

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = tx.blocking_send(event);
            }
        },
        notify::Config::default()
            .with_poll_interval(std::time::Duration::from_secs(5)),
    )?;

    let claude_projects = dirs::home_dir()
        .unwrap()
        .join(".claude")
        .join("projects");

    watcher.watch(&claude_projects, RecursiveMode::Recursive)?;

    // Process events in background
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            // Filter for .jsonl creates/modifies
            // Debounce, then emit Tauri event to frontend
            app_handle.emit("session-changed", &event.paths).ok();
        }
    });

    Ok(watcher)
}
```

**Key decisions:**
- Watch recursively (new project directories may appear)
- Debounce events (Claude writes lines rapidly during a session)
- Only re-parse the specific file that changed, not all files
- Emit Tauri events to frontend; frontend only processes if visible

### Pattern 4: Defensive JSONL Parsing

**What:** Never assume schema stability. Parse with `serde_json::Value` and extract fields by name.

**Rules:**
- Skip lines that fail `serde_json::from_str` (corrupted/truncated)
- Skip records with unknown `type` values (future format additions)
- Handle missing fields with `Option<T>` everywhere
- Set a per-file size limit: warn on files > 50 MB, skip parsing files > 100 MB
- Log parse errors but never crash

### Anti-Patterns to Avoid

- **Strongly-typed deserialization of full JSONL records:** The schema is undocumented and changes. Use `serde_json::Value` for the initial version and extract only the 4 fields we need (type, timestamp, sessionId, message.content).
- **Loading full JSONL into memory:** The largest file on this machine is 27 MB. Some users report 3.8 GB. Always stream.
- **Decoding paths from directory names algorithmically:** The encoding is lossy. Read the `cwd` field from JSONL records instead.
- **Frontend-initiated file reads:** All JSONL parsing happens in Rust. Frontend receives pre-parsed typed data via IPC.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reverse file reading | Manual seek + buffer management | `rev_lines` 0.3.x | Buffer boundary handling, multi-byte char safety |
| File watching | Polling loop with `fs::metadata` | `notify` 6.x | Uses OS-native events (ReadDirectoryChangesW on Windows), more efficient and responsive |
| JSONL line-by-line parsing | Custom line splitter | `BufRead::lines()` (stdlib) | Handles all line endings correctly |
| Path globbing | Manual directory traversal | `glob` 0.3.x | Pattern matching, error handling |
| Debouncing | Manual timer management | `notify::Config::with_poll_interval` or tokio debounce | Race condition prone |

## Claude Code Session File Format (Verified on This Machine)

### Directory Structure

```
~/.claude/
  projects/
    C--Users-USERNAME-Documents-MAIN-AI-Workspace-Access-Directory-example-project/
      0edd3b7e-0881-493a-b9ad-11c2dbfea4a7.jsonl     # Session file
      0edd3b7e-0881-493a-b9ad-11c2dbfea4a7/           # Session directory
        subagents/                                      # Subagent session files
          agent-acompact-23dbd1b25fdc36e0.jsonl
      7624d943-f693-4f40-b9c3-58d4f0f8af44.jsonl
      memory/                                           # Project memory (MEMORY.md)
```

### JSONL Record Types (Verified)

| Type | Count (sample) | Contains | Needed for Phase 1? |
|------|----------------|----------|---------------------|
| `user` | 292 | User messages, tool results, command outputs | YES - last human input |
| `assistant` | 323 | Assistant responses | NO |
| `system` | 21 | System messages (has `subtype`, `durationMs`) | NO |
| `progress` | 243 | Hook progress, tool progress | NO |
| `file-history-snapshot` | 777 | File backup metadata | NO |
| `queue-operation` | 28 | Queued user input (`operation: "enqueue"`, has `content`) | MAYBE - alternative source for user input |
| `last-prompt` | 2 | Last human input shortcut (`lastPrompt` field) | YES - fast path |

### Record Common Fields

Every record has:
- `type` (string) -- record type
- `timestamp` (ISO 8601 string) -- when written
- `sessionId` (UUID string) -- groups records into sessions
- `uuid` (UUID string) -- unique record ID
- `parentUuid` (UUID or null) -- linked list chain

Most records also have:
- `cwd` (string) -- the project's actual filesystem path (authoritative!)
- `version` (string) -- Claude Code version (e.g., "2.1.86")
- `userType` (string) -- usually "external"
- `isSidechain` (boolean)
- `gitBranch` (string)

### User Message Subtypes

Not all `type: "user"` records are human-typed input:

| Subtype | How to Identify | Human Input? |
|---------|----------------|--------------|
| Actual user input | `typeof content === "string"`, no XML tags, not `isMeta` | YES |
| Tool results | `content` starts with `[{` (array of tool_result objects) | NO |
| Command outputs | `content` contains `<local-command-stdout>` or `<command-name>` | NO |
| Meta messages | `isMeta: true` | NO |

**Filtering algorithm for "last user message":**
```
Find last record where:
  type === "user"
  AND isMeta !== true
  AND message.content is a string (not array)
  AND content does NOT start with "[{"
  AND content does NOT start with "<command-"
  AND content does NOT start with "<local-command"
```

### The `last-prompt` Shortcut

```json
{
  "type": "last-prompt",
  "lastPrompt": "so it's currently 12:30am",
  "sessionId": "0edd3b7e-0881-493a-b9ad-11c2dbfea4a7"
}
```

- Present in ~52% of session files (208/398 on this machine)
- Always near the end of the file (within last few KB)
- Contains the exact text the user last typed
- Use as fast path; fall back to reverse scanning if absent

### Real Numbers (This Machine)

| Metric | Value |
|--------|-------|
| Total project directories | 47 |
| Total JSONL session files | 398 |
| Total data size | 228 MB |
| Largest file | 27 MB |
| Average file size | 586 KB |
| Most sessions in one project | 203 |
| Typical lines per session | ~1,600 (3.8 MB file) |

## Common Pitfalls

### Pitfall 1: Lossy Path Encoding

**What goes wrong:** Attempting to decode project directory names back to filesystem paths using string replacement. The encoding replaces both path separators AND spaces with dashes, making it impossible to distinguish `AI Workspace` from `AI-Workspace`.

**Why it happens:** The encoding was designed for directory naming, not reversibility.

**How to avoid:** Read the `cwd` field from any JSONL record in the project directory. Every record has it. Cache the mapping on first discovery.

**Warning signs:** Decoded paths that don't exist on disk.

### Pitfall 2: Treating All "user" Records as Human Input

**What goes wrong:** Displaying tool results, command outputs, or meta messages as the "last user message." Results in previews like `[{"tool_use_id":"toolu_01EVQ7...` which are meaningless to the user.

**Why it happens:** Claude Code writes tool results and command outputs as `type: "user"` records. Only a subset are actual human-typed input.

**How to avoid:** Apply the filtering algorithm documented above. Check for `isMeta`, array content, and XML command tags.

**Warning signs:** Preview text starting with `[{`, `<command-`, or `<local-command`.

### Pitfall 3: Loading Full JSONL Files Into Memory

**What goes wrong:** `fs::read_to_string` on a 27 MB file (or 3.8 GB in extreme cases) causes RAM spikes and UI freezes.

**Why it happens:** The obvious approach is to read the whole file, split by lines, and parse.

**How to avoid:** Use reverse-read strategy with `rev_lines`. For metadata extraction, read only the first few lines (sessionId, first timestamp) and last few KB (last-prompt or last user message).

**Warning signs:** Memory usage > 100 MB during session scanning.

### Pitfall 4: Watcher Event Floods

**What goes wrong:** During an active Claude Code session, every message writes a new line to the JSONL file. The file watcher fires events for every write, potentially triggering hundreds of re-parses per minute.

**Why it happens:** `notify` fires events on every filesystem write.

**How to avoid:** Debounce watcher events aggressively (2-5 seconds). Only re-parse the specific file that changed. Cache previous parse results and invalidate only on (mtime, size) change.

**Warning signs:** High CPU during active Claude sessions.

### Pitfall 5: Missing Rust Toolchain

**What goes wrong:** `npm create tauri-app` or `cargo build` fails because Rust is not installed.

**Why it happens:** Rust is not currently installed on this machine.

**How to avoid:** Install Rust via `rustup-init.exe` from https://win.rustup.rs/ before any Tauri development. Also ensure Microsoft Visual Studio Build Tools (C++ workload) is installed, as Tauri requires it on Windows.

**Warning signs:** `rustc: command not found` or `cargo: command not found`.

## Code Examples

### IPC Command: List Projects

```rust
// src-tauri/src/commands/discovery.rs
use serde::Serialize;
use tauri::command;

#[derive(Serialize)]
pub struct ProjectInfo {
    pub encoded_name: String,
    pub actual_path: String,
    pub session_count: usize,
    pub path_exists: bool,
}

#[command]
pub async fn list_projects() -> Result<Vec<ProjectInfo>, String> {
    let projects_dir = dirs::home_dir()
        .ok_or("Cannot find home directory")?
        .join(".claude")
        .join("projects");

    let mut projects = Vec::new();

    for entry in std::fs::read_dir(&projects_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.path().is_dir() { continue; }

        let encoded_name = entry.file_name().to_string_lossy().to_string();

        // Count JSONL files (sessions)
        let session_count = std::fs::read_dir(entry.path())
            .map(|rd| rd.filter(|e| {
                e.as_ref().map(|e| {
                    e.path().extension().map(|ext| ext == "jsonl").unwrap_or(false)
                }).unwrap_or(false)
            }).count())
            .unwrap_or(0);

        // Get actual path from first JSONL record's cwd field
        let actual_path = extract_cwd_from_first_record(entry.path())
            .unwrap_or_else(|| decode_path_heuristic(&encoded_name));

        let path_exists = std::path::Path::new(&actual_path).exists();

        projects.push(ProjectInfo {
            encoded_name,
            actual_path,
            session_count,
            path_exists,
        });
    }

    Ok(projects)
}
```

### IPC Command: List Sessions for a Project

```rust
#[derive(Serialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub first_timestamp: Option<String>,
    pub last_timestamp: Option<String>,
    pub last_user_message: Option<String>,
    pub is_corrupted: bool,
    pub file_size_bytes: u64,
}

#[command]
pub async fn list_sessions(encoded_project: String) -> Result<Vec<SessionInfo>, String> {
    let project_dir = dirs::home_dir()
        .ok_or("Cannot find home directory")?
        .join(".claude")
        .join("projects")
        .join(&encoded_project);

    let mut sessions = Vec::new();

    for entry in std::fs::read_dir(&project_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.extension().map(|e| e == "jsonl").unwrap_or(false) {
            let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
            let session_id = path.file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            match parse_session_metadata(&path) {
                Ok(meta) => sessions.push(SessionInfo {
                    session_id,
                    first_timestamp: meta.first_timestamp,
                    last_timestamp: meta.last_timestamp,
                    last_user_message: meta.last_user_message,
                    is_corrupted: false,
                    file_size_bytes: metadata.len(),
                }),
                Err(_) => sessions.push(SessionInfo {
                    session_id,
                    first_timestamp: None,
                    last_timestamp: None,
                    last_user_message: None,
                    is_corrupted: true,
                    file_size_bytes: metadata.len(),
                }),
            }
        }
    }

    // Sort by last_timestamp descending (most recent first)
    sessions.sort_by(|a, b| b.last_timestamp.cmp(&a.last_timestamp));

    Ok(sessions)
}
```

### TypeScript IPC Wrappers

```typescript
// src/lib/tauri-commands.ts
import { invoke } from '@tauri-apps/api/core';

export interface ProjectInfo {
  encoded_name: string;
  actual_path: string;
  session_count: number;
  path_exists: boolean;
}

export interface SessionInfo {
  session_id: string;
  first_timestamp: string | null;
  last_timestamp: string | null;
  last_user_message: string | null;
  is_corrupted: boolean;
  file_size_bytes: number;
}

export async function listProjects(): Promise<ProjectInfo[]> {
  return invoke('list_projects');
}

export async function listSessions(encodedProject: string): Promise<SessionInfo[]> {
  return invoke('list_sessions', { encodedProject });
}
```

### Dev Panel Component (Throwaway)

```tsx
// src/components/DevPanel.tsx
import { createResource, For, Show } from 'solid-js';
import { listProjects, listSessions, type ProjectInfo } from '../lib/tauri-commands';

export function DevPanel() {
  const [projects] = createResource(listProjects);

  return (
    <div style={{ padding: '16px', font-family: 'monospace', font-size: '13px' }}>
      <h1>Session Discovery - Dev Panel</h1>
      <Show when={projects()} fallback={<p>Loading...</p>}>
        <p>{projects()!.length} projects discovered</p>
        <For each={projects()!}>
          {(project) => <ProjectRow project={project} />}
        </For>
      </Show>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sessions-index.json` for metadata | Direct JSONL parsing | Ongoing (index unreliable) | Index stops being updated in some Claude Code versions; direct parsing is the only reliable method |
| `tauri-plugin-fs-watch` (v1) | `tauri-plugin-fs` with `watch` feature (v2) | Tauri 2.0 (Oct 2024) | Watch functionality merged into main FS plugin |
| `serde-jsonlines` for streaming | `rev_lines` + `serde_json::Value` | N/A (our choice) | Reverse reading is more efficient when you only need the last record |

## Open Questions

1. **`last-prompt` reliability across Claude Code versions**
   - What we know: Present in 52% of session files on this machine. Contains exact user input text.
   - What's unclear: Is this a recent addition? Will it be present in all future sessions? Does it update on every user input or only on session end?
   - Recommendation: Use as fast path but always have fallback. Monitor coverage as Claude Code updates.

2. **Subagent session files**
   - What we know: Session directories contain a `subagents/` folder with files like `agent-acompact-23dbd1b25fdc36e0.jsonl`.
   - What's unclear: Should these be shown as separate sessions? Are they resumable via `claude -r`?
   - Recommendation: Ignore subagent files in Phase 1. They are implementation details of Claude's agent system, not user-initiated sessions.

3. **Session continuation across files**
   - What we know: Claude Code documentation mentions session continuation files referencing parent sessions.
   - What's unclear: How this manifests in the JSONL data. All observed records share one `sessionId` per file.
   - Recommendation: Treat each `.jsonl` file as one session for Phase 1. Revisit if users report split sessions.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust / Cargo | Tauri build | **NO** | -- | **MUST INSTALL** via rustup |
| Node.js | Frontend build | Yes | 24.13.1 | -- |
| npm | Package management | Yes | 11.10.0 | -- |
| Windows Terminal (wt.exe) | Phase 2 terminal launch | Yes | Available on PATH | -- |
| Warp | Phase 2 terminal launch | No | Not on PATH | Windows Terminal is primary |
| VS Build Tools | Rust compilation on Windows | Unknown | -- | Must verify; install if missing |

**Missing dependencies with no fallback:**
- **Rust toolchain**: Must be installed before any Tauri development. Install via `rustup-init.exe` from https://win.rustup.rs/
- **VS Build Tools (C++ workload)**: Required by Rust on Windows for linking. Verify with `where cl.exe` or check Visual Studio Installer.

**Missing dependencies with fallback:**
- None -- all other dependencies are available.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Rust built-in test (`#[cfg(test)]` + `cargo test`) for backend; Vitest for frontend (if needed) |
| Config file | None yet -- Wave 0 creates `src-tauri/src/` test modules |
| Quick run command | `cd src-tauri && cargo test` |
| Full suite command | `cd src-tauri && cargo test && cd .. && npm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-01 | Enumerate project directories from ~/.claude/projects/ | integration | `cargo test --test discovery_tests` | Wave 0 |
| DISC-02 | Resolve actual path from cwd field in JSONL | unit | `cargo test path_decoder::tests` | Wave 0 |
| DISC-03 | Parse JSONL with reverse-read, handle large files | unit | `cargo test scanner::tests` | Wave 0 |
| DISC-04 | File watcher detects new .jsonl files | integration | `cargo test watcher::tests` | Wave 0 |
| PERF-01 | App starts in under 2 seconds | manual | Time `cargo tauri dev` cold start | Manual |
| PERF-02 | Minimal RAM when idle | manual | Check Task Manager after 60s idle | Manual |

### Sampling Rate

- **Per task commit:** `cd src-tauri && cargo test`
- **Per wave merge:** `cd src-tauri && cargo test && cd .. && npm run build`
- **Phase gate:** Full suite green + manual performance check before verify

### Wave 0 Gaps

- [ ] `src-tauri/tests/discovery_tests.rs` -- integration tests with test fixture JSONL files
- [ ] `src-tauri/src/services/scanner.rs` -- unit tests for JSONL parsing
- [ ] `src-tauri/src/services/path_decoder.rs` -- unit tests for cwd extraction
- [ ] `src-tauri/tests/fixtures/` -- sample JSONL files (small, corrupted, empty, large-ish)
- [ ] Rust toolchain installation -- prerequisite for any test execution

## Sources

### Primary (HIGH confidence)
- Direct inspection of `~/.claude/projects/` on this machine -- 47 projects, 398 sessions, verified JSONL format
- [Tauri File System Plugin docs](https://v2.tauri.app/plugin/file-system/) -- watch feature, permissions
- [Tauri Store Plugin docs](https://v2.tauri.app/plugin/store/) -- LazyStore, debounced writes
- [Tauri Create Project (templates)](https://v2.tauri.app/start/create-project/) -- solid-ts template

### Secondary (MEDIUM confidence)
- [rev_lines crate](https://lib.rs/crates/rev_lines) -- v0.3.0, reverse file reading
- [notify crate](https://docs.rs/notify) -- v6.x, file system watcher
- [tauri-plugin-fs-watch repo](https://github.com/tauri-apps/tauri-plugin-fs-watch) -- confirmed v1 only, watch merged into FS plugin for v2
- [Claude Code session format blog](https://databunny.medium.com/inside-claude-code-the-session-file-format-and-how-to-inspect-it-b9998e66d56b) -- MEDIUM, cross-verified with local data

### Tertiary (LOW confidence)
- `last-prompt` record behavior -- observed in 52% of files but no documentation on when/why it appears

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- verified against Tauri official docs, all versions confirmed
- Architecture: HIGH -- patterns verified against real session data on this machine
- JSONL format: HIGH for observed fields, MEDIUM for completeness (undocumented format)
- Pitfalls: HIGH -- verified locally (path encoding, message types, file sizes)

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (30 days -- Tauri stable, Claude Code format may change on any update)
