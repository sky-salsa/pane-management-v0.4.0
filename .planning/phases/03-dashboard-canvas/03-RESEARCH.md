# Phase 3: Dashboard Canvas + tmux Pane Manager - Research

**Researched:** 2026-03-31
**Domain:** SolidJS multi-panel UI, tmux programmatic pane management, Tauri Store persistence, drag-and-drop
**Confidence:** HIGH

## Summary

This phase replaces the throwaway DevPanel with a full tmux session/pane manager GUI consisting of four regions: top bar (tmux hierarchy), left sidebar (project browser with tiers), main area (visual pane configurator), and quick-launch strip. The two major technical domains are (1) tmux CLI commands for querying and managing sessions/windows/panes via `wsl.exe`, and (2) SolidJS drag-and-drop from sidebar to pane drop zones using `@thisbeyond/solid-dnd`.

The existing codebase provides a solid foundation: `list_projects`/`list_sessions` IPC commands, `resumeSession` with TmuxLauncher, and the Tauri Store for persistence. The primary new work is extending the Rust backend with tmux query/pane-management commands, building the multi-panel SolidJS layout with shared state via `createContext`, and implementing the sidebar-to-pane drag-and-drop interaction.

**Primary recommendation:** Use `@thisbeyond/solid-dnd` (0.7.5) for drag-and-drop (it has drop zone support, unlike @neodrag/solid which is position-only). Keep all tmux interaction in Rust via `std::process::Command::new("wsl.exe")` -- same pattern as the existing TmuxLauncher. Use Tauri Store via Rust-side IPC commands (established pattern) for all persistence: project tiers, display names, session bindings, pane presets.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **This is a tmux pane and session mapper/manager** with a polished GUI. Not a generic terminal launcher. The product manages tmux sessions, windows, and panes for Claude Code projects.
- **Function first, polish later.** Get the layout and interactions working correctly. Visual aesthetics can be iterated on. Don't spend excessive time on pixel perfection.
- **App Layout:** Top bar (tmux session/window tabs) + Left sidebar (tiered project browser) + Main area (visual pane configurator) + Quick-launch strip below pane view
- **Project Cards:** Surface info (name, last active, active indicator), expandable (session count, full path), actions (Resume, Select Session, Rename)
- **A project must be linked to a pane before it launches** -- no free-floating launches. Drag to pane, then launch.
- **Session Binding Logic:** Project is primary unit. Default binding = most recent session. Explicit binding overrides. Unbinding reverts to most recent.
- **Pane Presets:** Save named layout configurations (e.g., "4-pane work", "6-pane deep work", "2-pane quick")
- **Drag-and-drop:** Drag a project from the sidebar into a pane slot to assign it
- **Project Tiers:** Pinned (always visible + quick-launch), Active (default), Paused (collapsible), Archived (collapsible)
- **Visual Style:** Modern dark app, not terminal-aesthetic. One accent color with 2-3 darker sub-shades. Don't overthink.
- **Existing code to reuse:** listProjects, listSessions, resumeSession IPC commands; TerminalSettings, ResumeResult, ActiveSession types; SettingsPanel.tsx; tauri-commands.ts; TmuxLauncher

### Claude's Discretion

No items explicitly marked -- all key decisions are locked in CONTEXT.md.

### Deferred Ideas (OUT OF SCOPE)

- Session rename -- v2
- Cross-session search -- v2
- tmux session creation from scratch (not just pane management) -- future
- Multiple tmux server support -- future
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | App displays pinned projects as cards on dashboard | Project tier system + sidebar component with Pinned tier at top; quick-launch strip for pinned |
| DASH-02 | Each project card shows display name, Resume button, Select Session button | ProjectCard component pattern with session binding logic; reuse existing `resumeSession` IPC |
| DASH-03 | User can drag project cards to pane slots | `@thisbeyond/solid-dnd` createDraggable/createDroppable for sidebar-to-pane drag |
| DASH-04 | Card/pane positions persist across restarts | Tauri Store plugin via Rust IPC -- store pane presets and assignments |
| DASH-05 | User can pin/unpin projects (controls dashboard/quick-launch visibility) | Project tier management IPC command + Store persistence |
| DASH-06 | User can set custom display name for any project | Display name management IPC + Store persistence |
| DASH-07 | App pins to Windows taskbar | Tauri window configuration -- already works with current setup |
| PERF-03 | Dashboard responsive with 20+ pinned projects | SolidJS fine-grained reactivity + `<For>` component with keyed list rendering |
| WPOS-01 | App tracks tmux pane layout (reinterpreted: visual pane layout mirrors tmux) | `tmux list-panes -F` format strings return pane geometry |
| WPOS-02 | Position metadata stored per session (reinterpreted: pane assignment per project) | Store plugin: session binding + pane slot assignment persisted per project |
| WPOS-03 | Position updates dynamically (reinterpreted: pane view reflects live tmux state) | Periodic tmux state polling via IPC |
| WPOS-04 | Position persistence survives crashes (reinterpreted: pane presets survive crashes) | Tauri Store auto-save with 100ms debounce -- atomic writes |
| WPOS-05 | Resuming session appears at last position (reinterpreted: project launches in assigned pane) | tmux `split-window -t` targets specific pane slot |
| WPOS-06 | Multi-monitor support (reinterpreted: n/a for tmux -- tmux handles its own display) | Not applicable -- tmux layout is terminal-internal |
| WPOS-07 | Fallback for disconnected monitor (reinterpreted: graceful handling of stale tmux state) | Validate tmux state before displaying; handle session/window not found |
</phase_requirements>

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| SolidJS | 1.9.x | Frontend framework | In package.json |
| Tauri | 2.x | Desktop framework | In Cargo.toml |
| Tailwind CSS | 4.x | Styling | In devDependencies |
| tauri-plugin-store | 2.x | Persistent state (Rust + JS) | In Cargo.toml + package.json |
| tauri-plugin-fs | 2.x | Session file reading | In Cargo.toml + package.json |
| serde/serde_json | 1.x | Rust serialization | In Cargo.toml |

