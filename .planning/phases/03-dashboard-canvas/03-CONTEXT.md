# Phase 3 Context: Dashboard Canvas + tmux Pane Manager

**Phase goal:** Replace the dev panel with a polished tmux session/pane manager — visual pane configurator, project sidebar with drag-to-pane, session binding, and layout presets.

**Requirements:** DASH-01 through DASH-07, PERF-03 + WPOS-01 through WPOS-07 (reinterpreted for tmux)

**Note:** This phase combines the original Phase 3 (Dashboard Canvas) and Phase 4 (Window Position Tracking → tmux Layout Management) into a single phase, per user decision during discussion.

## Locked Decisions

### Product Vision (post-pivot)

- **This is a tmux pane and session mapper/manager** with a polished GUI. Not a generic terminal launcher. The product manages tmux sessions, windows, and panes for Claude Code projects.
- **Function first, polish later.** Get the layout and interactions working correctly. Visual aesthetics can be iterated on. Don't spend excessive time on pixel perfection.

### App Layout

- **Top bar:** tmux hierarchy navigation
  - Session tabs (shows all tmux sessions)
  - Window tabs within the selected session
  - Main view shows the panes inside the currently selected window
- **Left sidebar:** Project browser
  - Tiered project lists: Pinned (top), Active (main), Paused (collapsible), Archived (collapsible)
  - Each project expandable to show sessions
  - "All" unfiltered view accessible
  - Drag projects from sidebar into pane slots
- **Main area:** Visual representation of tmux panes in the active window
  - Each pane slot shows which project/session is assigned
  - Drag a project from sidebar into a pane to assign it
- **Below pane view:** Quick-launch strip for pinned/favorite projects (fast access)

### Project Cards

- **Surface info:** Project name (editable), last active (relative time like "2 hours ago"), active indicator (green dot when running)
- **Expandable/secondary info:** Session count, full path (click to expand)
- **Actions:** Resume button (launches bound session), Select Session (expands to show sessions), Rename (inline edit)
- **A project must be linked to a pane before it launches** — no free-floating launches. Drag to pane, then launch.

### Session Binding Logic

- **Project is the primary unit of organization** — you interact with projects, not individual sessions
- **Default binding:** Each project is automatically bound to its most recent session
- **Explicit binding:** Selecting a specific session overrides the default — that session becomes the "active" one for the project
- **Unbinding:** Removing the explicit binding reverts to most recent session
- **Launch behavior:** When you launch a project (Resume or drag-to-pane), it launches the currently bound session

### Pane Management

- **Pane presets:** Save named layout configurations (e.g., "4-pane work", "6-pane deep work", "2-pane quick")
- **Drag-and-drop:** Drag a project from the sidebar into a pane slot to assign it
- **Launch = tmux command:** Assigning a project to a pane sends tmux commands to create/split the pane and run `claude -r` in it
- **Pane assignment logic (Phase 3 scope):** Keep it simple — project links to pane, launch creates the tmux pane. Don't over-engineer the pane selection UX initially.

### Project Tiers

| Tier | Description | Behavior |
|------|-------------|----------|
| Pinned | Favorites | Always visible at top. Also appears in quick-launch strip. |
| Active | Main working projects | Default list. All undiscovered projects start here. |
| Paused | Coming back later | Collapsible section. Not deprecated, just on hold. |
| Archived | Deprecated | Collapsible section. Old projects, rarely accessed. |

### Navigation / Sessions

- **Sidebar session selection:** Expand a project in the sidebar → see all sessions → click one to bind it as the active session for that project
- **Session list info:** Timestamp (relative), last user message preview, session duration
- **Hover/popup for drag:** When dragging a project card, can show a popup of its sessions

### Visual Style

- **Modern dark app** — not terminal-aesthetic. Clean, rounded corners, modern UI.
- **One unobtrusive accent color** with 2-3 darker sub-shades or gradient.
- **Primary dark theme.** Not a terminal look — tmux provides plenty of that already.
- **Don't overthink** — can always tweak later. Functionality >> aesthetics.

## Existing Code to Reuse

- `listProjects`, `listSessions` IPC commands — still the data source
- `resumeSession` IPC command — still the launch mechanism (calls TmuxLauncher)
- `TerminalSettings`, `ResumeResult`, `ActiveSession` types — still valid
- `SettingsPanel.tsx` — keep and integrate into the new layout
- `tauri-commands.ts` — all 6 IPC wrappers still work
- TmuxLauncher (3-step: new-window + send-keys) — needs extension for pane targeting

## New IPC Commands Needed

- **tmux session/window/pane queries:** List sessions, list windows in session, list panes in window
- **Pane creation:** Split pane horizontally/vertically, specify size
- **Pane targeting:** Send command to a specific pane (not just new window)
- **Layout presets:** Save/load named layout configurations
- **Project tier management:** Set project tier (pinned/active/paused/archived)
- **Session binding:** Bind/unbind a specific session to a project

## Canonical References

- `.planning/PIVOT-NOTE.md` — Full record of Warp→tmux pivot and architectural decisions
- `.planning/phases/01-foundation-session-discovery/01-CONTEXT.md` — Data freshness, stale project handling decisions
- `.planning/phases/02-session-resume/02-CONTEXT.md` — Terminal decisions (now superseded by tmux pivot but shows evolution)
- `.planning/research/FEATURES.md` — Competitive analysis, table stakes vs differentiators

## Deferred Ideas

- Session rename — v2
- Cross-session search — v2
- tmux session creation from scratch (not just pane management) — future
- Multiple tmux server support — future

## Phase Boundaries

**This phase includes:**
- Full app layout (top bar + sidebar + main pane view + quick-launch)
- Project browser sidebar with tiered lists and search
- Visual pane configurator (drag projects to pane slots)
- Session binding logic (default to most recent, explicit override)
- Pane presets (save/load named layouts)
- tmux IPC commands for pane/window/session management
- Relative timestamps, session duration, active indicators
- Project tier management (pin, pause, archive)
- Display name rename
- Modern dark theme with accent color

**This phase does NOT include:**
- Global hotkey (Phase 5)
- Advanced tmux features (scripting, automation)
- Session content preview/viewer
- Cloud sync

---
*Created: 2026-04-01 after Phase 3 discussion*
*Note: This phase combines original Phase 3 + Phase 4 scope*
