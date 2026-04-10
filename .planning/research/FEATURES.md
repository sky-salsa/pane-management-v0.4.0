# Feature Landscape

**Domain:** Claude Code session management desktop launcher (Windows, Tauri)
**Researched:** 2026-03-28
**Overall confidence:** MEDIUM-HIGH

## Comparable Products Surveyed

The feature landscape was informed by analyzing these categories of tools:

| Category | Tools Examined | Relevance |
|----------|---------------|-----------|
| Claude Code session UIs | Nimbalyst, claudecodeui, claude-session-browser, ccrider, claude-sessions, claude-run, ccboard | Direct competitors / adjacent tools |
| Terminal session managers | Warp (launch configs, session restore), Windows Terminal, tmux session managers (tmuxp, twm, sessionx) | Session resume patterns |
| Workspace launchers | PowerToys Workspaces, DisplayFusion, PersistentWindows, SmartWindows | Window position & layout persistence |
| Desktop launchers | TaskFolder, Wise Hotkey, system tray launchers | Taskbar/tray integration patterns |
| AI CLI tools | Gemini CLI session management, Codex CLI resume | Session resume UX patterns |

---

## Table Stakes

Features users expect from a session launcher. Missing any of these makes the product feel broken or incomplete. Ordered by priority.

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| 1 | **One-click session resume** | Core value prop. Every comparable tool (ccrider, claude-sessions, Nimbalyst) has single-action resume. Users who can't resume in one click will just type `claude --resume` in a terminal. | Low | `claude -r <session_id>` in the right working directory. This is the minimum viable action. |
| 2 | **Project discovery from local session files** | All Claude Code UIs auto-discover from `~/.claude/projects/`. Manual-only setup would be a dealbreaker when competitors scan automatically. | Medium | JSONL files in `~/.claude/projects/<encoded-path>/`. Need to decode path encoding, parse session metadata, handle malformed files gracefully. |
| 3 | **Session list per project** | Every session browser shows a list of sessions with timestamps. claude-session-browser, ccrider, and claude-sessions all provide session lists with metadata. Without this, users can only resume the most recent session. | Medium | Parse JSONL files to extract: timestamp, user's last message preview, session ID. Large session files need efficient partial reads (first + last records). |
| 4 | **Taskbar pinning / system tray** | Users expect desktop apps to be pinnable. PowerToys, every launcher, and Tauri apps all support this natively. An app that can't be pinned to the taskbar forces users to dig through Start menu or keep a window open. | Low | Tauri supports taskbar pinning out of the box on Windows. System tray icon is a Tauri plugin (`tauri-plugin-shell` + tray API). |
| 5 | **Dashboard with project cards** | Visual project overview is universal across launcher tools. Nimbalyst uses kanban cards, PowerToys Workspaces uses a visual editor, claude-session-browser uses a list. A text-only list would work but cards are expected for a GUI launcher. | Medium | Horizontal cards with project name + resume button + session count. Standard web UI with a layout engine. |
| 6 | **Fast startup and low memory** | PowerToys Workspaces, system tray apps, and launchers all start in under 1 second. Tauri was chosen specifically for this. If startup is sluggish, users will just open a terminal instead. | Low | Tauri's native webview avoids Electron's overhead. Keep the dashboard simple, lazy-load session data. |
| 7 | **Terminal launcher abstraction** | Warp is the initial target but the user explicitly requires swappable terminals. Every mature launcher (PowerToys Workspaces, tmux managers) supports configurable shell/terminal. Hardcoding to one terminal is a trap. | Medium | Abstract behind a "terminal profile" config: executable path, arguments template, working directory. Ship with Warp profile, make it easy to add PowerShell/Windows Terminal/others. |
| 8 | **Manual project addition** | Auto-discovery won't find projects that haven't had a Claude session yet, or projects stored in unusual locations. claudecodeui and similar tools support adding custom paths. | Low | Folder picker dialog (Tauri `dialog` plugin). Adds a project entry to local config. |
| 9 | **Pin/unpin projects** | Users with many projects need to filter noise. Comparable to pinning in Windows Start menu, VS Code recent projects, or any launcher with favorites. | Low | Boolean flag per project in local config. Pinned projects show on dashboard; unpinned are hidden but discoverable. |
| 10 | **Session metadata display** | Timestamp + preview of last user message. Every session browser shows this. claude-session-browser shows session ID, timestamps, and message previews. ccrider adds full-text search. Without metadata, session lists are just opaque UUIDs. | Medium | Parse first and last records of JSONL session files. Extract: creation timestamp, last activity timestamp, user's last input text (truncated for preview). |