### New Dependencies for Phase 3

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@thisbeyond/solid-dnd` | 0.7.5 | Drag-and-drop from sidebar to pane slots | Only SolidJS DnD library with drop zone support. Provides `createDraggable`, `createDroppable`, `DragOverlay`, collision detection. @neodrag/solid is position-only (no drop zones). @dnd-kit/solid is 0.3.2 stable / 0.4.0-beta -- less mature for Solid. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @thisbeyond/solid-dnd | @dnd-kit/solid | dnd-kit has daily beta releases (0.4.0-beta as of today) -- very active but unstable. Stable is 0.3.2. solid-dnd is older (Nov 2023) but proven and feature-complete for our use case. |
| @thisbeyond/solid-dnd | @neodrag/solid | neodrag is for free-position dragging only -- no drop zones, no collision detection. Cannot implement "drag project to pane slot" pattern. |
| @thisbeyond/solid-dnd | Custom HTML5 DnD | HTML5 drag/drop API works but is notoriously inconsistent cross-browser and lacks visual feedback customization. solid-dnd provides DragOverlay and collision detection out of the box. |

**Installation:**
```bash
cd workspace-resume
npm install @thisbeyond/solid-dnd
```

No new Rust crate dependencies needed -- tmux commands use existing `std::process::Command` via `wsl.exe`.

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
workspace-resume/src/
  App.tsx                      # Layout shell: TopBar + Sidebar + MainArea + QuickLaunch
  components/
    DevPanel.tsx               # REMOVE (replaced by new layout)
    SettingsPanel.tsx           # KEEP (integrate into sidebar or modal)
    layout/
      TopBar.tsx               # Session tabs + window tabs
      Sidebar.tsx              # Project browser with tier sections
      MainArea.tsx             # Visual pane grid + drop zones
      QuickLaunch.tsx          # Pinned project quick-access strip
    project/
      ProjectCard.tsx          # Sidebar project item (draggable)
      SessionList.tsx          # Expandable session list per project
      SessionItem.tsx          # Individual session row
    pane/
      PaneGrid.tsx             # Renders pane layout as visual grid
      PaneSlot.tsx             # Individual pane drop zone
      PanePresetPicker.tsx     # Save/load named layouts
  contexts/
    AppContext.tsx             # Shared app state: projects, sessions, tmux state
    DragContext.tsx            # Drag-and-drop state (wraps solid-dnd provider)
  lib/
    types.ts                  # Extended with new types
    tauri-commands.ts          # Extended with new IPC wrappers
    store-keys.ts             # Constants for store key names
    time.ts                   # Relative time formatting ("2 hours ago")

workspace-resume/src-tauri/src/
  commands/
    discovery.rs              # KEEP (list_projects, list_sessions)
    launcher.rs               # KEEP + extend (launch_in_pane)
    tmux.rs                   # NEW: tmux state queries
    project_meta.rs           # NEW: tier, display name, session binding management
  models/
    project.rs                # Extend with display_name, tier
    tmux_state.rs             # NEW: TmuxSession, TmuxWindow, TmuxPane structs
    pane_preset.rs            # NEW: PanePreset, PaneAssignment structs
  services/
    terminal/tmux.rs          # Extend with pane-targeted operations
```

### Pattern 1: SolidJS Context for Shared App State

**What:** A single `AppContext` provider wraps the entire app, holding reactive signals for projects, tmux state, active selections, and derived data.

**When to use:** All cross-component state (selected session, selected window, project list with tiers, pane assignments).

