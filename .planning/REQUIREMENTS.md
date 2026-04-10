# Requirements: Workspace Resume

**Defined:** 2026-03-28
**Core Value:** Reliable session resumption from a visual dashboard -- resume is the foundation, position memory and canvas make it magical.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Session Discovery

- [x] **DISC-01**: App auto-discovers all projects from local Claude Code session files (`~/.claude/projects/`)
- [x] **DISC-02**: App decodes encoded project paths to resolve actual directory locations
- [x] **DISC-03**: App parses JSONL session files using stream-based reading (handles large files without loading into memory)
- [x] **DISC-04**: App detects new sessions and projects without requiring restart (periodic or file-watch refresh)

### Session Browsing

- [x] **SESS-01**: User can view a list of all sessions for a selected project
- [x] **SESS-02**: Each session in the list shows its creation timestamp
- [x] **SESS-03**: Each session in the list shows a truncated preview of the user's last input message
- [x] **SESS-04**: Session list is sorted by most recent activity

### Dashboard

- [x] **DASH-01**: App displays pinned projects as horizontal cards on a free-arrange canvas
- [x] **DASH-02**: Each project card shows the project display name, a Resume button, and a Select Session button
- [x] **DASH-03**: User can drag project cards to any position on the canvas
- [x] **DASH-04**: Card positions persist across app restarts
- [x] **DASH-05**: User can pin/unpin projects to control which appear on the dashboard
- [x] **DASH-06**: User can set a custom display name for any project (without modifying the filesystem)
- [x] **DASH-07**: App pins to the Windows taskbar

### Session Resume

- [x] **RESU-01**: Clicking Resume on a project card opens a terminal window with the most recent session resumed via `claude -r`
- [x] **RESU-02**: Clicking Select Session then choosing a session opens a terminal window with that specific session resumed via `claude -r <session_id>`
- [x] **RESU-03**: Terminal window opens cd'd to the project's directory
- [x] **RESU-04**: Terminal backend is configurable (Warp as default, PowerShell as fallback, architecture supports adding others)

### Window Position

- [ ] **WPOS-01**: App tracks the screen position of each spawned terminal window
- [ ] **WPOS-02**: Position metadata is stored per session (not per project) -- multiple sessions can have different positions
- [ ] **WPOS-03**: Position data updates dynamically as the user moves/resizes windows (not just on close)
- [ ] **WPOS-04**: Position persistence survives app crashes and hard shutdowns (periodic + event-driven saves)
- [ ] **WPOS-05**: When resuming a session, the terminal window appears at its last known screen position
- [ ] **WPOS-06**: Position tracking works across multiple monitors (2+ screens)
- [ ] **WPOS-07**: If a saved position references a disconnected monitor, the window falls back to the primary monitor

### Power User

- [ ] **POWR-01**: User can summon/hide the dashboard with a global keyboard shortcut
- [ ] **POWR-02**: Global hotkey is configurable

### Performance

- [x] **PERF-01**: App starts in under 2 seconds
- [x] **PERF-02**: App uses minimal RAM when idle/background (peak usage during active operations is acceptable)
- [x] **PERF-03**: Dashboard is responsive with 20+ pinned projects

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Project Management

- **PROJ-01**: User can manually add projects via folder picker (projects without Claude sessions)
- **PROJ-02**: User can rename individual sessions on the dashboard

### System Integration

- **SYSI-01**: App minimizes to system tray
- **SYSI-02**: System tray icon shows quick-access menu of pinned projects

### Tab Grouping

- **TABG-01**: Multiple sessions can be grouped into tabs within a single terminal window
- **TABG-02**: Resuming a "window group" reopens all tabs in one terminal window at the saved position

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| In-app chat / session content viewer | This is a launcher, not a session viewer -- existing tools (claudecodeui, claude-code-viewer) do this well |
| Real-time session monitoring | Would require hooking into running Claude processes -- enormous complexity for a launcher |
| Multi-agent orchestration | Workflow orchestration is a different product (Nimbalyst does this) |
| Built-in terminal emulator | Would make this a terminal app -- Warp/WT/PowerShell are all better terminals |
| Cloud sync / remote access | Local-only tool -- users can sync config via OneDrive etc. if needed |
| Git integration / diff viewing | Orthogonal to launcher purpose -- users have terminals and IDEs for this |
| Cross-platform (macOS/Linux) | Windows 11 only for v1 -- Tauri enables future cross-platform but don't test/support now |
| OAuth / accounts | No user accounts needed for a local tool |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DISC-01 | Phase 1 | Complete |
| DISC-02 | Phase 1 | Complete |
| DISC-03 | Phase 1 | Complete |
| DISC-04 | Phase 1 | Complete |
| SESS-01 | Phase 2 | Complete |
| SESS-02 | Phase 2 | Complete |
| SESS-03 | Phase 2 | Complete |
| SESS-04 | Phase 2 | Complete |
| DASH-01 | Phase 3 | Complete |
| DASH-02 | Phase 3 | Complete |
| DASH-03 | Phase 3 | Complete |
| DASH-04 | Phase 3 | Complete |
| DASH-05 | Phase 3 | Complete |
| DASH-06 | Phase 3 | Complete |
| DASH-07 | Phase 3 | Complete |
| RESU-01 | Phase 2 | Complete |
| RESU-02 | Phase 2 | Complete |
| RESU-03 | Phase 2 | Complete |
| RESU-04 | Phase 2 | Complete |
| WPOS-01 | Phase 4 | Pending |
| WPOS-02 | Phase 4 | Pending |
| WPOS-03 | Phase 4 | Pending |
| WPOS-04 | Phase 4 | Pending |
| WPOS-05 | Phase 4 | Pending |
| WPOS-06 | Phase 4 | Pending |
| WPOS-07 | Phase 4 | Pending |
| POWR-01 | Phase 5 | Pending |
| POWR-02 | Phase 5 | Pending |
| PERF-01 | Phase 1 | Complete |
| PERF-02 | Phase 1 | Complete |
| PERF-03 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after roadmap creation*