---

## Differentiators

Features that set this product apart. Not expected because competitors don't have them (or do them poorly), but highly valued by the target user.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | **Window position memory per session** | **The killer feature.** No Claude Code UI tool tracks where terminal windows live on screen. PowerToys Workspaces does position restoration for generic apps, but not per-session. PersistentWindows tracks all windows but has no concept of "sessions." This product uniquely maps session identity to screen position, so each session reopens exactly where it was. | High | Requires: (a) spawning terminal windows at specific coordinates, (b) tracking position changes of those windows via Win32 API polling or event hooks, (c) persisting position data per session ID, (d) restoring position on next launch. See Pitfalls -- this is the hardest feature. |
| D2 | **Crash-resilient position persistence** | PowerToys Workspaces only saves on explicit capture. Most apps save on graceful close. This product saves positions periodically/on-move so hard shutdowns and crashes don't lose layout. PersistentWindows does this for all windows but not session-aware. | High | Periodic save (every N seconds) + event-driven save (on window move/resize). Use a lightweight local store (SQLite via `tauri-plugin-sql` or flat JSON). Must handle the case where terminal process dies unexpectedly. |
| D3 | **Multi-monitor awareness** | PowerToys Workspaces and DisplayFusion handle multi-monitor, but no Claude session tool does. The user runs 2+ monitors and may add a third. Sessions should reopen on the correct monitor even after monitor configuration changes. | High | Win32 `MonitorFromWindow`, `GetMonitorInfo` for current state. Validate saved positions against current monitor topology on restore. Fall back to primary monitor if saved monitor is gone. Handle DPI differences between monitors. |
| D4 | **Free-arrange canvas layout** | Most dashboards use grid or list layouts. A freeform canvas where cards can be dragged anywhere (like desktop icons) gives spatial memory to project organization. Users can cluster related projects, separate work from personal, etc. PowerToys Workspaces has a visual editor but it's for window layouts, not project cards. | Medium | HTML5 drag-and-drop on an absolutely-positioned canvas. Save card positions to local config. Snap-to-grid optional. Need to handle canvas overflow/scrolling for many projects. |
| D5 | **Project display name customization** | Most tools show folder paths or auto-generated names. Letting users rename projects on the dashboard (without touching the filesystem) is a small but meaningful personalization. | Low | Display name field in project config, falls back to folder name. Inline edit on the card. |
| D6 | **Global hotkey to summon dashboard** | Warp has a global hotkey (with known issues). Wise Hotkey and similar tools prove users want instant access. A global shortcut to show/hide the dashboard (like Spotlight or Alfred) makes the launcher feel native and fast. | Medium | Tauri supports global shortcuts via `tauri-plugin-global-shortcut`. Register a configurable hotkey (e.g., Ctrl+Shift+Space). Toggle dashboard visibility. |

---

## Anti-Features