**Example:**
```typescript
// contexts/AppContext.tsx
import { createContext, useContext, createSignal, createResource } from "solid-js";
import { createStore, produce } from "solid-js/store";

interface AppState {
  projects: ProjectWithMeta[];
  selectedSession: string | null;
  selectedWindow: string | null;
  tmuxState: TmuxState | null;
  paneAssignments: Record<string, string>; // paneId -> encodedProject
}

const AppContext = createContext<AppContextValue>();

export function AppProvider(props: { children: any }) {
  const [state, setState] = createStore<AppState>({
    projects: [],
    selectedSession: null,
    selectedWindow: null,
    tmuxState: null,
    paneAssignments: {},
  });

  // Periodic tmux state refresh
  const [tmuxState, { refetch }] = createResource(
    () => selectedSession(),
    (session) => getTmuxState(session)
  );

  const value = {
    state,
    setState,
    // ... actions
  };

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
```

### Pattern 2: Drag from Sidebar to Pane Slot

**What:** `@thisbeyond/solid-dnd` wraps the entire layout. Sidebar projects are `createDraggable`, pane slots are `createDroppable`. On drop, the app assigns the project to that pane and triggers tmux commands.

**When to use:** The primary interaction for assigning projects to pane slots.

**Example:**
```typescript
// Sidebar ProjectCard (draggable)
import { createDraggable } from "@thisbeyond/solid-dnd";

function ProjectCard(props: { project: ProjectWithMeta }) {
  const draggable = createDraggable(props.project.encoded_name);
  return (
    <div use:draggable class="project-card">
      <span>{props.project.display_name}</span>
      {/* ... */}
    </div>
  );
}

// Pane slot (droppable)
import { createDroppable } from "@thisbeyond/solid-dnd";

function PaneSlot(props: { paneId: string; assignment: string | null }) {
  const droppable = createDroppable(props.paneId);
  return (
    <div
      use:droppable
      class="pane-slot"
      classList={{ "drop-active": droppable.isActiveDroppable }}
    >
      <Show when={props.assignment} fallback={<span>Drop project here</span>}>
        {/* Show assigned project info */}
      </Show>
    </div>
  );
}

// App-level onDragEnd handler
const [, { onDragEnd }] = useDragDropContext();
onDragEnd(({ draggable, droppable }) => {
  if (droppable) {
    assignProjectToPane(draggable.id, droppable.id);
  }
});
```

### Pattern 3: tmux State Query via Rust IPC

**What:** Rust backend runs tmux commands via `wsl.exe -e bash -c "tmux ..."` and parses the structured output. Frontend polls or requests on demand.

**When to use:** Every tmux state read (session list, window list, pane list with geometry).

**Example (Rust side):**
```rust
// commands/tmux.rs
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct TmuxSession {
    pub name: String,
    pub windows: usize,
    pub attached: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct TmuxPane {
    pub pane_id: String,
    pub pane_index: u32,
    pub width: u32,
    pub height: u32,
    pub top: u32,
    pub left: u32,
    pub active: bool,
    pub current_command: String,
    pub current_path: String,
}

#[tauri::command]
pub async fn list_tmux_sessions() -> Result<Vec<TmuxSession>, String> {
    let output = std::process::Command::new("wsl.exe")
        .args(["-e", "bash", "-c",
            "tmux list-sessions -F '#{session_name}|#{session_windows}|#{session_attached}' 2>/dev/null"
        ])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| format!("Failed to query tmux: {}", e))?;

    if !output.status.success() {
        return Ok(vec![]); // No tmux server running
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let sessions = stdout.lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 3 {
                Some(TmuxSession {
                    name: parts[0].to_string(),
                    windows: parts[1].parse().unwrap_or(0),
                    attached: parts[2] == "1",
                })
            } else { None }
        })
        .collect();

    Ok(sessions)
}
```

### Pattern 4: Tauri Store for Persistent App Metadata

**What:** All project metadata (tiers, display names, session bindings, pane presets) persisted via Tauri Store through Rust IPC commands. Frontend never touches the store directly.

**When to use:** Any data that must survive app restarts: project tiers, display names, pane presets, session bindings.

**Store schema:**
```json
{
  "project_meta": {
    "<encoded_name>": {
      "display_name": "My Project",
      "tier": "pinned",
      "bound_session": null
    }
  },
  "pane_presets": {
    "4-pane-work": {
      "name": "4-pane work",
      "layout": "tiled",
      "pane_count": 4
    }
  },
  "active_preset": "4-pane-work",
  "pane_assignments": {
    "0": "encoded-project-a",
    "1": "encoded-project-b"
  },
  "terminal_settings": { "backend": "tmux" },
  "error_log": []
}
```

### Anti-Patterns to Avoid

