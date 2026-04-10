# Phase 2 Context: Session Resume

**Phase goal:** Users can browse sessions and resume any Claude Code session in a terminal window from the app.

**Requirements:** RESU-01, RESU-02, RESU-03, RESU-04, SESS-01, SESS-02, SESS-03, SESS-04

## Locked Decisions

Decisions made during discussion. Downstream agents (researcher, planner) should treat these as constraints, not suggestions.

### CRITICAL: Terminal Backend Correction

- **Warp is the terminal, NOT Windows Terminal.** The research phase incorrectly recommended `wt.exe` (Windows Terminal). The user explicitly requires Warp as the primary terminal with PowerShell (`pwsh.exe` / `powershell.exe`) as fallback.
- **This is a project-wide correction.** All planning files (PROJECT.md, ROADMAP.md, research docs) that reference Windows Terminal need to be updated. Warp is the spec.
- **If Warp's closed-source nature creates technical barriers** (e.g., no CLI flags for directory + command), surface the issue to the user rather than silently switching to another terminal. The user wants to explore alternatives together if that happens.

### Resume UI Layout

- **Upgrade the existing DevPanel** — add Resume and Select Session buttons to the existing table UI. Minimum effort, throwaway anyway (Phase 3 replaces it with the real dashboard).
- **Same view with side panel** — session list opens in a slide-in panel from the right when you click Select Session. Project list stays visible on the left.

### Terminal Launch

- **Warp as primary terminal** — launch via Warp CLI. Research needed on exact Warp Windows CLI flags for: specifying working directory, running initial command (`claude -r`), opening a new window (not tab).
- **PowerShell as fallback** — if Warp is not installed or launch fails, fall back to `pwsh.exe` (or `powershell.exe` if pwsh unavailable).
- **Terminal abstraction** — implement as a configurable backend (Rust trait or similar) so swapping terminals is a code change, not a rewrite.
- **Simple settings UI** — expose a dropdown in a basic settings panel to choose between available terminals (Warp / PowerShell / Custom). This is part of Phase 2 scope.
- **New window per session** — Claude's discretion on whether to open new window vs tab, but should be compatible with Phase 4's per-session window position tracking.

### Session Selection

- **Side panel** — clicking Select Session on a project slides in a panel from the right showing all sessions for that project.
- **Session info displayed:** timestamp + last user message preview + **session duration** (time from first to last activity). Duration is a new data point — scanner needs to extract first_seen and last_active timestamps, compute the difference.
- **Sessions sorted by most recent activity.**

### Resume Feedback

- **App stays open** after launching a terminal — user may want to resume multiple sessions.
- **Error toast** for failed launches — auto-dismisses but non-blocking.
- **Persistent error log** accessible from settings — so users can see/copy errors after the toast dismisses.
- **Active session indicator** — show a green dot or "running" badge on sessions/projects that have a terminal currently open. Track process state (PID alive check).

## Deferred Ideas

- Relative timestamps ("2 hours ago") — deferred to Phase 3 (from Phase 1 discussion)
- Tab grouping (multiple sessions in one terminal window) — v2

## Open Questions for Research

1. **Warp CLI on Windows**: What are the exact CLI flags for Warp on Windows? Can you specify working directory, initial command, and force new window? Is `warp.exe` the binary name? Where is it typically installed?
2. **Process tracking**: How to reliably detect if a spawned terminal (Warp/PowerShell) is still running? PID polling? Is there a Tauri-native way?
3. **Session duration extraction**: The scanner currently extracts timestamps and last user message. What's the cheapest way to also get the first record's timestamp for duration calculation? (Currently using reverse-read which starts from the end.)
4. **`claude -r` with session ID**: What's the exact syntax for resuming a specific session? Is it `claude -r --session-id <id>` or `claude --resume <id>` or something else?

## Phase Boundaries

**This phase includes:**
- Resume button on project cards (most recent session)
- Select Session button with side panel session list
- Terminal launch via Warp (PowerShell fallback)
- Terminal abstraction layer (configurable backend)
- Simple settings panel for terminal choice
- Session duration display
- Active session tracking (is terminal still running?)
- Error toast + persistent error log
- `claude -r` session resume command

**This phase does NOT include:**
- Dashboard canvas / free-arrange layout (Phase 3)
- Pin/unpin, display names, drag-drop (Phase 3)
- Window position tracking (Phase 4)
- Global hotkey (Phase 5)

---
*Created: 2026-03-29 after Phase 2 discussion*