Features to explicitly NOT build. Each represents a complexity trap or scope creep risk that would delay shipping or muddy the product's identity.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **In-app chat / session content viewer** | claudecodeui, claude-code-viewer, and claude-code-web already do this well. Building a chat UI is a massive scope expansion that would make this a "Claude Code GUI" instead of a "session launcher." The user's PROJECT.md explicitly says "not a session viewer, just a launcher." | Launch sessions in a terminal. Let users view content in their terminal or use existing viewer tools. |
| **Real-time session monitoring / status tracking** | Nimbalyst does kanban status tracking. claude-code-monitor does real-time dashboards. This requires hooking into running Claude processes, parsing streaming output, and maintaining websocket connections. Enormous complexity for a launcher. | Show static metadata (last activity timestamp, session age). If a session is "active" vs "completed" can be inferred from file modification time without process monitoring. |
| **Multi-agent orchestration** | Nimbalyst supports running 6+ sessions simultaneously with git worktree isolation. This is a workflow orchestration tool, not a launcher. | Launch one session at a time per card click. If the user wants to run many sessions, they click multiple cards -- each opens its own terminal. |
| **Tab grouping / multi-tab windows** | PROJECT.md explicitly defers this. Grouping multiple sessions into tabs within a single window adds enormous complexity (either embedding a terminal emulator or managing window containment). | One terminal window per session launch. Users can use their terminal's native tab features if they want grouping. |
| **Cloud sync / remote access** | OAuth, account systems, sync infrastructure, conflict resolution. The user wants a local-only tool. claudecodeui already offers remote/mobile access for users who want that. | Store everything in local files. Users can sync their config folder via their own tools (OneDrive, etc.) if they want. |
| **Session renaming** | PROJECT.md explicitly defers this. Claude Code sessions are identified by UUID, and the `--resume` flag uses these IDs. Adding rename means maintaining a mapping layer between user-friendly names and session IDs. | Show the user's last message as a preview to help identify sessions. Consider for v2. |
| **Built-in terminal emulator** | Embedding a terminal (xterm.js, etc.) would make this a terminal app, not a launcher. Massive scope increase. Warp/Windows Terminal/PowerShell are all better terminals than anything we'd build. | Spawn external terminal processes. Keep the launcher lightweight. |
| **Git integration / diff viewing** | Nimbalyst and claude-code-viewer have git integration. It's valuable but orthogonal to the launcher's purpose. | Users interact with git in their terminal or IDE. Not the launcher's job. |
| **Cross-platform support (macOS/Linux)** | PROJECT.md scopes to Windows 11 only. Multi-platform adds CI complexity, platform-specific window management code, and testing burden. | Build for Windows. Use Tauri's cross-platform capabilities as future insurance, but don't test or support other platforms in v1. |

---

## Feature Dependencies

```
Project Discovery ──> Session List ──> Session Metadata Display
       │                    │
       v                    v
  Manual Project Add    One-Click Resume ──> Terminal Launcher Abstraction
       │                                            │
       v                                            v
  Pin/Unpin Projects                    Window Position Memory
                                                │
                                                v
                                    Crash-Resilient Persistence
                                                │
                                                v
                                    Multi-Monitor Awareness

Dashboard Cards ──> Free-Arrange Canvas
       │
       v
  Project Display Names

(Independent)
  Taskbar Pinning / System Tray
  Global Hotkey
  Fast Startup
```

**Key dependency chains:**

1. **Session data pipeline:** Discovery -> Session List -> Metadata -> Resume. You can't resume sessions you haven't discovered, and you can't display session lists without parsing session files.

2. **Position tracking pipeline:** Terminal Launch -> Position Memory -> Crash Persistence -> Multi-Monitor. Position tracking requires spawning windows first; crash resilience requires position tracking; multi-monitor validation requires position data.

3. **Dashboard pipeline:** Cards -> Canvas -> Display Names. Cards are the container; canvas is the layout engine; display names are card customization.

4. **Independent features:** Taskbar pinning, system tray, global hotkey, and fast startup can be built at any point.

---

## MVP Recommendation

**Prioritize (Phase 1 -- must ship):**

1. **Project discovery + manual add** -- the data layer everything else depends on
2. **Dashboard with project cards** (simple grid/list first, canvas later) -- visual interface
3. **Session list with metadata** -- so users can pick which session to resume
4. **One-click resume via terminal launcher** -- the core action
5. **Taskbar pinning** -- basic desktop app behavior
6. **Fast startup** -- Tauri gives this mostly for free, but don't sabotage it with heavy JS frameworks