- **Frontend-direct store access:** The current codebase routes all store reads/writes through Rust IPC. Don't break this pattern by using `LazyStore` from JS -- keep the single source of truth in Rust.
- **Polling tmux too frequently:** tmux commands via `wsl.exe` have ~100-200ms overhead per call. Don't poll faster than every 2-3 seconds. Batch multiple queries into single `wsl.exe` calls when possible.
- **Parsing raw tmux output without delimiters:** Always use `-F` format strings with explicit delimiters (`|`) -- don't rely on default whitespace output which breaks with spaces in names.
- **Building custom layout engine:** Don't hand-roll CSS grid generation to mirror tmux layouts. Use tmux's own preset layouts (even-horizontal, even-vertical, tiled, main-vertical, main-horizontal) and map them to simple CSS grid configurations.
- **Over-engineering pane presets:** A preset is just: name + pane count + tmux layout name. Don't build a visual layout editor -- use tmux's 5 built-in layouts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop | Custom pointer event tracking | @thisbeyond/solid-dnd | Collision detection, DragOverlay, accessibility, edge cases (scroll, boundary) |
| Relative timestamps | Manual date math | Small utility function (see Code Examples) | Pattern is simple enough to inline -- no library needed, but don't hand-roll the logic in every component |
| tmux layout parsing | Custom layout string parser | tmux's -F format strings | tmux's format system is the canonical API; layout strings have checksums that are hard to compute |
| Persistent state | localStorage or custom file writes | tauri-plugin-store (already installed) | Auto-save, crash resilience, atomic writes, works from both Rust and JS |
| CSS grid for pane visualization | Complex dynamic grid calculations | CSS Grid with fixed patterns mapped from tmux layouts | 5 preset layouts map to simple CSS grid templates |

**Key insight:** tmux is the source of truth for pane layout. The app visualizes tmux state, it doesn't compute layouts independently. Query tmux -> render visual representation. Don't try to replicate tmux's layout algorithm.

## tmux CLI Command Reference

All commands executed via: `wsl.exe -e bash -c "tmux <command>"`

### Query Commands

| Command | Purpose | Format String |
|---------|---------|--------------|
| `tmux list-sessions -F '#{session_name}\|#{session_windows}\|#{session_attached}'` | List all sessions | Pipe-delimited fields |
| `tmux list-windows -t <session> -F '#{window_index}\|#{window_name}\|#{window_panes}\|#{window_active}'` | List windows in session | Pipe-delimited |
| `tmux list-panes -t <session>:<window> -F '#{pane_index}\|#{pane_id}\|#{pane_width}\|#{pane_height}\|#{pane_top}\|#{pane_left}\|#{pane_active}\|#{pane_current_command}\|#{pane_current_path}'` | List panes with geometry | Full pane info |
| `tmux display-message -t <session>:<window> -p '#{window_layout}'` | Get window layout string | Layout checksum string |

### Mutation Commands

| Command | Purpose | Key Flags |
|---------|---------|-----------|
| `tmux split-window -t <target> -h` | Split pane horizontally | `-h` = horizontal, `-v` = vertical (default) |
| `tmux split-window -t <target> -v -l 50%` | Split pane vertically at 50% | `-l` = size (lines, columns, or %) |
| `tmux resize-pane -t <target> -x <width> -y <height>` | Resize pane absolutely | `-x`/`-y` accept absolute or % |
| `tmux select-layout -t <target> <layout-name>` | Apply preset layout | `even-horizontal`, `even-vertical`, `main-horizontal`, `main-vertical`, `tiled` |
| `tmux send-keys -t <session>:<window>.<pane> '<command>' Enter` | Send command to specific pane | Target format: session:window.pane |
| `tmux kill-pane -t <target>` | Close a specific pane | Target pane by index or id |

### tmux Preset Layouts

| Layout | Description | CSS Grid Equivalent |
|--------|-------------|-------------------|
| `even-horizontal` | Panes spread left-to-right, equal width | `grid-template-columns: repeat(N, 1fr)` |
| `even-vertical` | Panes stacked top-to-bottom, equal height | `grid-template-rows: repeat(N, 1fr)` |
| `main-horizontal` | Large pane top, others below in row | `grid-template-rows: 2fr 1fr` with nested columns |
| `main-vertical` | Large pane left, others stacked right | `grid-template-columns: 2fr 1fr` with nested rows |
| `tiled` | Even grid layout | `grid-template: repeat(rows, 1fr) / repeat(cols, 1fr)` |

### Batching tmux Queries

To minimize `wsl.exe` overhead, batch multiple queries in one bash call:
```bash
wsl.exe -e bash -c "
  echo '---SESSIONS---';
  tmux list-sessions -F '#{session_name}|#{session_windows}|#{session_attached}' 2>/dev/null;
  echo '---WINDOWS---';
  tmux list-windows -t workspace -F '#{window_index}|#{window_name}|#{window_panes}|#{window_active}' 2>/dev/null;
  echo '---PANES---';
  tmux list-panes -t workspace:0 -F '#{pane_index}|#{pane_width}|#{pane_height}|#{pane_top}|#{pane_left}|#{pane_active}|#{pane_current_command}' 2>/dev/null
"
```

