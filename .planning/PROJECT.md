# Workspace Resume

## What This Is

A lightweight Windows desktop app (Tauri) for resuming Claude Code sessions across multiple projects. It provides a taskbar-pinnable dashboard where projects appear as freely arrangeable cards. Each card lets you resume the most recent session or pick from a session list — launching a terminal window that remembers its screen position across restarts, crashes, and multi-monitor setups.

## Core Value

Reliable session resumption from a visual dashboard — if you can discover, select, and resume Claude Code sessions from cards, the product is useful. Window position memory and canvas layout make it magical, but resume is the foundation everything else builds on.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Tauri desktop app that pins to the Windows taskbar
- [ ] Dashboard with free-arrange canvas layout for project cards
- [ ] Auto-discover projects from local Claude Code session files
- [ ] Manual add projects via folder picker
- [ ] Pin/unpin projects to control which appear on the dashboard
- [ ] Drag-drop to reposition cards anywhere on the canvas
- [ ] Rename projects on the dashboard (display name, not folder)
- [ ] Horizontal project cards showing name + Resume button + Select Session button
- [ ] Resume button opens most recent Claude session for that project
- [ ] Select Session button opens list of all sessions for that project
- [ ] Session list shows timestamp + preview of user's last input message
- [ ] Launching a session opens a terminal (Warp initially) cd'd to project directory
- [ ] Session resumed via `claude -r` in the spawned terminal
- [ ] Window position memory per session (not per project)
- [ ] Position metadata updates dynamically as windows are moved (not just on close)
- [ ] Position tracking survives crashes and hard shutdowns
- [ ] Reopened sessions appear at their last known screen position
- [ ] Multi-monitor support (2+ screens)
- [ ] Fast startup and low resource usage

### Out of Scope

- Tab grouping / multi-tab window management — complexity too high for v1, defer to future
- Session renaming — nice QOL, defer to future PRD
- Real-time chat or session content editing — not a session viewer, just a launcher
- OAuth or cloud sync — local-only tool
- Linux/macOS support — Windows-only for now
- Mobile companion — desktop tool only

## Context

- User runs multiple Claude Code projects simultaneously across 2 monitors (may add a third)
- Claude Code sessions are stored locally — reference [claudecodeui](https://github.com/siteboon/claudecodeui) for how to read session files, discover projects, and extract session metadata
- Terminal choice (Warp initially) should be abstracted behind a configurable launcher so it can be swapped for PowerShell, Windows Terminal, or future alternatives
- Window position tracking needs to be robust against crashes — periodic/event-driven persistence, not just on-close
- User has strong MVP mindset: get it working, then iterate on QOL features

## Constraints

- **Framework**: Tauri (Rust backend + system webview) — chosen for fast startup and low memory footprint
- **Platform**: Windows 11 only for v1
- **Terminal**: Warp as initial default, but architecture must support swapping terminal emulators
- **Session data**: Must read local Claude Code session files (same approach as claudecodeui) — no API dependencies
- **Position tracking**: Must survive hard shutdowns — no reliance on graceful close events alone

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri over Electron | Prioritize fast startup, low RAM, small binary size | — Pending |
| Free-arrange canvas over grid/list | User wants spatial arrangement like desktop icons | — Pending |
| One window per session (no tab grouping) | Reduces v1 complexity significantly; stacking is acceptable | — Pending |
| Warp as initial terminal | Available now; abstracted for future swap | — Pending |
| Per-session position tracking (not per-project) | Multiple sessions from same project may be at different positions | — Pending |
| Dynamic position updates (not on-close only) | Must survive crashes and hard shutdowns | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-28 after initialization*