**Prioritize (Phase 2 -- the differentiator):**

6. **Window position memory per session** -- this is the unique value
7. **Crash-resilient position persistence** -- without this, position memory is fragile
8. **Multi-monitor awareness** -- the user runs 2+ monitors, this is essential for them

**Prioritize (Phase 3 -- polish):**

9. **Free-arrange canvas layout** -- upgrade from grid to spatial canvas
10. **Pin/unpin projects** -- dashboard curation
11. **Project display names** -- personalization
12. **Global hotkey** -- power user convenience
13. **System tray with minimize-to-tray** -- keeps launcher accessible without taskbar clutter

**Defer to future (v2+):**

- Session renaming
- Tab grouping
- Session content preview/viewer
- Real-time status monitoring

---

## Competitive Positioning

This product sits in an unclaimed niche:

| Tool | Session Browse | Session Resume | Window Position | Spatial Dashboard | Desktop App |
|------|---------------|----------------|-----------------|-------------------|-------------|
| claude-session-browser | Yes | Yes | No | No | No (TUI) |
| ccrider | Yes | Yes | No | No | No (TUI) |
| Nimbalyst | Yes | Yes | No | Kanban (not spatial) | Yes |
| claudecodeui | Yes | Yes | No | No | No (Web) |
| PowerToys Workspaces | N/A | N/A | Yes (generic) | Visual editor | Yes |
| PersistentWindows | N/A | N/A | Yes (all windows) | No | Yes |
| **Workspace Resume** | **Yes** | **Yes** | **Yes (per-session)** | **Yes (free canvas)** | **Yes (Tauri)** |

The unique combination is: **Claude Code session awareness + per-session window position memory + spatial project dashboard**. No existing tool offers all three.

---

## Sources

- [Warp Launch Configurations](https://docs.warp.dev/terminal/sessions/launch-configurations) -- session save/restore patterns
- [Warp Session Restoration](https://docs.warp.dev/terminal/sessions/session-restoration) -- SQLite-based session persistence
- [PowerToys Workspaces](https://learn.microsoft.com/en-us/windows/powertoys/workspaces) -- window position capture and restore, multi-monitor support
- [Tauri Window State Plugin](https://v2.tauri.app/plugin/window-state/) -- built-in position persistence for Tauri apps
- [PersistentWindows](https://github.com/kangyu-california/PersistentWindows) -- crash-resilient window position tracking on Windows
- [claude-session-browser](https://github.com/davidpp/claude-session-browser) -- TUI session browsing patterns
- [ccrider](https://github.com/neilberkman/ccrider) -- CLI/TUI/MCP session search and resume
- [Nimbalyst](https://nimbalyst.com/) -- multi-session kanban management, closest competitor
- [Nimbalyst Features](https://nimbalyst.com/features/) -- feature set of the most capable Claude Code GUI
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) -- `--resume` and `--continue` flags
- [Claude Code Session File Format](https://deepwiki.com/affaan-m/everything-claude-code/7.1-session-files-and-format) -- JSONL structure, path encoding
- [Gemini CLI Session Management](https://geminicli.com/docs/cli/session-management/) -- comparable session resume UX patterns
- [Windows Multi-Monitor API](https://learn.microsoft.com/en-us/windows/win32/gdi/positioning-objects-on-multiple-display-monitors) -- MonitorFromWindow, GetMonitorInfo
- [tmux Workspace Manager (twm)](https://github.com/vinnymeller/twm) -- workspace-as-directory pattern
- [Warp Issue #1399](https://github.com/warpdotdev/Warp/issues/1399) -- window position in launch configs (requested but limited)
- [Windows Terminal Issue #4880](https://github.com/microsoft/terminal/issues/4880) -- session/folder management requests