Parse by splitting on `---MARKER---` lines. This turns 3 wsl.exe invocations into 1.

## New TypeScript Types

```typescript
// Additions to lib/types.ts

export type ProjectTier = "pinned" | "active" | "paused" | "archived";

export interface ProjectMeta {
  display_name: string | null;  // null = use derived name from path
  tier: ProjectTier;
  bound_session: string | null; // null = use most recent
}

export interface ProjectWithMeta extends ProjectInfo {
  meta: ProjectMeta;
}

export interface TmuxSession {
  name: string;
  windows: number;
  attached: boolean;
}

export interface TmuxWindow {
  index: number;
  name: string;
  panes: number;
  active: boolean;
}

export interface TmuxPane {
  pane_id: string;
  pane_index: number;
  width: number;
  height: number;
  top: number;
  left: number;
  active: boolean;
  current_command: string;
  current_path: string;
}

export interface TmuxState {
  sessions: TmuxSession[];
  windows: TmuxWindow[];      // windows in selected session
  panes: TmuxPane[];           // panes in selected window
}

export interface PanePreset {
  name: string;
  layout: "even-horizontal" | "even-vertical" | "main-horizontal" | "main-vertical" | "tiled";
  pane_count: number;
}

export interface PaneAssignment {
  pane_index: number;
  encoded_project: string | null;
}
```

## New IPC Commands

| Command | Direction | Purpose | Parameters |
|---------|-----------|---------|------------|
| `list_tmux_sessions` | Frontend -> Rust | Get all tmux sessions | none |
| `list_tmux_windows` | Frontend -> Rust | Get windows in a session | session_name: string |
| `list_tmux_panes` | Frontend -> Rust | Get panes with geometry | session_name: string, window_index: number |
| `get_tmux_state` | Frontend -> Rust | Batched query: sessions + windows + panes for active session/window | session_name: string, window_index: number |
| `create_pane` | Frontend -> Rust | Split a pane in target window | session_name: string, window_index: number, direction: "h" or "v" |
| `apply_layout` | Frontend -> Rust | Apply preset layout to window | session_name: string, window_index: number, layout: string |
| `send_to_pane` | Frontend -> Rust | Send command to specific pane (for launching claude -r) | session_name: string, window_index: number, pane_index: number, command: string |
| `kill_pane` | Frontend -> Rust | Close a pane | session_name: string, window_index: number, pane_index: number |
| `get_project_meta` | Frontend -> Rust | Get tier, display name, binding for all projects | none |
| `set_project_tier` | Frontend -> Rust | Change project tier | encoded_name: string, tier: string |
| `set_display_name` | Frontend -> Rust | Set custom display name | encoded_name: string, name: string or null |
| `set_session_binding` | Frontend -> Rust | Bind specific session to project | encoded_name: string, session_id: string or null |
| `get_pane_presets` | Frontend -> Rust | List saved presets | none |
| `save_pane_preset` | Frontend -> Rust | Save current layout as preset | name: string, layout: string, pane_count: number |
| `delete_pane_preset` | Frontend -> Rust | Delete a preset | name: string |
| `get_pane_assignments` | Frontend -> Rust | Get project-to-pane mappings | none |
| `set_pane_assignment` | Frontend -> Rust | Assign project to pane | pane_index: number, encoded_project: string or null |

## Common Pitfalls

### Pitfall 1: @neodrag/solid Has No Drop Zones

**What goes wrong:** Developer installs @neodrag/solid (recommended in STACK.md) and tries to implement drag-to-pane -- discovers it only supports free-position dragging with no drop targets.
**Why it happens:** STACK.md was written before the tmux pivot changed the UX from "free-arrange cards on canvas" to "drag projects into pane slots."
**How to avoid:** Use `@thisbeyond/solid-dnd` for the sidebar-to-pane interaction. @neodrag/solid is not needed in this phase.
**Warning signs:** Finding yourself writing custom hit-testing or collision detection code.

### Pitfall 2: WSL/tmux Command Overhead

**What goes wrong:** Frontend polls tmux state every 500ms, causing UI jank and high CPU usage from constant `wsl.exe` process spawning.
**Why it happens:** Each `wsl.exe` call spawns a new process with ~100-200ms overhead. Three queries per poll cycle = 300-600ms of blocking time.
**How to avoid:** (1) Batch multiple tmux queries into single `wsl.exe` calls using shell script separators. (2) Poll no faster than every 3 seconds. (3) Use event-driven updates where possible (e.g., after a pane creation, immediately query new state instead of waiting for next poll).
**Warning signs:** Seeing multiple `wsl.exe` processes in Task Manager, UI freezing during poll cycles.

