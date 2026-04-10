# Roadmap: Workspace Resume

## Overview

This roadmap delivers a Tauri desktop app that lets you discover, browse, and resume Claude Code sessions from a spatial dashboard with per-session window position memory. The phases are ordered by the user's explicit priority: session resume is the foundation everything else builds on. Discovery and resume come first to make the product useful, then the dashboard canvas makes it pleasant, window position tracking makes it magical, and power user features round it out.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Session Discovery** - Scaffold Tauri app and build the session/project discovery engine (completed 2026-03-29)
- [x] **Phase 2: Session Resume** - Enable browsing and resuming sessions from a minimal working UI (completed 2026-04-01)
- [ ] **Phase 3: Dashboard Canvas + tmux Pane Manager** - Replace dev panel with tmux session/pane manager GUI with project sidebar, visual pane configurator, and layout presets
- [ ] **Phase 5: Power User Polish** - Global hotkey and final refinements

## Phase Details

### Phase 1: Foundation + Session Discovery
**Goal**: The app can discover all Claude Code projects and parse their session data from local files
**Depends on**: Nothing (first phase)
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, PERF-01, PERF-02
**Success Criteria** (what must be TRUE):
  1. App launches on Windows 11 in under 2 seconds with a visible window
  2. App finds and lists all projects that have Claude Code sessions in `~/.claude/projects/`
  3. App correctly decodes encoded project paths to show real directory names
  4. App reads session files (including large ones) without freezing or excessive memory usage
  5. App detects newly created sessions/projects without requiring a restart
**Plans:** 3/3 plans complete

Plans:
- [x] 01-01-PLAN.md — Scaffold Tauri + SolidJS app with all Phase 1 dependencies and module structure
- [x] 01-02-PLAN.md — Build core discovery engine: path decoder, JSONL parser, and IPC commands
- [x] 01-03-PLAN.md — File watcher for live detection + dev panel to verify the pipeline end-to-end

### Phase 2: Session Resume
**Goal**: Users can browse sessions and resume any Claude Code session in a terminal window from the app
**Depends on**: Phase 1
**Requirements**: RESU-01, RESU-02, RESU-03, RESU-04, SESS-01, SESS-02, SESS-03, SESS-04
**Success Criteria** (what must be TRUE):
  1. User can select a project and see all its sessions listed by most recent, each showing timestamp and last input preview
  2. User can click Resume on a project and a terminal opens cd'd to the project directory with the most recent session resumed via `claude -r`
  3. User can pick a specific session from the list and resume it in a terminal via `claude -r <session_id>`
  4. Terminal backend is tmux/WSL by default (Warp and PowerShell available as alternatives), architecture supports swapping via settings
**Plans:** 3/3 plans complete

Plans:
- [x] 02-01-PLAN.md — Terminal abstraction layer (Rust trait + Warp/PowerShell implementations) and launcher IPC commands
- [x] 02-02-PLAN.md — Frontend types, IPC wrappers, and DevPanel upgrade with session side panel and resume buttons
- [x] 02-03-PLAN.md — Settings panel, integration build, and end-to-end manual verification

### Phase 3: Dashboard Canvas + tmux Pane Manager
**Goal**: Replace the dev panel with a polished tmux session/pane manager -- visual pane configurator, project sidebar with drag-to-pane, session binding, and layout presets
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, PERF-03
**Pivot carry-forward**: This phase combines original Phase 3 (Dashboard Canvas) and Phase 4 (Window Position Tracking, reinterpreted as tmux pane management). Also carries forward: relative timestamps, project-level "last active", active session count in header, session duration display.
**Success Criteria** (what must be TRUE):
  1. App shows four-region layout: TopBar (tmux hierarchy), Sidebar (tiered project browser), MainArea (visual pane grid), QuickLaunch (pinned shortcuts)
  2. User can drag project cards from sidebar into pane slots to assign and launch sessions
  3. User can pin/unpin projects to control tier placement and quick-launch visibility
  4. User can set a custom display name for any project
  5. Dashboard remains responsive with 20+ project cards
  6. Sessions show relative timestamps and duration
  7. Dashboard header shows total project/session counts and active session count
  8. User can select and apply pane layout presets (2-pane, 4-grid, main+stack, etc.)
  9. Pane assignments and project metadata persist across app restarts
**Plans:** 5 plans

Plans:
- [x] 03-01-PLAN.md — Rust backend: tmux state models, tmux IPC commands, project metadata + pane preset persistence
- [x] 03-02-PLAN.md — Frontend contracts: TypeScript types, IPC wrappers, AppContext, time utilities, solid-dnd setup
- [x] 03-03-PLAN.md — App shell layout with TopBar and Sidebar (tiered project browser with draggable cards)
- [x] 03-04-PLAN.md — Visual pane configurator: PaneGrid with drop zones, drag-and-drop wiring, layout presets
- [x] 03-05-PLAN.md — QuickLaunch strip, polish, DevPanel cleanup, and end-to-end human verification

### Phase 4: Distribution Prep
**Goal**: App is portable and installable by other Windows 11 users who don't have WSL/tmux/Claude Code yet
**Depends on**: Phase 3
**Requirements**: All 8 blockers from PORTABILITY-AUDIT.md resolved, bootstrap script, first-run health check
**Added**: 2026-04-08
**Success Criteria** (what must be TRUE):
  1. App contains no hardcoded user-specific paths or dev-only code
  2. App detects missing prerequisites (WSL, tmux, Claude Code) on startup and shows clear guidance
  3. A PowerShell bootstrap script can take a clean Windows 11 box to fully running environment
  4. .msi installer builds cleanly and installs per-user without admin
  5. App launches and shows helpful first-run state on a machine with no existing projects
  6. Version numbers, app identifier, and author metadata are correct for distribution
**Plans**: 5 sessions planned

Plans:
- [ ] 04-01-PLAN.md — Fix all 8 portability blockers (code cleanup, remove hardcoded paths, remove dev code, align metadata)
- [ ] 04-02-PLAN.md — Logging (`tauri-plugin-log`) + auto-updater (`tauri-plugin-updater`) + GitHub Actions release workflow
- [ ] 04-03-PLAN.md — First-run health check UI + bootstrap.ps1 script for WSL/tmux/Claude Code setup
- [ ] 04-04-PLAN.md — Testing infrastructure: portability regression script, smoke tests, CI checks, user feedback button
- [ ] 04-05-PLAN.md — Final build, end-to-end test, user README, first GitHub Release

### Phase 5: Power User Polish
**Goal**: Users can summon the dashboard instantly from anywhere on the system
**Depends on**: Phase 3
**Requirements**: POWR-01, POWR-02
**Success Criteria** (what must be TRUE):
  1. User can press a global keyboard shortcut to show/hide the dashboard from any application
  2. The global hotkey is configurable by the user
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5
(Original Phase 4 merged into Phase 3 after tmux pivot; new Phase 4 is Distribution Prep)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Session Discovery | 3/3 | Complete   | 2026-03-29 |
| 2. Session Resume | 3/3 | Complete   | 2026-04-01 |
| 3. Dashboard Canvas + tmux Pane Manager | 5/5 | Complete   | 2026-04-07 |
| 4. Distribution Prep | 0/5 | Not started | - |
| 5. Power User Polish | 0/1 | Not started | - |