### Pitfall 3: tmux Session Not Running

**What goes wrong:** App tries to query/create panes in the "workspace" tmux session but it doesn't exist (user hasn't launched anything yet or tmux server died).
**Why it happens:** tmux server stops when all sessions are closed. The "workspace" session is created on first launch, not at app startup.
**How to avoid:** Always check `tmux has-session -t workspace` before querying. If no session exists, show an empty state in the UI with "Launch a project to get started" messaging. The existing TmuxLauncher already handles session creation.
**Warning signs:** Stderr messages like "no server running" or "session not found."

### Pitfall 4: SolidJS Directive TypeScript Integration

**What goes wrong:** TypeScript errors when using `use:draggable` or `use:droppable` directives because the directive types aren't registered.
**Why it happens:** SolidJS directives need to be declared in the global `JSX.Directives` interface for TypeScript to recognize them.
**How to avoid:** Add module augmentation:
```typescript
// In a .d.ts or at the top of the module
declare module "solid-js" {
  namespace JSX {
    interface Directives {
      draggable: true;
      droppable: true;
    }
  }
}
```
**Warning signs:** Red squiggly lines under `use:draggable` in the editor.

### Pitfall 5: Store Key Collisions and Schema Migration

**What goes wrong:** New store keys (project_meta, pane_presets) conflict with or overwrite existing terminal_settings and error_log data.
**Why it happens:** The store is a flat key-value namespace. Adding new keys without a migration strategy can corrupt existing data.
**How to avoid:** Use namespaced keys with a clear schema. The existing store already uses `terminal_settings` and `error_log` keys. New keys should follow the same pattern: `project_meta`, `pane_presets`, `pane_assignments`. Never overwrite the entire store -- always use specific `store.set(key, value)` calls.
**Warning signs:** Settings disappearing after an app update, or unexpected data in store values.

### Pitfall 6: Pane Index Instability

**What goes wrong:** Pane assignments reference pane index 2, but after killing pane 0, the remaining panes get renumbered, breaking all assignments.
**Why it happens:** tmux pane indices can change when panes are added/removed. The index is positional, not stable.
**How to avoid:** Use `pane_id` (e.g., `%5`) as the stable identifier for pane assignments, not `pane_index`. The `pane_id` format (`%N`) is unique and stable within a tmux server lifetime. However, pane_id changes across tmux restarts, so pane_assignments should be treated as ephemeral (re-assigned each session), while pane_presets (just layout + count) are persistent.
**Warning signs:** Projects appearing in wrong panes after splitting/closing other panes.

## Code Examples

### Relative Time Formatting

```typescript
// lib/time.ts
export function relativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) return "unknown";
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(isoTimestamp).toLocaleDateString();
}
```

### CSS Grid for Pane Visualization

```css
/* Pane grid container -- class set dynamically based on preset layout */

.pane-grid { display: grid; gap: 4px; width: 100%; height: 100%; }

/* even-horizontal: side by side */
.pane-grid.even-horizontal { grid-auto-flow: column; grid-auto-columns: 1fr; }

/* even-vertical: stacked */
.pane-grid.even-vertical { grid-auto-flow: row; grid-auto-rows: 1fr; }

/* tiled: auto-fit grid */
.pane-grid.tiled-2 { grid-template: 1fr / 1fr 1fr; }
.pane-grid.tiled-3 { grid-template: 1fr 1fr / 1fr 1fr; }
.pane-grid.tiled-4 { grid-template: 1fr 1fr / 1fr 1fr; }
.pane-grid.tiled-6 { grid-template: 1fr 1fr / 1fr 1fr 1fr; }

/* main-vertical: large left, stacked right */
.pane-grid.main-vertical { grid-template-columns: 2fr 1fr; }
.pane-grid.main-vertical > :first-child { grid-row: 1 / -1; }

/* main-horizontal: large top, row below */
.pane-grid.main-horizontal { grid-template-rows: 2fr 1fr; }
.pane-grid.main-horizontal > :first-child { grid-column: 1 / -1; }
```

### App Shell Layout (Tailwind)

```tsx
// App.tsx layout structure
function App() {
  return (
    <AppProvider>
      <DragDropProvider>
        <DragDropSensors />
        <div class="flex flex-col h-screen bg-[#1a1a2e] text-[#e0e0e0]">
          {/* Top bar: tmux session/window tabs */}
          <TopBar />

          <div class="flex flex-1 overflow-hidden">
            {/* Left sidebar: project browser */}
            <Sidebar />

            {/* Main area: pane configurator */}
            <main class="flex-1 flex flex-col overflow-hidden">
              <MainArea />
              {/* Quick-launch strip */}
              <QuickLaunch />
            </main>
          </div>
        </div>
        <DragOverlay>
          {/* Visual feedback during drag */}
        </DragOverlay>
      </DragDropProvider>
    </AppProvider>
  );
}
```

### Rust: Batched tmux State Query

```rust
// commands/tmux.rs

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn run_tmux_command(script: &str) -> Result<String, String> {
    #[cfg(windows)]
    let output = std::process::Command::new("wsl.exe")
        .args(["-e", "bash", "-c", script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to run tmux: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // "no server running" is not an error -- just means no tmux sessions
        if stderr.contains("no server running") || stderr.contains("no sessions") {
            return Ok(String::new());
        }
        return Err(format!("tmux error: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn get_tmux_state(
    session_name: String,
    window_index: u32,
) -> Result<TmuxState, String> {
    let script = format!(
        concat!(
            "echo '---SESSIONS---'; ",
            "tmux list-sessions -F '#{{session_name}}|#{{session_windows}}|#{{session_attached}}' 2>/dev/null; ",
            "echo '---WINDOWS---'; ",
            "tmux list-windows -t {sess} -F '#{{window_index}}|#{{window_name}}|#{{window_panes}}|#{{window_active}}' 2>/dev/null; ",
            "echo '---PANES---'; ",
            "tmux list-panes -t {sess}:{win} -F '#{{pane_index}}|#{{pane_id}}|#{{pane_width}}|#{{pane_height}}|#{{pane_top}}|#{{pane_left}}|#{{pane_active}}|#{{pane_current_command}}|#{{pane_current_path}}' 2>/dev/null"
        ),
        sess = session_name,
        win = window_index,
    );
    let raw = run_tmux_command(&script)?;
    parse_tmux_state(&raw)
}
```

## State of the Art

| Old Approach (STACK.md) | Current Approach (post-pivot) | When Changed | Impact |
|-------------------------|-------------------------------|--------------|--------|
| Win32 window position tracking | tmux pane layout management | 2026-03-31 (Warp->tmux pivot) | Eliminates need for `windows` crate Win32 APIs for positioning. Pane layout is tmux-native. |
| @neodrag/solid for free canvas | @thisbeyond/solid-dnd for drag-to-zone | This phase | Different library -- neodrag has no drop zones |
| Free-arrange card positions | Structured sidebar + pane grid | This phase | Cards are in a scrollable sidebar list, not free-positioned on canvas |
| Warp/WT/PowerShell launcher | tmux pane-targeted launcher | Phase 2 (exists) | Launch targets specific pane, not a new window |

**Deprecated/outdated from STACK.md:**
- `@neodrag/solid` -- was recommended for free-position canvas which is no longer the UI pattern. Not needed.
- `windows` crate Win32 positioning APIs (`SetWindowPos`, `GetWindowRect`, etc.) -- no longer needed for window position tracking. The `windows` crate is still in Cargo.toml for `OpenProcess` (PID checking) but the window positioning features are unused.

## Open Questions

1. **Pane assignment persistence across tmux restarts**
   - What we know: `pane_id` (e.g., `%5`) is stable within a tmux server lifetime but changes on restart. `pane_index` is positional and changes when panes are added/removed.
   - What's unclear: How to re-associate saved assignments after tmux restarts. Do we re-assign by position (index 0, 1, 2...) or by name?
   - Recommendation: Treat pane assignments as ephemeral -- cleared on app startup. Pane presets (layout + count) are persistent. When user applies a preset and assigns projects, those assignments last until the tmux window is closed or re-laid-out. This is simple and avoids fragile identity tracking.

2. **Launch behavior: create pane then send command, or use existing pane?**
   - What we know: The CONTEXT says "assigning a project to a pane sends tmux commands to create/split the pane and run `claude -r` in it."
   - What's unclear: If a pane already exists (e.g., user applied a 4-pane preset), does assigning a project send commands to the *existing* pane, or create a *new* pane?
   - Recommendation: Two flows: (1) If the target pane slot is empty in the visual grid, `split-window` to create it then `send-keys` to launch. (2) If the pane already exists (visible in tmux), just `send-keys` to it. The visual grid should reflect actual tmux state, not a hypothetical layout.

3. **Sidebar width and responsive behavior**
   - What we know: CONTEXT says left sidebar with tiered project lists, collapsible sections.
   - What's unclear: Fixed width or resizable? Collapsible entirely?
   - Recommendation: Start with fixed ~280px sidebar. Add resize handle as future polish. Not worth engineering initially.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| WSL | tmux commands | Assumed (Phase 2 works) | -- | PowerShell fallback (existing) |
| tmux (in WSL) | Pane management | Assumed (Phase 2 works) | -- | None -- core feature |
| npm | Frontend deps | Yes | Via Node.js | -- |
| Rust/Cargo | Backend build | Yes | Via Phase 1 setup | -- |

**Missing dependencies with no fallback:** None -- Phase 2 already proved WSL+tmux works.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Rust: built-in `#[cfg(test)]` modules; Frontend: none (no test framework installed) |
| Config file | None for frontend |
| Quick run command | `cd workspace-resume/src-tauri && cargo test` |
| Full suite command | `cd workspace-resume/src-tauri && cargo test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Pinned projects shown in sidebar | manual | Visual check in dev mode | N/A |
| DASH-02 | Card shows name, Resume, Select Session | manual | Visual check in dev mode | N/A |
| DASH-03 | Drag project to pane slot | manual | Visual DnD check in dev mode | N/A |
| DASH-04 | Pane assignments persist | manual | Restart app, verify assignments | N/A |
| DASH-05 | Pin/unpin projects | manual | UI interaction check | N/A |
| DASH-06 | Custom display name | manual | Set name, verify display | N/A |
| DASH-07 | Taskbar pinning | manual | Pin to taskbar, verify icon | N/A |
| PERF-03 | 20+ pinned projects responsive | manual | Load test with mock data | N/A |
| tmux queries | Parse tmux output correctly | unit | `cargo test` -- test parse functions | Wave 0 |
| store persistence | Project meta round-trips through store | unit | `cargo test` -- test serialization | Wave 0 |
| tmux state parsing | Format string output parsed correctly | unit | `cargo test` -- test parsers with sample data | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd workspace-resume/src-tauri && cargo test`
- **Per wave merge:** `cd workspace-resume/src-tauri && cargo test` + manual UI verification
- **Phase gate:** Full Rust test suite green + manual walkthrough of all DASH requirements

### Wave 0 Gaps
- [ ] `src-tauri/src/commands/tmux.rs` tests -- cover tmux output parsing (mock stdout, test parse functions)
- [ ] `src-tauri/src/commands/project_meta.rs` tests -- cover store serialization/deserialization
- [ ] `src-tauri/src/models/tmux_state.rs` tests -- cover struct serialization
- [ ] `src-tauri/src/models/pane_preset.rs` tests -- cover preset serialization

*(Frontend testing is manual-only for this phase -- no frontend test framework is configured. Rust unit tests cover all backend logic.)*

## Sources

### Primary (HIGH confidence)
- [tmux man page](https://man7.org/linux/man-pages/man1/tmux.1.html) - CLI syntax for all tmux commands
- [tmux Formats wiki](https://github.com/tmux/tmux/wiki/Formats) - Format variable reference
- [Tauri Store plugin](https://v2.tauri.app/plugin/store/) - Store API, LazyStore, change listeners
- [Tauri Shell plugin](https://v2.tauri.app/plugin/shell/) - Command.create API (reference, not used directly)
- [SolidJS Context docs](https://docs.solidjs.com/concepts/context) - createContext/useContext TypeScript pattern
- [@thisbeyond/solid-dnd GitHub](https://github.com/thisbeyond/solid-dnd) - v0.7.5, API: createDraggable, createDroppable, DragOverlay
- [@neodrag/solid docs](https://www.neodrag.dev/docs/solid) - Confirmed: free-position only, no drop zones
- Existing codebase: tmux.rs, launcher.rs, discovery.rs, types.ts, tauri-commands.ts

### Secondary (MEDIUM confidence)
- [tao-of-tmux: Panes](https://tao-of-tmux.readthedocs.io/en/latest/manuscript/07-pane.html) - Pane management patterns
- [tmux cheatsheet](https://tmuxcheatsheet.com/) - Quick reference for tmux commands
- [@dnd-kit/solid](https://dndkit.com/solid/quickstart) - Alternative DnD (0.4.0-beta, not recommended)
- [Tauri Store JS reference](https://v2.tauri.app/reference/javascript/store/) - Store/LazyStore class API
- npm registry - Verified versions: @thisbeyond/solid-dnd@0.7.5 (Nov 2023), @neodrag/solid@2.3.1, @dnd-kit/solid@0.3.2 stable / 0.4.0-beta

### Tertiary (LOW confidence)
- [tmux-lib Rust crate](https://docs.rs/tmux-lib/latest/tmux_lib/layout/index.html) - Layout parsing crate exists (v0.4.2) but adds dependency; not recommended since we use format strings directly

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified against npm registry with exact versions and publish dates
- Architecture: HIGH - Patterns derived from existing codebase conventions (Rust IPC, Store access) and official SolidJS docs
- tmux CLI: HIGH - Commands verified against official tmux man page and format wiki
- Drag-and-drop: HIGH - Library choice validated by confirming @neodrag/solid lacks drop zones; @thisbeyond/solid-dnd API verified
- Pitfalls: HIGH - Derived from hands-on codebase analysis (WSL overhead, pane index instability, directive TypeScript)

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable domain -- tmux CLI and SolidJS 1.x are not changing rapidly)
